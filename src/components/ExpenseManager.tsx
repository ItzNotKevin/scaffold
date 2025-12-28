import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { Expense, StaffMember, ExpenseCategory, ExpenseSubcategory } from '../lib/types';
import { updateProjectActualCost } from '../lib/projectCosts';
import { compressImage } from '../lib/imageCompression';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import CollapsibleSection from './ui/CollapsibleSection';

const ExpenseManager: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('projectId');
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [compressReceipt, setCompressReceipt] = useState(true);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  
  // Optional fields visibility
  const [showStaffField, setShowStaffField] = useState(false);
  const [showReceiptField, setShowReceiptField] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    staffId: '',
    projectId: projectIdParam || '',
    subcategory: '',
    amount: '' as string | number,
    date: new Date().toISOString().split('T')[0],
    receiptUrl: '',
    notes: '',
    status: 'approved' as 'pending' | 'approved' | 'rejected'
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

      // Load categories
      const categoriesQuery = query(
        collection(db, 'expenseCategories'),
        orderBy('name', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ExpenseCategory));
      setCategories(categoriesData);

      // Load subcategories
      const subcategoriesQuery = query(
        collection(db, 'expenseSubcategories'),
        orderBy('name', 'asc')
      );
      const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
      const subcategoriesData = subcategoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ExpenseSubcategory));
      setSubcategories(subcategoriesData);

      // Load reimbursements (including expenses)
      const reimbursementsQuery = query(
        collection(db, 'reimbursements'),
        orderBy('date', 'desc')
      );
      const reimbursementsSnapshot = await getDocs(reimbursementsQuery);
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
    // If projectId is in URL, show form and pre-populate
    if (projectIdParam) {
      setShowForm(true);
      setFormData(prev => ({ ...prev, projectId: projectIdParam }));
    }
  }, []);

  // Get top 5 most used subcategories
  const topUsedSubcategories = useMemo(() => {
    return [...subcategories]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 5);
  }, [subcategories]);

  // Get subcategories organized by category
  const subcategoriesByCategory = useMemo(() => {
    const organized: { [categoryId: string]: ExpenseSubcategory[] } = {};
    categories.forEach(category => {
      organized[category.id] = subcategories
        .filter(sub => sub.categoryId === category.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    return organized;
  }, [categories, subcategories]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploadingReceipt(true);
      
      // Compress image if option is enabled
      let fileToUpload = file;
      if (compressReceipt && file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }
      
      // Create a reference to the file in Firebase Storage
      const timestamp = Date.now();
      const fileName = `receipts/${currentUser.uid}/${timestamp}_${fileToUpload.name}`;
      const storageRef = ref(storage, fileName);
      
      // Upload the file
      await uploadBytes(storageRef, fileToUpload);
      
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(formData.amount as string) || 0;
    if (!formData.subcategory || amountValue <= 0 || !currentUser) return;

    try {
      setSaving(true);
      
      const selectedStaff = formData.staffId ? staff.find(s => s.id === formData.staffId) : null;
      const selectedProject = formData.projectId ? projects.find(p => p.id === formData.projectId) : null;
      
      // Track old project ID if editing, to update both old and new project costs
      let oldProjectId: string | null = null;
      let oldSubcategoryName: string | null = null;
      if (editingId) {
        const oldExpense = expenses.find(e => e.id === editingId);
        oldProjectId = oldExpense?.projectId || null;
        oldSubcategoryName = oldExpense?.subcategory || null;
      }
      
      const expenseData: any = {
        projectId: formData.projectId || null,
        projectName: selectedProject?.name || null,
        subcategory: formData.subcategory,
        amount: amountValue,
        date: formData.date,
        receiptUrl: formData.receiptUrl || null,
        notes: formData.notes || null,
        status: formData.status,
        createdBy: currentUser.uid,
        updatedAt: serverTimestamp()
      };

      // Only add staff fields if staff member is selected
      if (formData.staffId && selectedStaff) {
        expenseData.staffId = formData.staffId;
        expenseData.staffName = selectedStaff.name;
        expenseData.itemDescription = formData.subcategory; // Use subcategory as description
      } else {
        expenseData.itemDescription = formData.subcategory; // For expenses, subcategory is the description
      }
      
      if (editingId) {
        // Update existing expense
        await updateDoc(doc(db, 'reimbursements', editingId), expenseData);
        
        // Update usage count: decrement old subcategory, increment new one
        if (oldSubcategoryName && oldSubcategoryName !== formData.subcategory) {
          const oldSubcategory = subcategories.find(s => s.name === oldSubcategoryName);
          if (oldSubcategory && oldSubcategory.usageCount > 0) {
            await updateDoc(doc(db, 'expenseSubcategories', oldSubcategory.id), {
              usageCount: (oldSubcategory.usageCount || 0) - 1,
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        // Create new expense
        await addDoc(collection(db, 'reimbursements'), {
          ...expenseData,
          createdAt: serverTimestamp()
        });
      }

      // Increment usage count for the selected subcategory
      const selectedSubcategory = subcategories.find(s => s.name === formData.subcategory);
      if (selectedSubcategory) {
        await updateDoc(doc(db, 'expenseSubcategories', selectedSubcategory.id), {
          usageCount: (selectedSubcategory.usageCount || 0) + 1,
          updatedAt: serverTimestamp()
        });
      }
      
      // Update project costs
      if (formData.projectId) {
        await updateProjectActualCost(formData.projectId);
      }
      if (oldProjectId && oldProjectId !== formData.projectId) {
        await updateProjectActualCost(oldProjectId);
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setFormData({
      staffId: expense.staffId || '',
      projectId: expense.projectId || '',
      subcategory: expense.subcategory || '',
      amount: expense.amount,
      date: expense.date,
      receiptUrl: expense.receiptUrl || '',
      notes: expense.notes || '',
      status: expense.status
    });
    // Show optional fields if they have values
    setShowStaffField(!!expense.staffId);
    setShowReceiptField(!!expense.receiptUrl);
    setShowNotesField(!!expense.notes);
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      // Get the expense to find its projectId and subcategory before deleting
      const expense = expenses.find(e => e.id === expenseId);
      const projectId = expense?.projectId;
      const subcategoryName = expense?.subcategory;
      
      await deleteDoc(doc(db, 'reimbursements', expenseId));
      
      // Decrement usage count for the subcategory
      if (subcategoryName) {
        const subcategory = subcategories.find(s => s.name === subcategoryName);
        if (subcategory && subcategory.usageCount > 0) {
          await updateDoc(doc(db, 'expenseSubcategories', subcategory.id), {
            usageCount: (subcategory.usageCount || 0) - 1,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // Update project costs if the expense was linked to a project
      if (projectId) {
        await updateProjectActualCost(projectId);
      }
      
      await loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      staffId: '',
      projectId: projectIdParam || '',
      subcategory: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      receiptUrl: '',
      notes: '',
      status: 'approved'
    });
    setShowStaffField(false);
    setShowReceiptField(false);
    setShowNotesField(false);
    setEditingId(null);
    setShowForm(false);
    // Clear projectId from URL if it was set
    if (projectIdParam) {
      setSearchParams({});
    }
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

  // Mobile: Limit initial display
  const INITIAL_DISPLAY_COUNT = 15;
  const displayedExpenses = useMemo(() => {
    if (expenses.length <= INITIAL_DISPLAY_COUNT || showAllExpenses) {
      return expenses;
    }
    return expenses.slice(0, INITIAL_DISPLAY_COUNT);
  }, [expenses, showAllExpenses]);

  // Calculate total expenses
  const totalExpenses = expenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Expenses</h3>
            <p className="text-xs sm:text-sm text-gray-500">Track expenses and reimbursements</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Entry
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-600 font-medium">Total Entries</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{expenses.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-sm text-green-600 font-medium">Approved Amount</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
            <p className="text-sm text-yellow-600 font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-900 mt-1">
              {expenses.filter(e => e.status === 'pending').length}
            </p>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingId ? 'Edit Expense' : 'Add Expense'}
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
              <form onSubmit={handleSubmit} className="p-6 space-y-3 sm:space-y-4">
            {/* Basic Fields - Always Visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory *
                </label>
                <select
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                  required
                >
                  <option value="">Select Subcategory</option>
                  {topUsedSubcategories.length > 0 && (
                    <optgroup label="Recently Used">
                      {topUsedSubcategories.map(sub => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {categories.map(category => {
                    const categorySubs = subcategoriesByCategory[category.id] || [];
                    if (categorySubs.length === 0) return null;
                    return (
                      <optgroup key={category.id} label={category.name}>
                        {categorySubs.map(sub => (
                          <option key={sub.id} value={sub.name}>{sub.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
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
              {projectIdParam && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project
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
              )}
            </div>

            {/* Optional Fields - Toggleable */}
            <div className="flex flex-wrap gap-2 mb-3">
              {!showStaffField && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStaffField(true)}
                  className="text-sm"
                >
                  + Add Staff Member
                </Button>
              )}
              {!showReceiptField && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReceiptField(true)}
                  className="text-sm"
                >
                  + Add Receipt Photo
                </Button>
              )}
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

            {/* Receipt Upload Field */}
            {showReceiptField && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Receipt Photo
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowReceiptField(false);
                      setFormData({ ...formData, receiptUrl: '' });
                    }}
                    className="text-xs"
                  >
                    Remove
                  </Button>
                </div>
                <div className="mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compressReceipt}
                      onChange={(e) => setCompressReceipt(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Compress image (faster upload, smaller file)</span>
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingReceipt}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50"
                  />
                  {uploadingReceipt && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
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

            {/* Status Field */}
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

                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                  <Button type="submit" disabled={saving || uploadingReceipt} className="w-full sm:w-auto">
                    {saving ? 'Saving...' : (editingId ? 'Update' : 'Add')} Entry
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading entries...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🧾</div>
            <p className="text-gray-500 text-sm">No entries found</p>
            <p className="text-gray-400 text-xs mt-1">Add expenses to track costs</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedExpenses.map((expense) => (
                <div key={expense.id} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 text-sm sm:text-base break-words">
                        {expense.subcategory || expense.itemDescription}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(expense.status)}`}>
                        {expense.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
                      {expense.staffName && (
                        <div>
                          <span className="font-medium">Staff:</span> {expense.staffName}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Amount:</span> {formatCurrency(expense.amount)}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {expense.date}
                      </div>
                      {expense.projectName && (
                        <div>
                          <span className="font-medium">Project:</span> <span className="break-words">{expense.projectName}</span>
                        </div>
                      )}
                    </div>
                    {expense.notes && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">{expense.notes}</p>
                    )}
                    {expense.receiptUrl && (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700 mt-2 touch-manipulation min-h-[44px]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        View Receipt
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 sm:ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(expense)}
                      className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-600 hover:text-red-700 flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            </div>
            {expenses.length > INITIAL_DISPLAY_COUNT && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAllExpenses(!showAllExpenses)}
                  className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors touch-manipulation min-h-[48px] text-sm sm:text-base"
                >
                  {showAllExpenses 
                    ? `Show Less (Showing ${expenses.length} of ${expenses.length})`
                    : `Show More (Showing ${displayedExpenses.length} of ${expenses.length})`
                  }
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default ExpenseManager;
