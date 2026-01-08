import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import CollapsibleSection from '../components/ui/CollapsibleSection';
import { collection, getDocs, query, orderBy, where, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { TaskAssignment, Expense, Income, StaffMember } from '../lib/types';
import { updateProjectActualCost } from '../lib/projectCosts';
import { updateProjectActualRevenue } from '../lib/projectRevenue';
import Input from '../components/ui/Input';

interface ActivityLog {
  id: string;
  type: 'assignment' | 'reimbursement' | 'income' | 'photo';
  date: string;
  staffId?: string;
  staffName?: string;
  projectId?: string;
  projectName?: string;
  description: string;
  amount?: number;
  createdAt: any;
  // Assignment-specific
  taskDescription?: string;
  dailyRate?: number;
  // Expense-specific
  itemDescription?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'received' | 'cancelled';
  receiptUrl?: string;
  invoiceUrl?: string;
  client?: string;
  // Photo-specific
  photoUrl?: string;
  photoUrls?: string[]; // Array for multiple photos (max 9)
  uploadedByName?: string;
}

type SortField = 'date' | 'amount' | 'staffName' | 'projectName';
type SortDirection = 'asc' | 'desc';

const ActivityLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'assignment' | 'reimbursement' | 'income' | 'photo'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'received' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Projects list for filtering
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    staffId?: string;
    projectId: string;
    date: string;
    taskDescription?: string;
    dailyRate?: number;
    notes?: string;
    itemDescription?: string;
    amount?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'received' | 'cancelled';
    description?: string; // For photos (will be replaced with notes)
  } | null>(null);

  // Track expanded months (initialize with current month)
  const [expandedMonths] = useState<Set<string>>(() => {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return new Set([currentMonth]);
  });

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

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
      
      // Load task assignments
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        orderBy('createdAt', 'desc')
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData: ActivityLog[] = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'assignment',
          date: data.date || '',
          staffId: data.staffId || '',
          staffName: data.staffName || 'Unknown Staff',
          projectId: data.projectId || '',
          projectName: data.projectName || 'Unknown Project',
          description: data.taskDescription || '',
          taskDescription: data.taskDescription || '',
          dailyRate: data.dailyRate || 0,
          createdAt: data.createdAt
        };
      });
      
      // Load expenses (from reimbursements collection - kept for backward compatibility)
      const reimbursementsQuery = query(
        collection(db, 'reimbursements'),
        orderBy('createdAt', 'desc')
      );
      const expensesSnapshot = await getDocs(reimbursementsQuery);
      const expensesData: ActivityLog[] = expensesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'reimbursement',
          date: data.date || '',
          staffId: data.staffId || '',
          staffName: data.staffName || 'Unknown Staff',
          projectId: data.projectId || undefined,
          projectName: data.projectName || undefined,
          description: data.itemDescription || '',
          itemDescription: data.itemDescription || '',
          amount: data.amount || 0,
          status: data.status || 'pending',
          receiptUrl: data.receiptUrl || undefined,
          createdAt: data.createdAt
        };
      });
      
      // Load incomes
      const incomesQuery = query(
        collection(db, 'incomes'),
        orderBy('createdAt', 'desc')
      );
      const incomesSnapshot = await getDocs(incomesQuery);
      const incomesData: ActivityLog[] = incomesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'income',
          date: data.date || '',
          projectId: data.projectId || undefined,
          projectName: data.projectName || undefined,
          description: data.category || '',
          amount: data.amount || 0,
          status: data.status || 'pending',
          invoiceUrl: data.invoiceUrl || undefined,
          client: data.client || undefined,
          createdAt: data.createdAt
        };
      });
      
      // Load project photos
      const photosQuery = query(
        collection(db, 'projectPhotos'),
        orderBy('createdAt', 'desc')
      );
      const photosSnapshot = await getDocs(photosQuery);
      const photosData: ActivityLog[] = photosSnapshot.docs.map(doc => {
        const data = doc.data();
        // Support both single photoUrl (backward compatibility) and photoUrls array
        const photoUrls = data.photoUrls || (data.photoUrl ? [data.photoUrl] : []);
        return {
          id: doc.id,
          type: 'photo',
          date: data.date || '',
          projectId: data.projectId || '',
          projectName: data.projectName || 'Unknown Project',
          description: data.description || '',
          photoUrl: data.photoUrl || photoUrls[0] || '', // For backward compatibility
          photoUrls: photoUrls, // Array of photo URLs
          uploadedByName: data.uploadedByName || 'Unknown User',
          createdAt: data.createdAt
        };
      });
      
      // Combine and sort by creation date
      const allActivities = [...assignmentsData, ...expensesData, ...incomesData, ...photosData];
      allActivities.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return bTime - aTime;
      });
      
      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for formatting (used in search filter)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Filter and sort activities
  const filteredAndSortedActivities = useMemo(() => {
    let filtered = [...activities];
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(activity => activity.type === typeFilter);
    }
    
    // Apply staff filter (photos don't have staff, so exclude them when filtering by staff)
    if (staffFilter !== 'all') {
      filtered = filtered.filter(activity => 
        activity.type !== 'photo' && activity.staffId === staffFilter
      );
    }
    
    // Apply project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(activity => activity.projectId === projectFilter);
    }
    
    // Apply status filter (for reimbursements and income)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(activity => 
        (activity.type === 'reimbursement' || activity.type === 'income') ? activity.status === statusFilter : true
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(activity => {
        // Search in description
        const description = activity.description?.toLowerCase() || '';
        if (description.includes(query)) return true;
        
        // Search in task description (for assignments)
        const taskDescription = activity.taskDescription?.toLowerCase() || '';
        if (taskDescription.includes(query)) return true;
        
        // Search in item description (for reimbursements)
        const itemDescription = activity.itemDescription?.toLowerCase() || '';
        if (itemDescription.includes(query)) return true;
        
        // Search in staff name
        const staffName = activity.staffName?.toLowerCase() || '';
        if (staffName.includes(query)) return true;
        
        // Search in project name
        const projectName = activity.projectName?.toLowerCase() || '';
        if (projectName.includes(query)) return true;
        
        // Search in uploaded by name (for photos)
        const uploadedByName = activity.uploadedByName?.toLowerCase() || '';
        if (uploadedByName.includes(query)) return true;
        
        // Search in amount (convert to string)
        if (activity.amount !== undefined) {
          const amountStr = activity.amount.toString();
          if (amountStr.includes(query)) return true;
          // Also check formatted currency
          const formattedAmount = formatCurrency(activity.amount).toLowerCase();
          if (formattedAmount.includes(query)) return true;
        }
        
        // Search in daily rate (for assignments)
        if (activity.dailyRate !== undefined) {
          const dailyRateStr = activity.dailyRate.toString();
          if (dailyRateStr.includes(query)) return true;
          // Also check formatted currency
          const formattedRate = formatCurrency(activity.dailyRate).toLowerCase();
          if (formattedRate.includes(query)) return true;
        }
        
        // Search in date (try multiple formats)
        if (activity.date) {
          try {
            const date = new Date(activity.date);
            // Check formatted date string
            const dateStr = formatDate(activity.date).toLowerCase();
            if (dateStr.includes(query)) return true;
            
            // Check ISO date string
            const isoDate = activity.date.toLowerCase();
            if (isoDate.includes(query)) return true;
            
            // Check month/year format
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase();
            if (monthYear.includes(query)) return true;
            
            // Check full date string
            const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
            if (fullDate.includes(query)) return true;
          } catch {
            // If date parsing fails, just check the raw date string
            if (activity.date.toLowerCase().includes(query)) return true;
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
        case 'amount':
          aValue = a.amount || 0;
          bValue = b.amount || 0;
          break;
        case 'staffName':
          aValue = a.staffName || '';
          bValue = b.staffName || '';
          break;
        case 'projectName':
          aValue = a.projectName || '';
          bValue = b.projectName || '';
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
  }, [activities, typeFilter, staffFilter, projectFilter, statusFilter, searchQuery, sortField, sortDirection]);

  // Group activities by month
  const activitiesByMonth = useMemo(() => {
    const grouped: Record<string, ActivityLog[]> = {};
    
    filteredAndSortedActivities.forEach(activity => {
      if (!activity.date) return;
      try {
        const date = new Date(activity.date);
        const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!grouped[monthStr]) {
          grouped[monthStr] = [];
        }
        grouped[monthStr].push(activity);
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
    
    // Return as array of [month, activities] tuples for easy iteration
    return sortedMonths.map(month => [month, grouped[month]] as [string, ActivityLog[]]);
  }, [filteredAndSortedActivities]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved':
      case 'received':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleStartEdit = (activity: ActivityLog) => {
    setEditingId(activity.id);
    const selectedStaff = staff.find(s => s.id === activity.staffId);
    const notes = activity.description || activity.taskDescription || '';
    setEditFormData({
      staffId: activity.staffId,
      projectId: activity.projectId || '',
      date: activity.date,
      taskDescription: activity.taskDescription,
      dailyRate: activity.dailyRate,
      notes: notes,
      itemDescription: activity.itemDescription,
      amount: activity.amount,
      status: activity.status,
      description: activity.description // For photos (kept for backward compatibility, will use notes)
    });
    setShowNotesField(!!notes);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
    setShowNotesField(false);
  };

  const handleDelete = async () => {
    if (!editingId || !currentUser) return;

    const activity = activities.find(a => a.id === editingId);
    if (!activity) return;

    if (!confirm(`Are you sure you want to delete this ${activity.type}? This action cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);

      if (activity.type === 'assignment') {
        // Delete assignment
        await deleteDoc(doc(db, 'taskAssignments', editingId));

        // Update project costs if project exists (don't block deletion if project is deleted)
        if (activity.projectId) {
          try {
            await updateProjectActualCost(activity.projectId);
          } catch (costUpdateError) {
            console.warn('Could not update project costs (project may not exist):', costUpdateError);
            // Continue with deletion even if cost update fails
          }
        }
      } else if (activity.type === 'reimbursement') {
        // Delete reimbursement
        await deleteDoc(doc(db, 'reimbursements', editingId));

        // Update project costs if project exists (don't block deletion if project is deleted)
        if (activity.projectId) {
          try {
            await updateProjectActualCost(activity.projectId);
          } catch (costUpdateError) {
            console.warn('Could not update project costs (project may not exist):', costUpdateError);
            // Continue with deletion even if cost update fails
          }
        }
      } else if (activity.type === 'income') {
        // Delete income
        await deleteDoc(doc(db, 'incomes', editingId));

        // Update project revenue if project exists (don't block deletion if project is deleted)
        if (activity.projectId) {
          try {
            await updateProjectActualRevenue(activity.projectId);
          } catch (revenueUpdateError) {
            console.warn('Could not update project revenue (project may not exist):', revenueUpdateError);
            // Continue with deletion even if revenue update fails
          }
        }
      } else if (activity.type === 'photo') {
        // Delete photo entry
        await deleteDoc(doc(db, 'projectPhotos', editingId));
        // Note: Photo file in storage is not deleted to avoid breaking references
        // If you want to delete the file too, you'd need to use Firebase Storage deleteObject
      }

      // Reload data to reflect changes
      await loadData();
      handleCancelEdit();
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('Failed to delete entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editFormData || !currentUser) return;

    const activity = activities.find(a => a.id === editingId);
    if (!activity) return;

    try {
      setSaving(true);

      if (activity.type === 'assignment') {
        // Validate assignment fields
        if (!editFormData.staffId) {
          alert('Please fill in all required fields');
          return;
        }

        const selectedStaff = staff.find(s => s.id === editFormData.staffId);
        const selectedProject = projects.find(p => p.id === editFormData.projectId);

        const updateData: any = {
          staffId: editFormData.staffId,
          staffName: selectedStaff?.name || activity.staffName,
          projectId: editFormData.projectId || null,
          projectName: selectedProject?.name || null,
          date: editFormData.date,
          taskDescription: editFormData.notes?.trim() || '',
          dailyRate: typeof editFormData.dailyRate === 'number' ? editFormData.dailyRate : activity.dailyRate || 0,
          updatedAt: serverTimestamp()
        };

        // Update assignment
        await updateDoc(doc(db, 'taskAssignments', editingId), updateData);

        // Update project costs if project changed
        const oldProjectId = activity.projectId;
        if (oldProjectId !== editFormData.projectId) {
          if (oldProjectId) await updateProjectActualCost(oldProjectId);
          if (editFormData.projectId) await updateProjectActualCost(editFormData.projectId);
        } else if (editFormData.projectId) {
          await updateProjectActualCost(editFormData.projectId);
        }
      } else if (activity.type === 'reimbursement') {
        // Validate reimbursement fields
        if (!editFormData.staffId || !editFormData.itemDescription?.trim() || !editFormData.amount || editFormData.amount <= 0) {
          alert('Please fill in all required fields');
          return;
        }

        const selectedStaff = staff.find(s => s.id === editFormData.staffId);
        const selectedProject = projects.find(p => p.id === editFormData.projectId);

        const updateData: any = {
          staffId: editFormData.staffId,
          staffName: selectedStaff?.name || activity.staffName,
          projectId: editFormData.projectId || null,
          projectName: selectedProject?.name || null,
          date: editFormData.date,
          itemDescription: editFormData.itemDescription.trim(),
          amount: editFormData.amount,
          status: editFormData.status || 'pending',
          updatedAt: serverTimestamp()
        };

        // Update reimbursement
        await updateDoc(doc(db, 'reimbursements', editingId), updateData);

        // Update project costs if project changed
        const oldProjectId = activity.projectId;
        if (oldProjectId !== editFormData.projectId) {
          if (oldProjectId) await updateProjectActualCost(oldProjectId);
          if (editFormData.projectId) await updateProjectActualCost(editFormData.projectId);
        } else if (editFormData.projectId) {
          await updateProjectActualCost(editFormData.projectId);
        }
      } else if (activity.type === 'income') {
        // Validate income fields
        if (!editFormData.itemDescription) {
          alert('Please fill in all required fields');
          return;
        }

        const selectedProject = projects.find(p => p.id === editFormData.projectId);

        const updateData: any = {
          projectId: editFormData.projectId || null,
          projectName: selectedProject?.name || null,
          date: editFormData.date,
          category: editFormData.itemDescription.trim(),
          amount: editFormData.amount,
          status: editFormData.status || 'pending',
          updatedAt: serverTimestamp()
        };

        // Update income
        await updateDoc(doc(db, 'incomes', editingId), updateData);

        // Update project revenue if project changed
        const oldProjectId = activity.projectId;
        if (oldProjectId !== editFormData.projectId) {
          if (oldProjectId) await updateProjectActualRevenue(oldProjectId);
          if (editFormData.projectId) await updateProjectActualRevenue(editFormData.projectId);
        } else if (editFormData.projectId) {
          await updateProjectActualRevenue(editFormData.projectId);
        }
      } else if (activity.type === 'photo') {
        // Validate photo fields
        if (!editFormData.projectId) {
          alert('Please fill in all required fields (project)');
          setSaving(false);
          return;
        }

        const selectedProject = projects.find(p => p.id === editFormData.projectId);

        const updateData: any = {
          projectId: editFormData.projectId,
          projectName: selectedProject?.name || activity.projectName,
          date: editFormData.date,
          description: editFormData.notes?.trim() || '',
          updatedAt: serverTimestamp()
        };

        // Update photo entry
        await updateDoc(doc(db, 'projectPhotos', editingId), updateData);
      }

      // Reload data to reflect changes
      await loadData();
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating activity:', error);
      alert('Failed to update entry. Please try again.');
    } finally {
      setSaving(false);
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

  if (!currentUser || !userProfile) {
    return (
      <Layout title="Activity Logs" currentRole="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Activity Logs" currentRole="admin">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Track staff assignments and reimbursements</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full sm:w-auto">
            Back to Dashboard
          </Button>
        </div>

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
              placeholder="Search by description, name, amount, date, project..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
              >
                <option value="all">All Types</option>
                <option value="assignment">Assignments</option>
                <option value="reimbursement">Expenses</option>
                <option value="income">Income</option>
                <option value="photo">Photos</option>
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
            
            {typeFilter === 'reimbursement' || typeFilter === 'income' || typeFilter === 'all' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  {typeFilter === 'reimbursement' || typeFilter === 'all' ? (
                    <>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </>
                  ) : null}
                  {typeFilter === 'income' || typeFilter === 'all' ? (
                    <>
                      <option value="received">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  ) : null}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex items-center space-x-4 pt-3">
                  <SortButton field="date" label="Date" />
                  <SortButton field="amount" label="Amount" />
                  <SortButton field="staffName" label="Staff" />
                </div>
              </div>
            )}
          </div>
          
          {/* Sort controls (when status filter is shown) */}
          {typeFilter === 'reimbursement' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="flex flex-wrap items-center gap-3">
                <SortButton field="date" label="Date" />
                <SortButton field="amount" label="Amount" />
                <SortButton field="staffName" label="Staff" />
                <SortButton field="projectName" label="Project" />
              </div>
            </div>
          )}
        </Card>

        {/* Activity List */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Activities ({filteredAndSortedActivities.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
              <SortButton field="date" label="Date" />
              {typeFilter === 'all' || typeFilter === 'reimbursement' ? (
                <SortButton field="amount" label="Amount" />
              ) : null}
              <SortButton field="staffName" label="Staff" />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">Loading activities...</p>
            </div>
          ) : filteredAndSortedActivities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-gray-500 text-sm">No activities found</p>
              <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activitiesByMonth.map(([month, monthActivities]) => (
                <CollapsibleSection
                  key={month}
                  title={month}
                  count={monthActivities.length}
                  defaultExpanded={expandedMonths.has(month)}
                  className="bg-white"
                >
                  <div className="space-y-2">
                    {monthActivities.map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => editingId !== activity.id && handleStartEdit(activity)}
                        className="p-2 sm:p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors cursor-pointer"
                      >
                  {editingId === activity.id && editFormData ? (
                    // Edit Form
                    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          activity.type === 'assignment'
                            ? 'bg-blue-100 text-blue-800'
                            : activity.type === 'reimbursement'
                            ? 'bg-green-100 text-green-800'
                            : activity.type === 'income'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {activity.type === 'assignment' ? '📋 Assignment' : activity.type === 'reimbursement' ? '💰 Expense' : activity.type === 'income' ? '💵 Income' : '📸 Photo'}
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
                            onClick={handleDelete}
                            disabled={saving}
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 min-h-[44px] flex-1 sm:flex-none"
                          >
                            {saving ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Photo/Receipt/Invoice Preview in Edit Mode */}
                      {activity.type === 'photo' && ((activity.photoUrls && activity.photoUrls.length > 0) || activity.photoUrl) && (
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">Photos</label>
                          <div className="grid grid-cols-3 sm:flex sm:flex-nowrap gap-1.5">
                            {(activity.photoUrls || (activity.photoUrl ? [activity.photoUrl] : [])).slice(0, 9).map((url, index) => (
                              <img
                                key={index}
                                src={url}
                                alt={`Photo ${index + 1}${activity.description ? ` - ${activity.description}` : ''}`}
                                className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(url, '_blank');
                                }}
                              />
                            ))}
                          </div>
                          {(activity.photoUrls && activity.photoUrls.length > 9) && (
                            <p className="text-xs text-gray-500 mt-1">
                              +{activity.photoUrls.length - 9} more photos
                            </p>
                          )}
                        </div>
                      )}
                      {activity.type === 'reimbursement' && activity.receiptUrl && (
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">Receipt</label>
                          <img
                            src={activity.receiptUrl}
                            alt="Receipt"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(activity.receiptUrl, '_blank');
                            }}
                          />
                        </div>
                      )}
                      {activity.type === 'income' && activity.invoiceUrl && (
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">Invoice</label>
                          <img
                            src={activity.invoiceUrl}
                            alt="Invoice"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(activity.invoiceUrl, '_blank');
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activity.type !== 'photo' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Staff</label>
                            <select
                              value={editFormData.staffId || ''}
                              onChange={(e) => {
                                const selectedStaff = staff.find(s => s.id === e.target.value);
                                setEditFormData({
                                  ...editFormData, 
                                  staffId: e.target.value,
                                  // Auto-update daily rate if editing assignment and staff changed
                                  dailyRate: activity.type === 'assignment' && selectedStaff 
                                    ? selectedStaff.dailyRate 
                                    : editFormData.dailyRate
                                });
                              }}
                              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px]"
                            >
                              {staff.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
                          <select
                            value={editFormData.projectId}
                            onChange={(e) => setEditFormData({...editFormData, projectId: e.target.value})}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">No Project</option>
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
                        
                        {/* Optional Fields - Toggleable */}
                        <div className="sm:col-span-2 flex flex-wrap gap-2 mb-3">
                          {!showNotesField && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowNotesField(true)}
                              className="text-xs"
                            >
                              + Add Notes
                            </Button>
                          )}
                        </div>

                        {/* Notes Field */}
                        {showNotesField && (
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-gray-700">Notes</label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowNotesField(false);
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

                        {activity.type === 'photo' ? null : activity.type === 'assignment' ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Daily Rate ($)</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editFormData.dailyRate || ''}
                              onChange={(e) => setEditFormData({...editFormData, dailyRate: parseFloat(e.target.value) || 0})}
                              className="text-sm"
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editFormData.amount || ''}
                                onChange={(e) => setEditFormData({...editFormData, amount: parseFloat(e.target.value) || 0})}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                              <select
                                value={editFormData.status || 'pending'}
                                onChange={(e) => setEditFormData({...editFormData, status: e.target.value as any})}
                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px]"
                              >
                                {activity.type === 'income' ? (
                                  <>
                                    <option value="pending">Pending</option>
                                    <option value="received">Received</option>
                                    <option value="cancelled">Cancelled</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                  </>
                                )}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Item Description</label>
                              <Input
                                value={editFormData.itemDescription || ''}
                                onChange={(e) => setEditFormData({...editFormData, itemDescription: e.target.value})}
                                className="text-sm"
                                placeholder="Enter item description..."
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Display View
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                            activity.type === 'assignment'
                              ? 'bg-blue-100 text-blue-800'
                              : activity.type === 'reimbursement'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {activity.type === 'assignment' ? '📋 Assignment' : activity.type === 'reimbursement' ? '💰 Expense' : '📸 Photo'}
                          </span>
                          {activity.status && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>
                              {activity.status}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(activity.date)}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        {activity.type === 'photo' ? (
                          <>
                            {(activity.photoUrls && activity.photoUrls.length > 0) || activity.photoUrl ? (
                              <div className="mb-1.5">
                                <div className="grid grid-cols-3 sm:flex sm:flex-nowrap gap-1.5">
                                  {(activity.photoUrls || (activity.photoUrl ? [activity.photoUrl] : [])).slice(0, 9).map((url, index) => (
                                    <img
                                      key={index}
                                      src={url}
                                      alt={`Photo ${index + 1}${activity.description ? ` - ${activity.description}` : ''}`}
                                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(url, '_blank');
                                      }}
                                    />
                                  ))}
                                </div>
                                {(activity.photoUrls && activity.photoUrls.length > 9) && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    +{activity.photoUrls.length - 9} more photos
                                  </p>
                                )}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                              <span className="font-medium text-gray-900">
                                {activity.uploadedByName || 'Unknown User'}
                              </span>
                              {activity.projectName && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500">{activity.projectName}</span>
                                </>
                              )}
                            </div>
                            {activity.description && (
                              <p className="text-xs text-gray-600 break-words mt-0.5">
                                {activity.description}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {activity.type === 'reimbursement' && activity.receiptUrl && (
                              <div className="mb-1.5">
                                <img
                                  src={activity.receiptUrl}
                                  alt="Receipt"
                                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(activity.receiptUrl, '_blank');
                                  }}
                                />
                              </div>
                            )}
                            {activity.type === 'income' && activity.invoiceUrl && (
                              <div className="mb-1.5">
                                <img
                                  src={activity.invoiceUrl}
                                  alt="Invoice"
                                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(activity.invoiceUrl, '_blank');
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                              <span className="font-medium text-gray-900">
                                {activity.staffName}
                              </span>
                              {activity.projectName && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500">{activity.projectName}</span>
                                </>
                              )}
                              {activity.type === 'assignment' && activity.dailyRate !== undefined && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-600">
                                    <span className="font-medium">{formatCurrency(activity.dailyRate)}/day</span>
                                  </span>
                                </>
                              )}
                              {activity.type === 'reimbursement' && activity.amount !== undefined && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-600">
                                    <span className="font-medium text-green-600">{formatCurrency(activity.amount)}</span>
                                  </span>
                                </>
                              )}
                            </div>
                            {(activity.type === 'assignment' 
                              ? activity.taskDescription || activity.description
                              : activity.itemDescription || activity.description) && (
                              <p className="text-xs text-gray-600 break-words mt-0.5">
                                {activity.type === 'assignment' 
                                  ? activity.taskDescription || activity.description
                                  : activity.itemDescription || activity.description}
                              </p>
                            )}
                          </>
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
    </Layout>
  );
};

export default ActivityLogsPage;

