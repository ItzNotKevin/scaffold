import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { Reimbursement, StaffMember, Vendor, ExpenseCategory } from '../lib/types';
import { updateProjectActualCost } from '../lib/projectCosts';
import { compressImage } from '../lib/imageCompression';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

const ReimbursementManager: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptCameraInputRef = useRef<HTMLInputElement>(null);
  const receiptGalleryInputRef = useRef<HTMLInputElement>(null);
  const [savingVendor, setSavingVendor] = useState(false);
  const [showAddVendorInput, setShowAddVendorInput] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  // Form state
  const [formData, setFormData] = useState({
    staffId: '',
    projectId: '',
    vendorId: '',
    categoryId: '',
    amount: '' as string | number,
    date: new Date().toISOString().split('T')[0],
    receiptUrl: '',
    notes: '',
    status: 'approved' as 'pending' | 'approved' | 'rejected'
  });

  const fetchVendors = async () => {
    try {
      const vendorSnapshot = await getDocs(
        query(collection(db, 'vendors'), orderBy('name', 'asc'))
      );
      const vendorData = vendorSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Vendor));
      setVendors(vendorData);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const categorySnapshot = await getDocs(collection(db, 'expenseCategories'));
      const categoryData = categorySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ExpenseCategory));
      setCategories(categoryData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const updateCategoryLastUsed = async (categoryId: string) => {
    try {
      await updateDoc(doc(db, 'expenseCategories', categoryId), {
        lastUsed: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // Refresh categories to reflect the updated lastUsed
      await fetchCategories();
    } catch (error) {
      console.error('Error updating category last used:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const reimbursementsQuery = query(
        collection(db, 'reimbursements'),
        orderBy('date', 'desc')
      );

      const [
        staffSnapshot,
        projectsSnapshot,
        vendorSnapshot,
        categorySnapshot,
        reimbursementsSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'staffMembers')),
        getDocs(collection(db, 'projects')),
        getDocs(query(collection(db, 'vendors'), orderBy('name', 'asc'))),
        getDocs(collection(db, 'expenseCategories')),
        getDocs(reimbursementsQuery)
      ]);

      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffData);

      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unnamed Project'
      }));
      setProjects(projectsData);

      const vendorData = vendorSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Vendor));
      setVendors(vendorData);

      const categoryData = categorySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ExpenseCategory));
      setCategories(categoryData);

      const reimbursementsData = reimbursementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reimbursement));
      setReimbursements(reimbursementsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploadingReceipt(true);
      
      // Compress the image before upload
      const compressedFile = await compressImage(file, {
        maxSizeMB: 0.5, // Receipts can be smaller
        maxWidthOrHeight: 1600
      });
      
      // Create a reference to the file in Firebase Storage
      const timestamp = Date.now();
      const fileName = `receipts/${currentUser.uid}/${timestamp}_${compressedFile.name}`;
      const storageRef = ref(storage, fileName);
      
      // Upload the compressed file
      await uploadBytes(storageRef, compressedFile);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      setFormData({ ...formData, receiptUrl: downloadURL });
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Failed to upload receipt. Please try again.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleAddVendor = async () => {
    if (!newVendorName.trim() || !currentUser) return;

    try {
      setSavingVendor(true);
      const vendorRef = await addDoc(collection(db, 'vendors'), {
        name: newVendorName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid
      });
      
      // Refresh vendors list
      await fetchVendors();
      
      // Select the newly added vendor
      setFormData({ ...formData, vendorId: vendorRef.id });
      
      // Reset add vendor UI
      setNewVendorName('');
      setShowAddVendorInput(false);
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor. Please try again.');
    } finally {
      setSavingVendor(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !currentUser) return;

    try {
      setSavingCategory(true);
      const categoryRef = await addDoc(collection(db, 'expenseCategories'), {
        name: newCategoryName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
        createdBy: currentUser.uid
      });
      
      // Refresh categories list
      await fetchCategories();
      
      // Select the newly added category
      setFormData({ ...formData, categoryId: categoryRef.id });
      
      // Reset add category UI
      setNewCategoryName('');
      setShowAddCategoryInput(false);
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category. Please try again.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(formData.amount as string) || 0;
    if (!formData.staffId || !formData.categoryId || amountValue <= 0 || !currentUser) return;

    try {
      setSaving(true);
      
      const selectedStaff = staff.find(s => s.id === formData.staffId);
      const selectedProject = projects.find(p => p.id === formData.projectId);
      const selectedVendor = vendors.find(v => v.id === formData.vendorId);
      const selectedCategory = categories.find(c => c.id === formData.categoryId);
      
      // Track old project ID if editing, to update both old and new project costs
      let oldProjectId: string | null = null;
      if (editingId) {
        const oldReimbursement = reimbursements.find(r => r.id === editingId);
        oldProjectId = oldReimbursement?.projectId || null;
      }
      
      const reimbursementData = {
        staffId: formData.staffId,
        staffName: selectedStaff?.name || 'Unknown',
        projectId: formData.projectId || null,
        projectName: selectedProject?.name || null,
        vendorId: formData.vendorId || null,
        vendorName: selectedVendor?.name || null,
        categoryId: formData.categoryId || null,
        categoryName: selectedCategory?.name || null,
        itemDescription: selectedCategory?.name || '', // Use category name as item description
        amount: amountValue,
        date: formData.date,
        receiptUrl: formData.receiptUrl || null,
        notes: formData.notes || null,
        status: formData.status,
        createdBy: currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      if (editingId) {
        // Update existing reimbursement
        await updateDoc(doc(db, 'reimbursements', editingId), reimbursementData);
      } else {
        // Create new reimbursement
        await addDoc(collection(db, 'reimbursements'), {
          ...reimbursementData,
          createdAt: serverTimestamp()
        });
      }
      
      // Update project costs
      // If the reimbursement has a project, update it
      if (formData.projectId) {
        await updateProjectActualCost(formData.projectId);
      }
      // If editing and the old project was different, update that too
      if (oldProjectId && oldProjectId !== formData.projectId) {
        await updateProjectActualCost(oldProjectId);
      }
      
      // Update category lastUsed if a category is selected
      if (formData.categoryId && selectedCategory) {
        await updateCategoryLastUsed(formData.categoryId);
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving reimbursement:', error);
      alert('Failed to save reimbursement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAndAddAnother = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(formData.amount as string) || 0;
    if (!formData.staffId || !formData.categoryId || amountValue <= 0 || !currentUser) return;

    try {
      setSaving(true);
      
      const selectedStaff = staff.find(s => s.id === formData.staffId);
      const selectedProject = projects.find(p => p.id === formData.projectId);
      const selectedVendor = vendors.find(v => v.id === formData.vendorId);
      const selectedCategory = categories.find(c => c.id === formData.categoryId);
      
      const reimbursementData = {
        staffId: formData.staffId,
        staffName: selectedStaff?.name || 'Unknown',
        projectId: formData.projectId || null,
        projectName: selectedProject?.name || null,
        vendorId: formData.vendorId || null,
        vendorName: selectedVendor?.name || null,
        categoryId: formData.categoryId || null,
        categoryName: selectedCategory?.name || null,
        itemDescription: selectedCategory?.name || '', // Use category name as item description
        amount: amountValue,
        date: formData.date,
        receiptUrl: formData.receiptUrl || null,
        notes: formData.notes || null,
        status: formData.status,
        createdBy: currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      // Create new reimbursement (this should only be called when creating, not editing)
      await addDoc(collection(db, 'reimbursements'), {
        ...reimbursementData,
        createdAt: serverTimestamp()
      });
      
      // Update project costs if the reimbursement has a project
      if (formData.projectId) {
        await updateProjectActualCost(formData.projectId);
      }
      
      // Update category lastUsed if a category is selected
      if (formData.categoryId && selectedCategory) {
        await updateCategoryLastUsed(formData.categoryId);
      }
      
      await loadData();
      resetFormForAnother(); // Keep form open with same selections
    } catch (error) {
      console.error('Error saving reimbursement:', error);
      alert('Failed to save reimbursement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reimbursement: Reimbursement) => {
    setFormData({
      staffId: reimbursement.staffId,
      projectId: reimbursement.projectId || '',
      vendorId: reimbursement.vendorId || '',
      categoryId: reimbursement.categoryId || '',
      amount: reimbursement.amount,
      date: reimbursement.date,
      receiptUrl: reimbursement.receiptUrl || '',
      notes: reimbursement.notes || '',
      status: reimbursement.status
    });
    setEditingId(reimbursement.id);
    setShowForm(true);
  };

  const handleDelete = async (reimbursementId: string) => {
    if (!confirm('Are you sure you want to delete this reimbursement?')) return;
    
    try {
      // Get the reimbursement to find its projectId before deleting
      const reimbursement = reimbursements.find(r => r.id === reimbursementId);
      const projectId = reimbursement?.projectId;
      
      await deleteDoc(doc(db, 'reimbursements', reimbursementId));
      
      // Update project costs if the reimbursement was linked to a project
      if (projectId) {
        await updateProjectActualCost(projectId);
      }
      
      await loadData();
    } catch (error) {
      console.error('Error deleting reimbursement:', error);
      alert('Failed to delete reimbursement. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      staffId: '',
      projectId: '',
      vendorId: '',
      categoryId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      receiptUrl: '',
      notes: '',
      status: 'approved'
    });
    setEditingId(null);
    setShowForm(false);
    setShowAddVendorInput(false);
    setNewVendorName('');
    setShowAddCategoryInput(false);
    setNewCategoryName('');
  };

  const resetFormForAnother = () => {
    // Keep dropdown selections (staffId, projectId, vendorId, categoryId, status)
    // Clear only the fields that typically change between reimbursements
    setFormData({
      ...formData,
      amount: '',
      date: new Date().toISOString().split('T')[0],
      receiptUrl: '',
      notes: ''
    });
    // Keep form open and keep editingId as null (not editing)
    setEditingId(null);
    setShowAddVendorInput(false);
    setNewVendorName('');
    setShowAddCategoryInput(false);
    setNewCategoryName('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate total reimbursements
  const totalReimbursements = reimbursements
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.amount, 0);

  // Get recently used categories (top 3) and all others
  const getCategoriesOrganized = () => {
    // Get all categories with lastUsed timestamp
    const categoriesWithLastUsed = categories
      .filter(cat => cat.lastUsed)
      .sort((a, b) => {
        try {
          const aTime = a.lastUsed && typeof a.lastUsed === 'object' && 'toMillis' in a.lastUsed
            ? (a.lastUsed as any).toMillis()
            : new Date(a.lastUsed as any).getTime();
          const bTime = b.lastUsed && typeof b.lastUsed === 'object' && 'toMillis' in b.lastUsed
            ? (b.lastUsed as any).toMillis()
            : new Date(b.lastUsed as any).getTime();
          return bTime - aTime; // Most recently used first
        } catch {
          return 0;
        }
      })
      .slice(0, 3); // Top 3 recently used
    
    const recentIds = new Set(categoriesWithLastUsed.map(c => c.id));
    
    // Get all other categories (those not in recently used, sorted alphabetically)
    const otherCategories = categories
      .filter(cat => !recentIds.has(cat.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return { recentCategories: categoriesWithLastUsed, otherCategories };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Reimbursement Management</h3>
            <p className="text-xs sm:text-sm text-gray-500">Track material reimbursements for staff members</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Reimbursement
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-600 font-medium">Total Reimbursements</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{reimbursements.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-sm text-green-600 font-medium">Approved Amount</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalReimbursements)}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
            <p className="text-sm text-yellow-600 font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-900 mt-1">
              {reimbursements.filter(r => r.status === 'pending').length}
            </p>
          </div>
        </div>
      </Card>

      {/* Add Reimbursement Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{editingId ? 'Edit Reimbursement' : 'Add Reimbursement'}</h2>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Staff Member *
                    </label>
                    <select
                      value={formData.staffId}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                      required
                    >
                      <option value="">Select Staff Member</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project (Optional)
                    </label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                    >
                      <option value="">No Project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vendor (Optional)
                    </label>
                    <select
                      value={showAddVendorInput ? 'add-new' : formData.vendorId}
                      onChange={(e) => {
                        if (e.target.value === 'add-new') {
                          setShowAddVendorInput(true);
                          setFormData({ ...formData, vendorId: '' });
                        } else {
                          setFormData({ ...formData, vendorId: e.target.value });
                          setShowAddVendorInput(false);
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                    >
                      <option value="">No Vendor</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                      <option value="add-new">+ Add New Vendor</option>
                    </select>
                    {showAddVendorInput && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={newVendorName}
                          onChange={(e) => setNewVendorName(e.target.value)}
                          placeholder="Enter vendor name"
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddVendor();
                            } else if (e.key === 'Escape') {
                              setShowAddVendorInput(false);
                              setNewVendorName('');
                              setFormData({ ...formData, vendorId: '' });
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddVendor}
                          disabled={savingVendor || !newVendorName.trim()}
                          className="min-w-[100px]"
                        >
                          {savingVendor ? 'Saving...' : 'Add'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddVendorInput(false);
                            setNewVendorName('');
                            setFormData({ ...formData, vendorId: '' });
                          }}
                          className="min-w-[80px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={showAddCategoryInput ? 'add-new' : formData.categoryId}
                      onChange={(e) => {
                        if (e.target.value === 'add-new') {
                          setShowAddCategoryInput(true);
                          setFormData({ ...formData, categoryId: '' });
                        } else {
                          setFormData({ ...formData, categoryId: e.target.value });
                          setShowAddCategoryInput(false);
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                      required
                    >
                      <option value="">Select Category</option>
                      {(() => {
                        const { recentCategories, otherCategories } = getCategoriesOrganized();
                        return (
                          <>
                            {recentCategories.length > 0 && (
                              <optgroup label="Recently Used">
                                {recentCategories.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {otherCategories.length > 0 && (
                              <optgroup label="All Categories">
                                {otherCategories.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        );
                      })()}
                      <option value="add-new">+ Add New Category</option>
                    </select>
                    {showAddCategoryInput && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Category name"
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategory();
                            } else if (e.key === 'Escape') {
                              setShowAddCategoryInput(false);
                              setNewCategoryName('');
                              setFormData({ ...formData, categoryId: '' });
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddCategory}
                          disabled={savingCategory || !newCategoryName.trim()}
                          className="min-w-[100px]"
                        >
                          {savingCategory ? 'Saving...' : 'Add'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddCategoryInput(false);
                            setNewCategoryName('');
                            setFormData({ ...formData, categoryId: '' });
                          }}
                          className="min-w-[80px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount ($) *
                    </label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                
                {/* Receipt Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Photo
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      ref={receiptCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      disabled={uploadingReceipt}
                      className="hidden"
                    />
                    <input
                      ref={receiptGalleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploadingReceipt}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      onClick={() => receiptCameraInputRef.current?.click()}
                      disabled={uploadingReceipt}
                      variant="outline"
                      className="flex-1 sm:flex-none"
                    >
                      📷 Take Photo
                    </Button>
                    <Button
                      type="button"
                      onClick={() => receiptGalleryInputRef.current?.click()}
                      disabled={uploadingReceipt}
                      variant="outline"
                      className="flex-1 sm:flex-none"
                    >
                      🖼️ Choose from Library
                    </Button>
                    {uploadingReceipt && (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Uploading...</span>
                      </div>
                    )}
                  </div>
                  {formData.receiptUrl && (
                    <div className="mt-2">
                      <a
                        href={formData.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        View Receipt
                      </a>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-end flex-wrap gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  {!editingId && (
                    <button
                      type="button"
                      onClick={handleSubmitAndAddAnother}
                      disabled={saving || uploadingReceipt}
                      className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {saving && (
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      <span>{saving ? 'Saving...' : 'Submit & Add Another'}</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || uploadingReceipt}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {saving && (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    <span>{saving ? 'Saving...' : (editingId ? 'Update' : 'Add')} Reimbursement</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Card className="p-4 sm:p-6">
        {/* Reimbursements List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading reimbursements...</p>
          </div>
        ) : reimbursements.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🧾</div>
            <p className="text-gray-500 text-sm">No reimbursements found</p>
            <p className="text-gray-400 text-xs mt-1">Add reimbursements to track material costs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reimbursements.map((reimbursement) => (
              <div key={reimbursement.id} className="p-2.5 sm:p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm break-words">{reimbursement.itemDescription}</h4>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium border ${getStatusColor(reimbursement.status)}`}>
                        {reimbursement.status}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500">{reimbursement.date}</span>
                      <span className="text-[10px] sm:text-xs font-medium text-green-600">{formatCurrency(reimbursement.amount)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] sm:text-xs text-gray-600">
                      <span>{reimbursement.staffName}</span>
                      {reimbursement.projectName && (
                        <span className="text-gray-500">• {reimbursement.projectName}</span>
                      )}
                      {reimbursement.vendorName && (
                        <span className="text-gray-500">• {reimbursement.vendorName}</span>
                      )}
                      {reimbursement.categoryName && (
                        <span className="text-gray-500">• {reimbursement.categoryName}</span>
                      )}
                      {reimbursement.receiptUrl && (
                        <a
                          href={reimbursement.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 touch-manipulation"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Receipt
                        </a>
                      )}
                    </div>
                    {reimbursement.notes && (
                      <p className="text-[10px] sm:text-xs text-gray-600 mt-1 break-words italic">{reimbursement.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 sm:ml-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(reimbursement)}
                      className="flex-1 sm:flex-none min-h-[32px] sm:min-h-[32px] text-xs px-2 py-1"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(reimbursement.id)}
                      className="text-red-600 hover:text-red-700 flex-1 sm:flex-none min-h-[32px] sm:min-h-[32px] text-xs px-2 py-1"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReimbursementManager;
