import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { ProjectPhotoEntry, StaffMember } from '../lib/types';
import { compressImage } from '../lib/imageCompression';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import CollapsibleSection from './ui/CollapsibleSection';

type SortField = 'date' | 'projectName' | 'staffName';
type SortDirection = 'asc' | 'desc';

const PhotoManager: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('projectId');
  
  const [photos, setPhotos] = useState<ProjectPhotoEntry[]>([]);
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [compressPhotos, setCompressPhotos] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);
  const [showStaffField, setShowStaffField] = useState(false);
  const [editShowNotesField, setEditShowNotesField] = useState(false);
  const [editShowStaffField, setEditShowStaffField] = useState(false);
  
  // Edit form data (for inline editing)
  const [editFormData, setEditFormData] = useState<{
    projectId: string;
    date: string;
    notes?: string;
    staffId?: string;
  } | null>(null);
  
  // Filter and sort state
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Form state
  const [formData, setFormData] = useState({
    projectId: projectIdParam || '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    selectedFiles: [] as File[],
    staffId: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load staff members
      const staffSnapshot = await getDocs(collection(db, 'staffMembers'));
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffData);
      
      // Load projects
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unnamed Project'
      }));
      setProjects(projectsData);

      // Load photos
      const photosQuery = query(
        collection(db, 'projectPhotos'),
        orderBy('createdAt', 'desc')
      );
      const photosSnapshot = await getDocs(photosQuery);
      const photosData = photosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProjectPhotoEntry));
      setPhotos(photosData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // If projectId is in URL, show form and pre-populate
    if (projectIdParam) {
      setShowForm(true);
      setFormData(prev => ({ ...prev, projectId: projectIdParam }));
    }
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    
    // Append new files to existing ones instead of replacing
    const newFiles = Array.from(files);
    setFormData(prev => ({ 
      ...prev, 
      selectedFiles: [...prev.selectedFiles, ...newFiles] 
    }));
    
    // Reset input value so onChange can fire again for new camera captures
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectId || !currentUser) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.selectedFiles.length === 0) {
      alert('Please select at least one photo');
      return;
    }

    const selectedProject = projects.find(p => p.id === formData.projectId);
    if (!selectedProject) {
      alert('Please select a valid project');
      return;
    }

    try {
      setUploading(true);
      
      // Upload new photos
      const fileArray = Array.from(formData.selectedFiles);
        
        // Validate files
        const validationErrors: string[] = [];
        const validFiles = fileArray.filter(file => {
          const fileSizeMB = file.size / (1024 * 1024);
          const maxSizeMB = 10;
          const maxSizeBytes = maxSizeMB * 1024 * 1024;
          
          if (!file.type.startsWith('image/')) {
            validationErrors.push(`${file.name} is not an image file`);
            return false;
          }
          
          if (file.size > maxSizeBytes) {
            validationErrors.push(`${file.name} is too large (${fileSizeMB.toFixed(2)}MB). Maximum size is ${maxSizeMB}MB.`);
            return false;
          }
          
          return true;
        });
        
        if (validationErrors.length > 0) {
          alert(`Please fix the following issues:\n\n${validationErrors.join('\n')}`);
          return;
        }
        
        if (validFiles.length === 0) {
          alert('No valid files to upload');
          return;
        }

        console.log(`Starting upload: ${validFiles.length} valid files selected`);
        console.log('File details:', validFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));

        // Group photos: upload up to 9 photos in a single entry
        const maxPhotosPerEntry = 9;
        const photoGroups: File[][] = [];
        for (let i = 0; i < validFiles.length; i += maxPhotosPerEntry) {
          photoGroups.push(validFiles.slice(i, i + maxPhotosPerEntry));
        }
        
        console.log(`Created ${photoGroups.length} group(s) from ${validFiles.length} files`);

        console.log(`Uploading ${validFiles.length} files in ${photoGroups.length} group(s)`);
        console.log(`Files to upload:`, validFiles.map(f => f.name));

        let successCount = 0;
        let errorCount = 0;

        for (let groupIndex = 0; groupIndex < photoGroups.length; groupIndex++) {
          const photoGroup = photoGroups[groupIndex];
          const photoUrls: string[] = [];
          const photoNames: string[] = [];
          
          setUploadProgress({current: groupIndex, total: photoGroups.length});

          console.log(`Processing group ${groupIndex + 1}/${photoGroups.length} with ${photoGroup.length} photos`);
          console.log(`Group files:`, photoGroup.map(f => f.name));

          try {
            // Upload all photos in this group
            for (let i = 0; i < photoGroup.length; i++) {
              const file = photoGroup[i];
              
              try {
                // Compress image if option is enabled
                let fileToUpload = file;
                if (compressPhotos && file.type.startsWith('image/')) {
                  fileToUpload = await compressImage(file);
                }
                
                // Create unique filename with timestamp and index
                const timestamp = Date.now();
                const fileName = `${timestamp}_${groupIndex}_${i}_${fileToUpload.name}`;
                const photoRef = ref(storage, `projects/${formData.projectId}/photos/${fileName}`);
                
                // Upload file
                await uploadBytes(photoRef, fileToUpload, {
                  customMetadata: {
                    uploadedBy: currentUser.uid,
                    uploadedAt: new Date().toISOString()
                  }
                });
                
                // Get download URL
                const photoUrl = await getDownloadURL(photoRef);
                photoUrls.push(photoUrl);
                photoNames.push(fileName);
                console.log(`Successfully uploaded photo ${i + 1}/${photoGroup.length}: ${file.name}`);
              } catch (fileError: any) {
                console.error(`Failed to upload photo ${i + 1}/${photoGroup.length} (${file.name}):`, fileError);
                // Continue with other photos even if one fails
              }
            }
            
            // Only create entry if we have at least one photo URL
            if (photoUrls.length > 0) {
              // Get selected staff member if provided
              const selectedStaff = formData.staffId ? staff.find(s => s.id === formData.staffId) : null;
              
              // Create a single entry for this group of photos
              const photoEntryData: Omit<ProjectPhotoEntry, 'id'> = {
                projectId: formData.projectId,
                projectName: selectedProject.name,
                photoUrl: photoUrls[0], // First photo for backward compatibility
                photoUrls: photoUrls, // Array of all photo URLs
                photoName: photoNames[0], // First filename for backward compatibility
                photoNames: photoNames, // Array of all filenames
                description: formData.notes || '',
                date: formData.date,
                uploadedBy: currentUser.uid,
                uploadedByName: currentUser.displayName || currentUser.email || 'Unknown User',
                staffId: formData.staffId || undefined,
                staffName: selectedStaff?.name || undefined,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };
              
              await addDoc(collection(db, 'projectPhotos'), photoEntryData);
              console.log(`Created photo entry with ${photoUrls.length} photo(s)`);
              successCount += photoUrls.length;
            } else {
              console.error('No photos were successfully uploaded in this group');
              errorCount += photoGroup.length;
            }
          } catch (uploadError: any) {
            console.error('Upload failed for photo group:', uploadError);
            errorCount += photoGroup.length;
          }
          
          setUploadProgress({current: groupIndex + 1, total: photoGroups.length});
        }

        if (successCount > 0) {
          await loadData();
          resetForm();
        }
        
        if (errorCount > 0) {
          alert(`${errorCount} file(s) failed to upload. ${successCount} file(s) uploaded successfully.`);
        }
    } catch (error) {
      console.error('Error saving photo:', error);
      alert('Failed to save photo. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress({current: 0, total: 0});
    }
  };

  const handleStartEdit = (photo: ProjectPhotoEntry) => {
    setEditingId(photo.id);
    setEditFormData({
      projectId: photo.projectId,
      date: photo.date,
      notes: photo.description || '',
      staffId: photo.staffId || ''
    });
    setEditShowNotesField(!!photo.description);
    setEditShowStaffField(!!photo.staffId);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
    setEditShowNotesField(false);
    setEditShowStaffField(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editFormData || !currentUser) return;

    const photo = photos.find(p => p.id === editingId);
    if (!photo) return;

    try {
      setSaving(true);

      if (!editFormData.projectId) {
        alert('Please fill in all required fields (project)');
        setSaving(false);
        return;
      }

      const selectedProject = projects.find(p => p.id === editFormData.projectId);
      const selectedStaff = editFormData.staffId ? staff.find(s => s.id === editFormData.staffId) : null;

      const updateData: any = {
        projectId: editFormData.projectId,
        projectName: selectedProject?.name || photo.projectName,
        description: editFormData.notes?.trim() || '',
        date: editFormData.date,
        staffId: editFormData.staffId || null,
        staffName: selectedStaff?.name || null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'projectPhotos', editingId), updateData);
      await loadData();
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating photo:', error);
      alert('Failed to update photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      // Delete from Storage
      try {
        // Construct the storage path from projectId and photoName
        // photoName contains the full filename with timestamp prefix (e.g., "1234567890_filename.jpg")
        if (photo.photoName && photo.projectId) {
          const storagePath = `projects/${photo.projectId}/photos/${photo.photoName}`;
          const photoRef = ref(storage, storagePath);
          await deleteObject(photoRef);
        }
      } catch (storageError) {
        console.error('Error deleting photo from storage:', storageError);
        // Continue with Firestore deletion even if storage deletion fails
      }

      // Delete from Firestore
      await deleteDoc(doc(db, 'projectPhotos', photoId));
      await loadData();
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: projectIdParam || '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
      selectedFiles: [],
      staffId: ''
    });
    setShowNotesField(false);
    setShowStaffField(false);
    setEditingId(null);
    setEditFormData(null);
    setEditShowNotesField(false);
    setEditShowStaffField(false);
    setShowForm(false);
    // Clear projectId from URL if it was set
    if (projectIdParam) {
      setSearchParams({});
    }
    // Reset file input
    const fileInput = document.getElementById('photo-file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Filter and sort photos
  const filteredAndSortedPhotos = useMemo(() => {
    let filtered = [...photos];
    
    // Apply project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(photo => photo.projectId === projectFilter);
    }
    
    // Apply staff filter
    if (staffFilter !== 'all') {
      filtered = filtered.filter(photo => photo.staffId === staffFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(photo => {
        // Search in description
        const description = photo.description?.toLowerCase() || '';
        if (description.includes(query)) return true;
        
        // Search in project name
        const projectName = photo.projectName?.toLowerCase() || '';
        if (projectName.includes(query)) return true;
        
        // Search in staff name
        const staffName = photo.staffName?.toLowerCase() || '';
        if (staffName.includes(query)) return true;
        
        // Search in uploaded by name
        const uploadedByName = photo.uploadedByName?.toLowerCase() || '';
        if (uploadedByName.includes(query)) return true;
        
        // Search in date (try multiple formats)
        if (photo.date) {
          try {
            const date = new Date(photo.date);
            // Check formatted date string
            const dateStr = formatDate(photo.date).toLowerCase();
            if (dateStr.includes(query)) return true;
            
            // Check ISO date string
            const isoDate = photo.date.toLowerCase();
            if (isoDate.includes(query)) return true;
            
            // Check month/year format
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase();
            if (monthYear.includes(query)) return true;
            
            // Check full date string
            const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
            if (fullDate.includes(query)) return true;
          } catch {
            // If date parsing fails, just check the raw date string
            if (photo.date.toLowerCase().includes(query)) return true;
          }
        }
        
        return false;
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'date':
          aValue = a.date || '';
          bValue = b.date || '';
          break;
        case 'projectName':
          aValue = a.projectName || '';
          bValue = b.projectName || '';
          break;
        case 'staffName':
          aValue = a.staffName || '';
          bValue = b.staffName || '';
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return filtered;
  }, [photos, projectFilter, staffFilter, searchQuery, sortField, sortDirection]);

  // Group photos by month
  const photosByMonth = useMemo(() => {
    const grouped: Record<string, ProjectPhotoEntry[]> = {};
    
    filteredAndSortedPhotos.forEach(photo => {
      if (!photo.date) return;
      try {
        const date = new Date(photo.date);
        const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!grouped[monthStr]) {
          grouped[monthStr] = [];
        }
        grouped[monthStr].push(photo);
      } catch {
        // Ignore invalid dates
      }
    });
    
    // Sort months in descending order (most recent first)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Return as array of [month, photos] tuples for easy iteration
    return sortedMonths.map(month => [month, grouped[month]] as [string, ProjectPhotoEntry[]]);
  }, [filteredAndSortedPhotos]);

  // Track expanded months (initialize with current month)
  const [expandedMonths] = useState<Set<string>>(() => {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return new Set([currentMonth]);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortButton: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-gray-900 touch-manipulation min-h-[44px] px-2 py-1"
    >
      <span>{label}</span>
      {sortField === field && (
        <span className="text-blue-600">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  const selectedProject = projects.find(p => p.id === formData.projectId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Project Photos</h3>
            <p className="text-xs sm:text-sm text-gray-500">Manage project photos</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Upload Photos
          </Button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Upload Photos
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project *
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                    required
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                {/* Optional Fields - Toggleable */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {!showNotesField && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNotesField(true)}
                      className="text-sm"
                    >
                      + Add Notes
                    </Button>
                  )}
                  {!showStaffField && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStaffField(true)}
                      className="text-sm"
                    >
                      + Add Staff
                    </Button>
                  )}
                </div>

                {/* Staff Member Field */}
                {showStaffField && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Staff Member
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowStaffField(false);
                          setFormData({ ...formData, staffId: '' });
                        }}
                        className="text-xs"
                      >
                        Remove
                      </Button>
                    </div>
                    <select
                      value={formData.staffId}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                    >
                      <option value="">Select Staff Member</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes Field */}
                {showNotesField && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Notes
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowNotesField(false);
                          setFormData({ ...formData, notes: '' });
                        }}
                        className="text-xs"
                      >
                        Remove
                      </Button>
                    </div>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation"
                      rows={2}
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={compressPhotos}
                      onChange={(e) => setCompressPhotos(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Compress images (faster upload, smaller files)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photos *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 transition-colors">
                    <label htmlFor="photo-file-upload" className="cursor-pointer block">
                      <span className="block text-sm font-medium text-gray-900">
                        {formData.selectedFiles.length > 0 
                          ? `${formData.selectedFiles.length} photo(s) selected`
                          : 'Click to select photos'}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        PNG, JPG, GIF up to 10MB each
                      </span>
                    </label>
                    <input
                      id="photo-file-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="hidden"
                    />
                  </div>
                  {formData.selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.selectedFiles.map((file, index) => (
                        <div key={index} className="text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-2 text-sm text-gray-600">
                      Uploading group {uploadProgress.current + 1} of {uploadProgress.total} ({formData.selectedFiles.length} photo{formData.selectedFiles.length !== 1 ? 's' : ''} total)...
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                  <Button type="submit" disabled={uploading} className="w-full sm:w-auto">
                    {uploading ? 'Uploading...' : 'Upload'} Photo{formData.selectedFiles.length > 1 ? 's' : ''}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Card>

        {/* Search */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Search</h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by description, project, staff, date..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member</label>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
              >
                <option value="all">All Staff</option>
                {staff.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="flex items-center space-x-4 pt-3">
                <SortButton field="date" label="Date" />
                <SortButton field="projectName" label="Project" />
                <SortButton field="staffName" label="Staff" />
              </div>
            </div>
          </div>
        </Card>

        {/* Photos List */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Photos ({filteredAndSortedPhotos.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
              <SortButton field="date" label="Date" />
              <SortButton field="projectName" label="Project" />
              <SortButton field="staffName" label="Staff" />
            </div>
          </div>

          {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading photos...</p>
          </div>
        ) : filteredAndSortedPhotos.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📸</div>
            <p className="text-gray-500 text-sm">No photos found</p>
            <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {photosByMonth.map(([month, monthPhotos]) => (
              <CollapsibleSection
                key={month}
                title={month}
                count={monthPhotos.length}
                defaultExpanded={expandedMonths.has(month)}
                className="bg-white"
              >
                <div className="space-y-2">
                  {monthPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => editingId !== photo.id && handleStartEdit(photo)}
                      className="p-2 sm:p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors cursor-pointer"
                    >
                      {editingId === photo.id && editFormData ? (
                        // Edit Form
                        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              📸 Photo
                            </span>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                size="sm"
                                variant="outline"
                                className="min-h-[44px] flex-1 sm:flex-none"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                size="sm"
                                variant="ghost"
                                className="min-h-[44px] flex-1 sm:flex-none"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleDelete(photo.id)}
                                disabled={saving}
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 min-h-[44px] flex-1 sm:flex-none"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
                              <select
                                value={editFormData.projectId}
                                onChange={(e) => setEditFormData({...editFormData, projectId: e.target.value})}
                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px]"
                              >
                                <option value="">Select Project</option>
                                {projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                              <Input
                                type="date"
                                value={editFormData.date}
                                onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                                className="text-sm"
                              />
                            </div>

                            {!editShowStaffField && (
                              <div className="sm:col-span-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditShowStaffField(true)}
                                  className="text-xs"
                                >
                                  + Add Staff
                                </Button>
                              </div>
                            )}

                            {editShowStaffField && (
                              <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-medium text-gray-700">Staff Member</label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditShowStaffField(false);
                                      setEditFormData({...editFormData, staffId: undefined});
                                    }}
                                    className="text-xs"
                                  >
                                    Remove
                                  </Button>
                                </div>
                                <select
                                  value={editFormData.staffId || ''}
                                  onChange={(e) => setEditFormData({...editFormData, staffId: e.target.value})}
                                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px]"
                                >
                                  <option value="">Select Staff Member</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {!editShowNotesField && (
                              <div className="sm:col-span-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditShowNotesField(true)}
                                  className="text-xs"
                                >
                                  + Add Notes
                                </Button>
                              </div>
                            )}

                            {editShowNotesField && (
                              <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-medium text-gray-700">Notes</label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditShowNotesField(false);
                                      setEditFormData({...editFormData, notes: ''});
                                    }}
                                    className="text-xs"
                                  >
                                    Remove
                                  </Button>
                                </div>
                                <textarea
                                  value={editFormData.notes || ''}
                                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                                  placeholder="Additional notes..."
                                  rows={2}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Display View
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                📸 Photo
                              </span>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {formatDate(photo.date)}
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            {(photo.photoUrls && photo.photoUrls.length > 0) || photo.photoUrl ? (
                              <div className="mb-1.5">
                                <div className="grid grid-cols-3 sm:flex sm:flex-nowrap gap-1.5">
                                  {(photo.photoUrls || (photo.photoUrl ? [photo.photoUrl] : [])).slice(0, 9).map((url, index) => (
                                    <img
                                      key={index}
                                      src={url}
                                      alt={`Photo ${index + 1}${photo.description ? ` - ${photo.description}` : ''}`}
                                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(url, '_blank');
                                      }}
                                    />
                                  ))}
                                </div>
                                {(photo.photoUrls && photo.photoUrls.length > 9) && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    +{photo.photoUrls.length - 9} more photos
                                  </p>
                                )}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                              <span className="font-medium text-gray-900">
                                {photo.uploadedByName || 'Unknown User'}
                              </span>
                              {photo.projectName && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500">{photo.projectName}</span>
                                </>
                              )}
                              {photo.staffName && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500">{photo.staffName}</span>
                                </>
                              )}
                            </div>
                            {photo.description && (
                              <p className="text-xs text-gray-600 break-words mt-0.5">
                                {photo.description}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PhotoManager;

