import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ExpenseCategory, ExpenseSubcategory } from '../lib/types';

const CategoryManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  
  // Subcategory form state
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState('');

  useEffect(() => {
    if (currentUser && permissions?.canManageUsers) {
      loadData();
    } else if (currentUser && !permissions?.canManageUsers) {
      navigate('/');
    }
  }, [currentUser, permissions, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      
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

      // If no categories exist, create default ones
      if (categoriesData.length === 0) {
        await createDefaultCategories();
        // Reload after creating defaults
        const newCategoriesQuery = query(
          collection(db, 'expenseCategories'),
          orderBy('name', 'asc')
        );
        const newCategoriesSnapshot = await getDocs(newCategoriesQuery);
        const newCategoriesData = newCategoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ExpenseCategory));
        setCategories(newCategoriesData);
      }

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
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultCategories = async () => {
    try {
      // Create Materials category
      await addDoc(collection(db, 'expenseCategories'), {
        name: 'Materials',
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create Equipment category
      await addDoc(collection(db, 'expenseCategories'), {
        name: 'Equipment',
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    try {
      setSaving(true);
      
      const categoryData = {
        name: categoryName.trim(),
        isDefault: false,
        createdAt: editingCategoryId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingCategoryId) {
        await updateDoc(doc(db, 'expenseCategories', editingCategoryId), categoryData);
      } else {
        await addDoc(collection(db, 'expenseCategories'), categoryData);
      }
      
      await loadData();
      resetCategoryForm();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategoryName.trim() || !subcategoryCategoryId) return;

    try {
      setSaving(true);
      
      const subcategoryData = {
        categoryId: subcategoryCategoryId,
        name: subcategoryName.trim(),
        usageCount: editingSubcategoryId ? undefined : 0,
        createdAt: editingSubcategoryId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingSubcategoryId) {
        // Don't reset usageCount when editing
        const existingSubcategory = subcategories.find(s => s.id === editingSubcategoryId);
        await updateDoc(doc(db, 'expenseSubcategories', editingSubcategoryId), {
          categoryId: subcategoryCategoryId,
          name: subcategoryName.trim(),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'expenseSubcategories'), subcategoryData);
      }
      
      await loadData();
      resetSubcategoryForm();
    } catch (error) {
      console.error('Error saving subcategory:', error);
      alert('Failed to save subcategory. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCategory = (category: ExpenseCategory) => {
    setCategoryName(category.name);
    setEditingCategoryId(category.id);
    setShowCategoryForm(true);
  };

  const handleEditSubcategory = (subcategory: ExpenseSubcategory) => {
    setSubcategoryName(subcategory.name);
    setSubcategoryCategoryId(subcategory.categoryId);
    setEditingSubcategoryId(subcategory.id);
    setShowSubcategoryForm(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.isDefault) {
      alert('Cannot delete default categories.');
      return;
    }

    if (!confirm('Are you sure you want to delete this category? All subcategories under it will also be deleted.')) return;
    
    try {
      // Delete all subcategories under this category
      const categorySubcategories = subcategories.filter(s => s.categoryId === categoryId);
      for (const subcat of categorySubcategories) {
        await deleteDoc(doc(db, 'expenseSubcategories', subcat.id));
      }

      // Delete the category
      await deleteDoc(doc(db, 'expenseCategories', categoryId));
      await loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  const handleDeleteSubcategory = async (subcategoryId: string) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;
    
    try {
      await deleteDoc(doc(db, 'expenseSubcategories', subcategoryId));
      await loadData();
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      alert('Failed to delete subcategory. Please try again.');
    }
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setEditingCategoryId(null);
    setShowCategoryForm(false);
  };

  const resetSubcategoryForm = () => {
    setSubcategoryName('');
    setSubcategoryCategoryId('');
    setEditingSubcategoryId(null);
    setShowSubcategoryForm(false);
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(s => s.categoryId === categoryId).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  };

  if (!currentUser || !userProfile) {
    return (
      <Layout title="Categories" currentRole="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (permissions && !permissions?.canManageUsers) {
    navigate('/');
    return null;
  }

  return (
    <Layout title="Categories" currentRole="admin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Categories & Subcategories</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage expense categories and subcategories for expenses and reimbursements</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button onClick={() => navigate('/')} variant="outline" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
            <Button onClick={() => setShowCategoryForm(true)} className="w-full sm:w-auto">
              Add Category
            </Button>
          </div>
        </div>

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingCategoryId ? 'Edit Category' : 'Create Category'}
                </h2>
                <button
                  onClick={resetCategoryForm}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Labor, Permits, Utilities"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? 'Saving...' : (editingCategoryId ? 'Update' : 'Create')} Category
                  </Button>
                  <Button type="button" variant="outline" onClick={resetCategoryForm} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Subcategory Form Modal */}
        {showSubcategoryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingSubcategoryId ? 'Edit Subcategory' : 'Create Subcategory'}
                </h2>
                <button
                  onClick={resetSubcategoryForm}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddSubcategory} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={subcategoryCategoryId}
                    onChange={(e) => setSubcategoryCategoryId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subcategory Name *
                  </label>
                  <Input
                    value={subcategoryName}
                    onChange={(e) => setSubcategoryName(e.target.value)}
                    placeholder="e.g., Lumber, Concrete, Excavator"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? 'Saving...' : (editingSubcategoryId ? 'Update' : 'Create')} Subcategory
                  </Button>
                  <Button type="button" variant="outline" onClick={resetSubcategoryForm} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Categories List */}
        <Card className="p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-gray-500 text-sm">No categories found</p>
              <p className="text-gray-400 text-xs mt-1">Create categories to organize expenses and reimbursements</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => {
                const categorySubcategories = getSubcategoriesForCategory(category.id);
                return (
                  <div key={category.id} className="border border-gray-200 rounded-xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                        {category.isDefault && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            Default
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          ({categorySubcategories.length} {categorySubcategories.length === 1 ? 'subcategory' : 'subcategories'})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSubcategoryCategoryId(category.id);
                            setShowSubcategoryForm(true);
                          }}
                          className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                        >
                          + Add Subcategory
                        </Button>
                        {!category.isDefault && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCategory(category.id)}
                              className="text-red-600 hover:text-red-700 flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Subcategories List */}
                    {categorySubcategories.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No subcategories yet. Click "Add Subcategory" to create one.</p>
                    ) : (
                      <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                        {categorySubcategories.map((subcategory) => (
                          <div key={subcategory.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-900">{subcategory.name}</span>
                              <span className="text-xs text-gray-500">
                                Used {subcategory.usageCount || 0} {subcategory.usageCount === 1 ? 'time' : 'times'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditSubcategory(subcategory)}
                                className="min-h-[36px]"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSubcategory(subcategory.id)}
                                className="text-red-600 hover:text-red-700 min-h-[36px]"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default CategoryManagementPage;

