import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { sendPhaseUpdateEmails } from '../lib/emailNotifications';
import { usePushNotifications } from '../lib/usePushNotifications';
import { getProjectCostBreakdown, updateProjectActualCost } from '../lib/projectCosts';
import { getProjectRevenueBreakdown, updateProjectActualRevenue } from '../lib/projectRevenue';
import type { Expense, StaffMember, Income } from '../lib/types';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CollapsibleSection from '../components/ui/CollapsibleSection';

const phases = ['Sales','Contract','Materials','Construction','Completion'] as const;
type Phase = typeof phases[number];

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
  photoUrls?: string[];
  uploadedByName?: string;
}

type SortField = 'date' | 'amount' | 'staffName';
type SortDirection = 'asc' | 'desc';


const ProjectPage: React.FC = () => {
  const { id } = useParams();
  const { currentUser, permissions } = useAuth();
  const navigate = useNavigate();
  const { showProjectNotification } = usePushNotifications();
  
  console.log('ProjectPage: Rendered with project ID:', id);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [phase, setPhase] = useState<Phase>('Sales');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhase, setEditPhase] = useState<Phase>('Sales');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Activity Log state
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  
  // Filter and sort state
  const [typeFilter, setTypeFilter] = useState<'all' | 'assignment' | 'reimbursement' | 'income' | 'photo'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'received' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activitySaving, setActivitySaving] = useState(false);
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
    description?: string;
  } | null>(null);
  
  // Track expanded months
  const [expandedMonths] = useState<Set<string>>(() => {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return new Set([currentMonth]);
  });
  
  const [showFinancialForm, setShowFinancialForm] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [budget, setBudget] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [actualRevenue, setActualRevenue] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [submittingFinancial, setSubmittingFinancial] = useState(false);
  const [revenueBreakdown, setRevenueBreakdown] = useState<{
    totalRevenue: number;
    pendingRevenue: number;
    cancelledRevenue: number;
  } | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<{
    totalWages: number;
    totalReimbursements: number; // Kept for backward compatibility with cost breakdown
    totalActualCost: number;
    budget: number;
    remaining: number;
    percentUsed: number;
  } | null>(null);
  
  // Expense management state (now loads from reimbursements collection)
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const ref = doc(db, 'projects', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setProjectName(data.name || 'Project');
        setProjectDescription(data.description || '');
        setPhase((data.phase as Phase) || 'Sales');
        setEditName(data.name || 'Project');
        setEditDescription(data.description || '');
        setEditPhase((data.phase as Phase) || 'Sales');
        
        // Load financial data
        setBudget(data.budget || 0);
        setActualCost(data.actualCost || 0);
        setActualRevenue(data.actualRevenue || 0);
        setStartDate(data.startDate ? (data.startDate.toDate ? data.startDate.toDate().toISOString().split('T')[0] : new Date(data.startDate).toISOString().split('T')[0]) : '');
        setEndDate(data.endDate ? (data.endDate.toDate ? data.endDate.toDate().toISOString().split('T')[0] : new Date(data.endDate).toISOString().split('T')[0]) : '');
        
        // Load cost breakdown (wages + reimbursements)
        await loadCostBreakdown();
        // Load revenue breakdown
        await loadRevenueBreakdown();
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Fetch expenses with real-time updates (from reimbursements collection where staffId is null)
  useEffect(() => {
    if (!id) return;

    const expensesRef = collection(db, 'reimbursements');
    const q = query(
      expensesRef, 
      where('projectId', '==', id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Expenses snapshot received:', snapshot.docs.length, 'documents');
      const allEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Expense));
      
      // Filter to only expenses (no staffId)
      const expensesData = allEntries.filter(entry => !entry.staffId || !entry.staffName);
      
      console.log('Expenses data:', expensesData);
      setExpenses(expensesData);
      setExpensesLoading(false);
    }, (error) => {
      console.error('Error fetching expenses:', error);
      setExpensesLoading(false);
    });

    return () => unsubscribe();
  }, [id]);


  // Load activity data when component mounts or project changes
  useEffect(() => {
    if (id && projectName) {
      loadActivityData();
    }
  }, [id, projectName]);

  // Helper functions for formatting
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
        
        // Search in uploaded by name (for photos)
        const uploadedByName = activity.uploadedByName?.toLowerCase() || '';
        if (uploadedByName.includes(query)) return true;
        
        // Search in amount (convert to string)
        if (activity.amount !== undefined) {
          const amountStr = activity.amount.toString();
          if (amountStr.includes(query)) return true;
          const formattedAmount = formatCurrency(activity.amount).toLowerCase();
          if (formattedAmount.includes(query)) return true;
        }
        
        // Search in daily rate (for assignments)
        if (activity.dailyRate !== undefined) {
          const dailyRateStr = activity.dailyRate.toString();
          if (dailyRateStr.includes(query)) return true;
          const formattedRate = formatCurrency(activity.dailyRate).toLowerCase();
          if (formattedRate.includes(query)) return true;
        }
        
        // Search in date
        if (activity.date) {
          try {
            const dateStr = formatDate(activity.date).toLowerCase();
            if (dateStr.includes(query)) return true;
            const isoDate = activity.date.toLowerCase();
            if (isoDate.includes(query)) return true;
          } catch {
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
  }, [activities, typeFilter, staffFilter, statusFilter, searchQuery, sortField, sortDirection]);

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

  const handleActivityStartEdit = (activity: ActivityLog) => {
    setEditingId(activity.id);
    const notes = activity.description || activity.taskDescription || '';
    setEditFormData({
      staffId: activity.staffId,
      projectId: activity.projectId || id || '',
      date: activity.date,
      taskDescription: activity.taskDescription,
      dailyRate: activity.dailyRate,
      notes: notes,
      itemDescription: activity.itemDescription,
      amount: activity.amount,
      status: activity.status,
      description: activity.description
    });
    setShowNotesField(!!notes);
  };

  const handleActivityCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
    setShowNotesField(false);
  };

  const handleActivityDelete = async () => {
    if (!editingId || !currentUser || !id) return;

    const activity = activities.find(a => a.id === editingId);
    if (!activity) return;

    if (!confirm(`Are you sure you want to delete this ${activity.type}? This action cannot be undone.`)) {
      return;
    }

    try {
      setActivitySaving(true);

      if (activity.type === 'assignment') {
        await deleteDoc(doc(db, 'taskAssignments', editingId));
        await updateProjectActualCost(id);
      } else if (activity.type === 'reimbursement') {
        await deleteDoc(doc(db, 'reimbursements', editingId));
        await updateProjectActualCost(id);
      } else if (activity.type === 'income') {
        await deleteDoc(doc(db, 'incomes', editingId));
        await updateProjectActualRevenue(id);
      } else if (activity.type === 'photo') {
        await deleteDoc(doc(db, 'projectPhotos', editingId));
      }

      await loadActivityData();
      await loadCostBreakdown();
      await loadRevenueBreakdown();
      handleActivityCancelEdit();
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('Failed to delete entry. Please try again.');
    } finally {
      setActivitySaving(false);
    }
  };

  const handleActivitySaveEdit = async () => {
    if (!editingId || !editFormData || !currentUser || !id) return;

    const activity = activities.find(a => a.id === editingId);
    if (!activity) return;

    try {
      setActivitySaving(true);

      if (activity.type === 'assignment') {
        if (!editFormData.staffId) {
          alert('Please fill in all required fields');
          setActivitySaving(false);
          return;
        }

        const selectedStaff = staff.find(s => s.id === editFormData.staffId);

        const updateData: any = {
          staffId: editFormData.staffId,
          staffName: selectedStaff?.name || activity.staffName,
          projectId: id,
          projectName: projectName,
          date: editFormData.date,
          taskDescription: editFormData.notes?.trim() || '',
          dailyRate: typeof editFormData.dailyRate === 'number' ? editFormData.dailyRate : activity.dailyRate || 0,
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'taskAssignments', editingId), updateData);
        await updateProjectActualCost(id);
      } else if (activity.type === 'reimbursement') {
        if (!editFormData.itemDescription?.trim() || !editFormData.amount || editFormData.amount <= 0) {
          alert('Please fill in all required fields');
          setActivitySaving(false);
          return;
        }

        const selectedStaff = editFormData.staffId ? staff.find(s => s.id === editFormData.staffId) : null;

        const updateData: any = {
          staffId: editFormData.staffId || null,
          staffName: selectedStaff?.name || null,
          projectId: id,
          projectName: projectName,
          date: editFormData.date,
          itemDescription: editFormData.itemDescription.trim(),
          amount: editFormData.amount,
          status: editFormData.status || 'pending',
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'reimbursements', editingId), updateData);
        await updateProjectActualCost(id);
      } else if (activity.type === 'income') {
        if (!editFormData.itemDescription?.trim()) {
          alert('Please fill in all required fields');
          setActivitySaving(false);
          return;
        }

        const updateData: any = {
          projectId: id,
          projectName: projectName,
          date: editFormData.date,
          category: editFormData.itemDescription.trim(),
          amount: editFormData.amount || 0,
          status: editFormData.status || 'pending',
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'incomes', editingId), updateData);
        await updateProjectActualRevenue(id);
      } else if (activity.type === 'photo') {
        const updateData: any = {
          projectId: id,
          projectName: projectName,
          date: editFormData.date,
          description: editFormData.notes?.trim() || '',
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'projectPhotos', editingId), updateData);
      }

      await loadActivityData();
      await loadCostBreakdown();
      await loadRevenueBreakdown();
      handleActivityCancelEdit();
    } catch (error) {
      console.error('Error updating activity:', error);
      alert('Failed to update entry. Please try again.');
    } finally {
      setActivitySaving(false);
    }
  };

  // Load cost breakdown for project
  const loadCostBreakdown = async () => {
    if (!id) return;
    try {
      const breakdown = await getProjectCostBreakdown(id);
      setCostBreakdown(breakdown);
      // Update actualCost to match the breakdown
      setActualCost(breakdown.totalActualCost);
      console.log('Cost breakdown loaded:', breakdown);
    } catch (error) {
      console.error('Error loading cost breakdown:', error);
    }
  };

  const loadRevenueBreakdown = async () => {
    if (!id) return;
    try {
      const breakdown = await getProjectRevenueBreakdown(id);
      setRevenueBreakdown(breakdown);
      // Update actualRevenue to match the breakdown
      setActualRevenue(breakdown.totalRevenue);
      console.log('Revenue breakdown loaded:', breakdown);
    } catch (error) {
      console.error('Error loading revenue breakdown:', error);
    }
  };

  // Load users for task assignment

  // Load comments for all tasks in this project

  // Load tasks for this project

  // Create a new task

  // Toggle task completion status

  // Create a new recurring task based on the completed task

  // Calculate task statistics

  // Generate task completion report

  // Export report as CSV

  // Export report as PDF (simple text-based PDF)

  // Filter tasks based on current filter

  // Financial management functions
  const handleUpdateFinancials = async () => {
    if (!id || !currentUser) return;

    setSubmittingFinancial(true);
    try {
      await updateDoc(doc(db, 'projects', id), {
        budget: budget,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        updatedAt: serverTimestamp(),
      });

      setShowFinancialForm(false);
      showProjectNotification('Financial information updated successfully', projectName);
    } catch (error) {
      console.error('Error updating financial information:', error);
    } finally {
      setSubmittingFinancial(false);
    }
  };

  const generateFinancialReport = () => {
    const variance = budget - actualCost;
    const variancePercentage = budget > 0 ? ((variance / budget) * 100) : 0;
    const isOverBudget = actualCost > budget;
    const netProfit = actualRevenue - actualCost;
    const profitMargin = actualRevenue > 0 ? ((netProfit / actualRevenue) * 100) : 0;

    const report = {
      projectName,
      generatedAt: new Date().toISOString(),
      budget,
      actualCost,
      actualRevenue,
      netProfit,
      profitMargin: Math.round(profitMargin * 100) / 100,
      variance,
      variancePercentage: Math.round(variancePercentage * 100) / 100,
      isOverBudget,
      startDate: startDate ? new Date(startDate).toLocaleDateString() : 'Not set',
      endDate: endDate ? new Date(endDate).toLocaleDateString() : 'Not set',
      remainingBudget: Math.max(0, budget - actualCost),
      budgetUtilization: budget > 0 ? Math.round((actualCost / budget) * 100) : 0,
    };

    setReportData(report);
    setShowFinancialReport(true);
  };

  const exportFinancialToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      ['Project Financial Report', ''],
      ['Project Name', reportData.projectName],
      ['Generated At', new Date(reportData.generatedAt).toLocaleString()],
      [''],
      ['Financial Summary', ''],
      ['Budget', `$${reportData.budget.toLocaleString()}`],
      ['Actual Cost', `$${reportData.actualCost.toLocaleString()}`],
      ['Actual Revenue', `$${(reportData.actualRevenue || 0).toLocaleString()}`],
      ['Net Profit', `$${(reportData.netProfit || 0).toLocaleString()}`],
      ['Profit Margin', `${(reportData.profitMargin || 0).toFixed(1)}%`],
      ['Variance', `$${reportData.variance.toLocaleString()}`],
      ['Variance Percentage', `${reportData.variancePercentage}%`],
      ['Remaining Budget', `$${reportData.remainingBudget.toLocaleString()}`],
      ['Budget Utilization', `${reportData.budgetUtilization}%`],
      ['Status', reportData.isOverBudget ? 'Over Budget' : 'Within Budget'],
      [''],
      ['Project Timeline', ''],
      ['Start Date', reportData.startDate],
      ['End Date', reportData.endDate],
    ].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFinancialToPDF = () => {
    if (!reportData) return;

    const pdfContent = `
Project Financial Report
======================

Project: ${reportData.projectName}
Generated: ${new Date(reportData.generatedAt).toLocaleString()}

FINANCIAL SUMMARY
-----------------
Budget: $${reportData.budget.toLocaleString()}
Actual Cost: $${reportData.actualCost.toLocaleString()}
Variance: $${reportData.variance.toLocaleString()} (${reportData.variancePercentage}%)
Remaining Budget: $${reportData.remainingBudget.toLocaleString()}
Budget Utilization: ${reportData.budgetUtilization}%
Status: ${reportData.isOverBudget ? 'OVER BUDGET' : 'Within Budget'}

PROJECT TIMELINE
----------------
Start Date: ${reportData.startDate}
End Date: ${reportData.endDate}

ANALYSIS
--------
${reportData.isOverBudget 
  ? `⚠️  WARNING: Project is over budget by $${Math.abs(reportData.variance).toLocaleString()} (${Math.abs(reportData.variancePercentage)}%)`
  : `✅ Project is within budget with $${reportData.remainingBudget.toLocaleString()} remaining`
}
    `.trim();

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_financial_report_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Expense management functions
  const handleDeleteExpense = async (expenseId: string) => {
    if (!id || !currentUser) return;

    try {
      await deleteDoc(doc(db, 'reimbursements', expenseId));
      
      // Update project actual cost after deleting expense
      await updateProjectActualCost(id);
      
      // Reload cost breakdown to reflect the updated costs
      await loadCostBreakdown();
      
      showProjectNotification('Expense deleted successfully', projectName);
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  // Submit a new comment

  // Get comments for a specific task

  // Submit a reply to a comment

  const handlePhaseChange = async (newPhase: Phase) => {
    if (!id) return;
    const oldPhase = phase;
    setPhase(newPhase);
    await updateDoc(doc(db, 'projects', id), { phase: newPhase, updatedAt: serverTimestamp() });
    
    // Send email notifications for phase update
    try {
      await sendPhaseUpdateEmails({
        name: projectName,
        phase: newPhase
      }, oldPhase, '');
      console.log('ProjectPage: Phase update email notifications sent');
    } catch (emailError) {
      console.error('ProjectPage: Error sending phase update emails:', emailError);
    }
    
    // Show notification
    showProjectNotification(projectName, `moved to ${newPhase} phase`);
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (err) {
      return 'Invalid date';
    }
  };


  const handleEdit = () => {
    setIsEditing(true);
    setEditName(projectName);
    setEditPhase(phase);
    setError('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(projectName);
    setEditDescription(projectDescription);
    setEditPhase(phase);
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!id || !editName.trim()) {
      setError('Project name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateDoc(doc(db, 'projects', id), {
        name: editName.trim(),
        description: editDescription.trim(),
        phase: editPhase,
        updatedAt: serverTimestamp(),
      });

      setProjectName(editName.trim());
      setProjectDescription(editDescription.trim());
      setPhase(editPhase);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  // Activity Log functions
  const loadActivityData = async () => {
    if (!id) {
      setActivitiesLoading(false);
      return;
    }
    
    try {
      setActivitiesLoading(true);
      
      // Load staff members
      const staffSnapshot = await getDocs(collection(db, 'staffMembers'));
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffData);
      
      // Load task assignments for this project
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        where('projectId', '==', id),
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
          projectName: data.projectName || projectName || 'Unknown Project',
          description: data.taskDescription || '',
          taskDescription: data.taskDescription || '',
          dailyRate: data.dailyRate || 0,
          createdAt: data.createdAt
        };
      });
      
      // Load expenses/reimbursements for this project
      const reimbursementsQuery = query(
        collection(db, 'reimbursements'),
        where('projectId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const expensesSnapshot = await getDocs(reimbursementsQuery);
      const expensesData: ActivityLog[] = expensesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'reimbursement',
          date: data.date || '',
          staffId: data.staffId || undefined,
          staffName: data.staffName || undefined,
          projectId: data.projectId || '',
          projectName: data.projectName || projectName || 'Unknown Project',
          description: data.itemDescription || '',
          itemDescription: data.itemDescription || '',
          amount: data.amount || 0,
          status: data.status || 'pending',
          receiptUrl: data.receiptUrl || undefined,
          createdAt: data.createdAt
        };
      });
      
      // Load income entries for this project
      const incomesQuery = query(
        collection(db, 'incomes'),
        where('projectId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const incomesSnapshot = await getDocs(incomesQuery);
      const incomesData: ActivityLog[] = incomesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'income',
          date: data.date || '',
          projectId: data.projectId || '',
          projectName: data.projectName || projectName || 'Unknown Project',
          description: data.category || '',
          amount: data.amount || 0,
          status: data.status || 'pending',
          invoiceUrl: data.invoiceUrl || undefined,
          client: data.client || undefined,
          createdAt: data.createdAt
        };
      });
      
      // Load photo entries for this project
      const photosQuery = query(
        collection(db, 'projectPhotos'),
        where('projectId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const photosSnapshot = await getDocs(photosQuery);
      const photosData: ActivityLog[] = photosSnapshot.docs.map(doc => {
        const data = doc.data();
        const photoUrls = data.photoUrls || (data.photoUrl ? [data.photoUrl] : []);
        return {
          id: doc.id,
          type: 'photo',
          date: data.date || '',
          projectId: data.projectId || '',
          projectName: data.projectName || projectName || 'Unknown Project',
          description: data.description || '',
          photoUrl: data.photoUrl || photoUrls[0] || '',
          photoUrls: photoUrls,
          uploadedByName: data.uploadedByName || 'Unknown User',
          createdAt: data.createdAt
        };
      });
      
      // Combine all activities
      const allActivities = [...assignmentsData, ...expensesData, ...incomesData, ...photosData];
      
      // Sort by creation date
      allActivities.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return bTime - aTime;
      });
      
      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activity data:', error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout title={projectName} currentRole={undefined}>
      <React.Fragment>
        <div className="space-y-4 pb-20">
        {/* Header with project name, description, and phase */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation"
                  aria-label="Back to Dashboard"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">{projectName}</h1>
              </div>
              {projectDescription && (
                <p className="text-gray-600 text-sm leading-relaxed mb-3">{projectDescription}</p>
              )}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">Phase:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                  phase === 'Sales' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  phase === 'Contract' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                  phase === 'Materials' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                  phase === 'Construction' ? 'bg-green-100 text-green-800 border-green-200' :
                  'bg-gray-100 text-gray-800 border-gray-200'
                }`}>
                  {phase}
                </span>
              </div>
            </div>
            <button
              onClick={handleEdit}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors touch-manipulation font-medium"
            >
              Edit Project
            </button>
          </div>
          
          {isEditing ? (
            <div className="space-y-3 p-3 bg-gray-50 rounded-xl">
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  placeholder="Enter project description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                <select
                  value={editPhase}
                  onChange={(e) => setEditPhase(e.target.value as Phase)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {phases.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Update Phase:</span>
              <div className="relative">
                <select 
                  value={phase} 
                  onChange={(e) => handlePhaseChange(e.target.value as Phase)} 
                  className="appearance-none bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 cursor-pointer min-w-[140px]"
                >
                  {phases.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Financial Tracking Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
            <h3 className="text-lg font-semibold text-gray-900">Financial Tracking</h3>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <button
                onClick={() => navigate(`/expenses?projectId=${id}`)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Expense</span>
              </button>
              <button
                onClick={() => setShowFinancialForm(true)}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Update Budget</span>
              </button>
              <button
                onClick={generateFinancialReport}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Financial Report</span>
              </button>
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">${budget.toLocaleString()}</div>
              <div className="text-sm text-blue-800">Total Budget</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">${actualCost.toLocaleString()}</div>
              <div className="text-sm text-orange-800">Actual Cost</div>
              {costBreakdown && (
                <div className="text-xs text-orange-700 mt-1 space-y-0.5">
                  <div>💼 Staff: ${costBreakdown.totalWages.toLocaleString()}</div>
                  <div>💸 Materials: ${costBreakdown.totalReimbursements.toLocaleString()}</div>
                </div>
              )}
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-600">${actualRevenue.toLocaleString()}</div>
              <div className="text-sm text-green-800">Actual Revenue</div>
              {revenueBreakdown && revenueBreakdown.pendingRevenue > 0 && (
                <div className="text-xs text-green-700 mt-1">
                  ⏳ Pending: ${revenueBreakdown.pendingRevenue.toLocaleString()}
                </div>
              )}
            </div>
            <div className={`rounded-xl p-4 border ${(budget - actualCost) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-2xl font-bold ${(budget - actualCost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(budget - actualCost).toLocaleString()}
              </div>
              <div className={`text-sm ${(budget - actualCost) >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {budget >= actualCost ? 'Remaining' : 'Over Budget'}
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">
                {budget > 0 ? Math.round((actualCost / budget) * 100) : 0}%
              </div>
              <div className="text-sm text-purple-800">Budget Used</div>
            </div>
          </div>

          {/* Budget vs Actual Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
              <span className="text-sm font-bold text-gray-900">
                {budget > 0 ? Math.round((actualCost / budget) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  actualCost > budget 
                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                    : 'bg-gradient-to-r from-blue-500 to-green-500'
                }`}
                style={{ 
                  width: `${budget > 0 ? Math.min((actualCost / budget) * 100, 100) : 0}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>$0</span>
              <span>${budget.toLocaleString()}</span>
            </div>
          </div>

          {/* Project Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Project Timeline</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Start Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {startDate ? new Date(startDate).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">End Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {endDate ? new Date(endDate).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Financial Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`text-sm font-medium ${budget >= actualCost ? 'text-green-600' : 'text-red-600'}`}>
                    {budget >= actualCost ? 'Within Budget' : 'Over Budget'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Variance:</span>
                  <span className={`text-sm font-medium ${budget >= actualCost ? 'text-green-600' : 'text-red-600'}`}>
                    {budget >= actualCost ? '+' : '-'}${Math.abs(budget - actualCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Expenses ({expenses.length})</h4>
              {expenses.length > 0 && (
                <div className="text-sm text-gray-500">
                  Showing {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {expensesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <p className="text-gray-500 mb-4">No expenses recorded yet</p>
                <button
                  onClick={() => navigate(`/expenses?projectId=${id}`)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add First Expense
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="text-sm font-medium text-gray-900">{expense.subcategory || expense.itemDescription}</h5>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>${expense.amount.toLocaleString()}</span>
                            <span>{String(expense.date || '')}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete expense"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Activity Log Section */}
          <div className="space-y-4 sm:space-y-6">
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
                  placeholder="Search by description, name, amount, date..."
                  className="pl-10"
                />
              </div>
            </Card>

            {/* Filters */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Filters</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
              {(typeFilter === 'reimbursement' || typeFilter === 'income' || typeFilter === 'all') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <SortButton field="date" label="Date" />
                    <SortButton field="amount" label="Amount" />
                    <SortButton field="staffName" label="Staff" />
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
                  {(typeFilter === 'all' || typeFilter === 'reimbursement' || typeFilter === 'income') && (
                    <SortButton field="amount" label="Amount" />
                  )}
                  <SortButton field="staffName" label="Staff" />
                </div>
              </div>

              {activitiesLoading ? (
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
                            onClick={() => editingId !== activity.id && handleActivityStartEdit(activity)}
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
                                      onClick={handleActivitySaveEdit}
                                      disabled={activitySaving}
                                      size="sm"
                                      variant="outline"
                                      className="min-h-[44px] flex-1 sm:flex-none"
                                    >
                                      {activitySaving ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                      onClick={handleActivityCancelEdit}
                                      disabled={activitySaving}
                                      size="sm"
                                      variant="ghost"
                                      className="min-h-[44px] flex-1 sm:flex-none"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={handleActivityDelete}
                                      disabled={activitySaving}
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-300 hover:bg-red-50 min-h-[44px] flex-1 sm:flex-none"
                                    >
                                      {activitySaving ? 'Deleting...' : 'Delete'}
                                    </Button>
                                  </div>
                                </div>
                                
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
                                            dailyRate: activity.type === 'assignment' && selectedStaff 
                                              ? selectedStaff.dailyRate 
                                              : editFormData.dailyRate
                                          });
                                        }}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px]"
                                      >
                                        <option value="">Select Staff</option>
                                        {staff.map(s => (
                                          <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  
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
                                        : activity.type === 'income'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {activity.type === 'assignment' ? '📋 Assignment' : activity.type === 'reimbursement' ? '💰 Expense' : activity.type === 'income' ? '💵 Income' : '📸 Photo'}
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
                                        {activity.staffName && (
                                          <>
                                            <span className="font-medium text-gray-900">
                                              {activity.staffName}
                                            </span>
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
                                        {activity.type === 'income' && activity.amount !== undefined && (
                                          <>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-600">
                                              <span className="font-medium text-emerald-600">{formatCurrency(activity.amount)}</span>
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
        </div>

        {/* Financial Form Modal */}
        {showFinancialForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Update Budget & Timeline</h2>
              <button
                onClick={() => setShowFinancialForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Budget ($)</label>
                  <input
                    type="number"
                    value={budget || ''}
                    onChange={(e) => setBudget(Number(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Enter project budget"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-blue-800">
                      Actual costs are automatically calculated from your expenses and reimbursements. Add expenses using the "Add Expense" button.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowFinancialForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateFinancials}
                  disabled={submittingFinancial}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submittingFinancial && (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span>{submittingFinancial ? 'Updating...' : 'Update Financials'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Financial Report Modal */}
        {showFinancialReport && reportData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Financial Report</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportFinancialToCSV}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={exportFinancialToPDF}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setShowFinancialReport(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Project Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{reportData.projectName}</h3>
                <p className="text-sm text-gray-500">
                  Generated on {new Date(reportData.generatedAt).toLocaleString()}
                </p>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-600">${reportData.budget.toLocaleString()}</div>
                  <div className="text-sm text-blue-800">Total Budget</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-orange-600">${reportData.actualCost.toLocaleString()}</div>
                  <div className="text-sm text-orange-800">Actual Cost</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-emerald-600">${(reportData.actualRevenue || 0).toLocaleString()}</div>
                  <div className="text-sm text-emerald-800">Actual Revenue</div>
                </div>
                <div className={`rounded-xl p-4 ${(reportData.netProfit || 0) < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-2xl font-bold ${(reportData.netProfit || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(reportData.netProfit || 0).toLocaleString()}
                  </div>
                  <div className={`text-sm ${(reportData.netProfit || 0) < 0 ? 'text-red-800' : 'text-green-800'}`}>
                    Net Profit
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-600">{reportData.budgetUtilization}%</div>
                  <div className="text-sm text-purple-800">Budget Used</div>
                </div>
              </div>

              {/* Budget vs Actual Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
                  <span className="text-sm font-bold text-gray-900">{reportData.budgetUtilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      reportData.isOverBudget 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-blue-500 to-green-500'
                    }`}
                    style={{ width: `${Math.min(reportData.budgetUtilization, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$0</span>
                  <span>${reportData.budget.toLocaleString()}</span>
                </div>
              </div>

              {/* Financial Analysis */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Financial Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Budget Performance</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variance:</span>
                        <span className={`text-sm font-medium ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                          ${reportData.variance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variance %:</span>
                        <span className={`text-sm font-medium ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                          {reportData.variancePercentage}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className={`text-sm font-medium ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                          {reportData.isOverBudget ? 'Over Budget' : 'Within Budget'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Revenue & Profit</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Revenue:</span>
                        <span className="text-sm font-medium text-emerald-600">
                          ${(reportData.actualRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Net Profit:</span>
                        <span className={`text-sm font-medium ${(reportData.netProfit || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${(reportData.netProfit || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Profit Margin:</span>
                        <span className={`text-sm font-medium ${(reportData.profitMargin || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(reportData.profitMargin || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Project Timeline</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Start Date:</span>
                        <span className="text-sm font-medium text-gray-900">{reportData.startDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">End Date:</span>
                        <span className="text-sm font-medium text-gray-900">{reportData.endDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h5 className="text-sm font-semibold text-yellow-800 mb-2">Recommendations</h5>
                <p className="text-sm text-yellow-700">
                  {reportData.isOverBudget 
                    ? `⚠️ This project is over budget by $${Math.abs(reportData.variance).toLocaleString()}. Consider reviewing expenses and identifying cost-saving opportunities.`
                    : `✅ This project is within budget with $${reportData.remainingBudget.toLocaleString()} remaining. Continue monitoring costs to maintain budget compliance.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        )}
      </React.Fragment>
    </Layout>
  );
};

export default ProjectPage;


