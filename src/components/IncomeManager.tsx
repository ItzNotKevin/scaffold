import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { Income, IncomeCategory, IncomeSubcategory } from '../lib/types';
import { updateProjectActualRevenue } from '../lib/projectRevenue';
import { compressImage } from '../lib/imageCompression';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import CollapsibleSection from './ui/CollapsibleSection';

const IncomeManager: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('projectId');
  
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [subcategories, setSubcategories] = useState<IncomeSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [compressInvoice, setCompressInvoice] = useState(true);
  const [showAllIncomes, setShowAllIncomes] = useState(false);
  
  // Optional fields visibility
  const [showInvoiceField, setShowInvoiceField] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);
  const [showClientField, setShowClientField] = useState(false);
  
  // Add subcategory modal state
  const [showAddSubcategoryModal, setShowAddSubcategoryModal] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState('');
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [subcategoryError, setSubcategoryError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    projectId: projectIdParam || '',
    category: '',
    amount: '' as string | number,
    date: new Date().toISOString().split('T')[0],
    invoiceUrl: '',
    notes: '',
    client: '',
    status: 'received' as 'pending' | 'received' | 'cancelled'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load projects
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unnamed Project'
      }));
      setProjects(projectsData);

      // Load categories
      const categoriesQuery = query(
        collection(db, 'incomeCategories'),
        orderBy('name', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as IncomeCategory));
      setCategories(categoriesData);

      // Load subcategories
      const subcategoriesQuery = query(
        collection(db, 'incomeSubcategories'),
        orderBy('name', 'asc')
      );
      const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
      const subcategoriesData = subcategoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as IncomeSubcategory));
      setSubcategories(subcategoriesData);

      // Load incomes
      const incomesQuery = query(
        collection(db, 'incomes'),
        orderBy('date', 'desc')
      );
      const incomesSnapshot = await getDocs(incomesQuery);
      const incomesData = incomesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Income));
      setIncomes(incomesData);
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
    const organized: { [categoryId: string]: IncomeSubcategory[] } = {};
    categories.forEach(category => {
      organized[category.id] = subcategories
        .filter(sub => sub.categoryId === category.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    return organized;
  }, [categories, subcategories]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUser) return;

    // Use the last selected file (most recent photo taken)
    const file = files[files.length - 1];

    try {
      setUploadingInvoice(true);
      
      // Compress image if option is enabled
      let fileToUpload = file;
      if (compressInvoice && file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }
      
      // Create a reference to the file in Firebase Storage
      const timestamp = Date.now();
      const fileName = `invoices/${currentUser.uid}/${timestamp}_${fileToUpload.name}`;
      const storageRef = ref(storage, fileName);
      
      // Upload the file
      await uploadBytes(storageRef, fileToUpload);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      setFormData({ ...formData, invoiceUrl: downloadURL });
    } catch (error) {
      console.error('Error uploading invoice:', error);
      alert('Failed to upload invoice. Please try again.');
    } finally {
      setUploadingInvoice(false);
      // Reset input value so onChange can fire again for new camera captures
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(formData.amount as string) || 0;
    if (!formData.category || amountValue <= 0 || !currentUser) return;

    try {
      setSaving(true);
      
      const selectedProject = formData.projectId ? projects.find(p => p.id === formData.projectId) : null;
      
      // Track old project ID if editing, to update both old and new project revenue
      let oldProjectId: string | null = null;
      let oldCategoryName: string | null = null;
      if (editingId) {
        const oldIncome = incomes.find(i => i.id === editingId);
        oldProjectId = oldIncome?.projectId || null;
        oldCategoryName = oldIncome?.category || null;
      }
      
      const incomeData: any = {
        projectId: formData.projectId || null,
        projectName: selectedProject?.name || null,
        category: formData.category,
        amount: amountValue,
        date: formData.date,
        invoiceUrl: formData.invoiceUrl || null,
        notes: formData.notes || null,
        client: formData.client || null,
        status: formData.status,
        createdBy: currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      if (editingId) {
        // Update existing income
        await updateDoc(doc(db, 'incomes', editingId), incomeData);
        
        // Update usage count: decrement old subcategory, increment new one
        if (oldCategoryName && oldCategoryName !== formData.category) {
          const oldSubcategory = subcategories.find(s => s.name === oldCategoryName);
          if (oldSubcategory && oldSubcategory.usageCount > 0) {
            await updateDoc(doc(db, 'incomeSubcategories', oldSubcategory.id), {
              usageCount: (oldSubcategory.usageCount || 0) - 1,
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        // Create new income
        await addDoc(collection(db, 'incomes'), {
          ...incomeData,
          createdAt: serverTimestamp()
        });
      }

      // Increment usage count for the selected subcategory
      const selectedSubcategory = subcategories.find(s => s.name === formData.category);
      if (selectedSubcategory) {
        await updateDoc(doc(db, 'incomeSubcategories', selectedSubcategory.id), {
          usageCount: (selectedSubcategory.usageCount || 0) + 1,
          updatedAt: serverTimestamp()
        });
      }
      
      // Update project revenue
      if (formData.projectId) {
        await updateProjectActualRevenue(formData.projectId);
      }
      if (oldProjectId && oldProjectId !== formData.projectId) {
        await updateProjectActualRevenue(oldProjectId);
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving income:', error);
      alert('Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (income: Income) => {
    setFormData({
      projectId: income.projectId || '',
      category: income.category || '',
      amount: income.amount,
      date: income.date,
      invoiceUrl: income.invoiceUrl || '',
      notes: income.notes || '',
      client: income.client || '',
      status: income.status
    });
    // Show optional fields if they have values
    setShowInvoiceField(!!income.invoiceUrl);
    setShowNotesField(!!income.notes);
    setShowClientField(!!income.client);
    setEditingId(income.id);
    setShowForm(true);
  };

  const handleDelete = async (incomeId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      // Get the income to find its projectId and category before deleting
      const income = incomes.find(i => i.id === incomeId);
      const projectId = income?.projectId;
      const categoryName = income?.category;
      
      await deleteDoc(doc(db, 'incomes', incomeId));
      
      // Decrement usage count for the subcategory
      if (categoryName) {
        const subcategory = subcategories.find(s => s.name === categoryName);
        if (subcategory && subcategory.usageCount > 0) {
          await updateDoc(doc(db, 'incomeSubcategories', subcategory.id), {
            usageCount: (subcategory.usageCount || 0) - 1,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // Update project revenue if the income was linked to a project
      if (projectId) {
        await updateProjectActualRevenue(projectId);
      }
      
      await loadData();
    } catch (error) {
      console.error('Error deleting income:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: projectIdParam || '',
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      invoiceUrl: '',
      notes: '',
      client: '',
      status: 'received'
    });
    setShowInvoiceField(false);
    setShowNotesField(false);
    setShowClientField(false);
    setEditingId(null);
    setShowForm(false);
    // Clear projectId from URL if it was set
    if (projectIdParam) {
      setSearchParams({});
    }
  };

  const resetSubcategoryModal = () => {
    setNewSubcategoryName('');
    setNewSubcategoryCategoryId('');
    setSubcategoryError('');
    setShowAddSubcategoryModal(false);
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubcategoryError('');

    // Validation
    if (!newSubcategoryName.trim()) {
      setSubcategoryError('Subcategory name is required');
      return;
    }

    if (!newSubcategoryCategoryId) {
      setSubcategoryError('Please select a category');
      return;
    }

    // Check for duplicate (case-insensitive)
    const trimmedName = newSubcategoryName.trim();
    const duplicate = subcategories.find(
      sub => sub.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (duplicate) {
      setSubcategoryError('A subcategory with this name already exists');
      return;
    }

    try {
      setCreatingSubcategory(true);
      
      // Create the subcategory in Firestore
      const subcategoryData = {
        name: trimmedName,
        categoryId: newSubcategoryCategoryId,
        usageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'incomeSubcategories'), subcategoryData);
      
      // Reload subcategories
      const subcategoriesQuery = query(
        collection(db, 'incomeSubcategories'),
        orderBy('name', 'asc')
      );
      const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
      const subcategoriesData = subcategoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as IncomeSubcategory));
      setSubcategories(subcategoriesData);

      // Auto-select the newly created subcategory
      setFormData({ ...formData, category: trimmedName });
      
      // Close the modal
      resetSubcategoryModal();
    } catch (error) {
      console.error('Error creating subcategory:', error);
      setSubcategoryError('Failed to create subcategory. Please try again.');
    } finally {
      setCreatingSubcategory(false);
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
      case 'received':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Mobile: Limit initial display
  const INITIAL_DISPLAY_COUNT = 15;
  const displayedIncomes = useMemo(() => {
    if (incomes.length <= INITIAL_DISPLAY_COUNT || showAllIncomes) {
      return incomes;
    }
    return incomes.slice(0, INITIAL_DISPLAY_COUNT);
  }, [incomes, showAllIncomes]);

  // Calculate total income (only received)
  const totalIncome = incomes
    .filter(i => i.status === 'received')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Income</h3>
            <p className="text-xs sm:text-sm text-gray-500">Track project income and payments</p>
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
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-sm text-green-600 font-medium">Total Entries</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{incomes.length}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-600 font-medium">Received Amount</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
            <p className="text-sm text-yellow-600 font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-900 mt-1">
              {incomes.filter(i => i.status === 'pending').length}
            </p>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingId ? 'Edit Income' : 'Add Income'}
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
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setShowAddSubcategoryModal(true);
                      setFormData({ ...formData, category: '' });
                    } else {
                      setFormData({ ...formData, category: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                  required
                >
                  <option value="">Select Category</option>
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
                  {categories.length > 0 && (
                    <option value="__add_new__">+ Add new subcategory...</option>
                  )}
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
            </div>

            {/* Optional Fields - Toggleable */}
            <div className="flex flex-wrap gap-2 mb-3">
              {!showInvoiceField && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInvoiceField(true)}
                  className="text-sm"
                >
                  + Add Invoice Photo
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
              {!showClientField && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClientField(true)}
                  className="text-sm"
                >
                  + Add Client
                </Button>
              )}
            </div>

            {/* Invoice Upload Field */}
            {showInvoiceField && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Invoice Photo
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowInvoiceField(false);
                      setFormData({ ...formData, invoiceUrl: '' });
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
                      checked={compressInvoice}
                      onChange={(e) => setCompressInvoice(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Compress image (faster upload, smaller file)</span>
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploadingInvoice}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50"
                  />
                  {uploadingInvoice && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span>Uploading...</span>
                    </div>
                  )}
                </div>
                {formData.invoiceUrl && (
                  <div className="mt-2">
                    <a
                      href={formData.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      View Invoice
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

            {/* Client Field */}
            {showClientField && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Client
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowClientField(false);
                      setFormData({ ...formData, client: '' });
                    }}
                    className="text-xs"
                  >
                    Remove
                  </Button>
                </div>
                <Input
                  type="text"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  placeholder="Enter client name"
                  className="w-full"
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
                <option value="received">Received</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                  <Button type="submit" disabled={saving || uploadingInvoice} className="w-full sm:w-auto">
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

        {/* Add Subcategory Modal */}
        {showAddSubcategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[60]">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  Add New Subcategory
                </h2>
                <button
                  onClick={resetSubcategoryModal}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreateSubcategory} className="p-4 sm:p-6 space-y-4">
                {categories.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-4">No categories available. Please create a category first.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetSubcategoryModal}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        value={newSubcategoryCategoryId}
                        onChange={(e) => {
                          setNewSubcategoryCategoryId(e.target.value);
                          setSubcategoryError('');
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                        required
                        autoFocus
                      >
                        <option value="">Select Category</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subcategory Name *
                      </label>
                      <Input
                        type="text"
                        value={newSubcategoryName}
                        onChange={(e) => {
                          setNewSubcategoryName(e.target.value);
                          setSubcategoryError('');
                        }}
                        placeholder="Enter subcategory name"
                        required
                      />
                    </div>
                    {subcategoryError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-600">{subcategoryError}</p>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                      <Button 
                        type="submit" 
                        disabled={creatingSubcategory || !newSubcategoryName.trim() || !newSubcategoryCategoryId} 
                        className="w-full sm:w-auto"
                      >
                        {creatingSubcategory ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                            Creating...
                          </>
                        ) : (
                          'Create Subcategory'
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={resetSubcategoryModal} 
                        className="w-full sm:w-auto"
                        disabled={creatingSubcategory}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
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
        ) : incomes.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">💰</div>
            <p className="text-gray-500 text-sm">No entries found</p>
            <p className="text-gray-400 text-xs mt-1">Add income to track revenue</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedIncomes.map((income) => (
                <div key={income.id} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 text-sm sm:text-base break-words">
                        {income.category}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(income.status)}`}>
                        {income.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Amount:</span> {formatCurrency(income.amount)}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {income.date}
                      </div>
                      {income.projectName && (
                        <div>
                          <span className="font-medium">Project:</span> <span className="break-words">{income.projectName}</span>
                        </div>
                      )}
                      {income.client && (
                        <div>
                          <span className="font-medium">Client:</span> <span className="break-words">{income.client}</span>
                        </div>
                      )}
                    </div>
                    {income.notes && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">{income.notes}</p>
                    )}
                    {income.invoiceUrl && (
                      <a
                        href={income.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700 mt-2 touch-manipulation min-h-[44px]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        View Invoice
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 sm:ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(income)}
                      className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(income.id)}
                      className="text-red-600 hover:text-red-700 flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            </div>
            {incomes.length > INITIAL_DISPLAY_COUNT && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAllIncomes(!showAllIncomes)}
                  className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors touch-manipulation min-h-[48px] text-sm sm:text-base"
                >
                  {showAllIncomes 
                    ? `Show Less (Showing ${incomes.length} of ${incomes.length})`
                    : `Show More (Showing ${displayedIncomes.length} of ${incomes.length})`
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

export default IncomeManager;


