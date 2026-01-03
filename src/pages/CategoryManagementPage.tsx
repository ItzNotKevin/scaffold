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
import type { ExpenseCategory, ExpenseSubcategory, Task } from '../lib/types';

const CategoryManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'categories' | 'tasks'>('categories');
  
  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  
  // Subcategory form state
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState('');
  
  // Task form state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showTaskNotesField, setShowTaskNotesField] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    notes: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'todo' as 'todo' | 'in-progress' | 'review' | 'completed'
  });

  useEffect(() => {
    if (currentUser && permissions?.canManageUsers) {
      loadData();
      if (activeTab === 'tasks') {
        loadTasks();
      }
    } else if (currentUser && !permissions?.canManageUsers) {
      navigate('/');
    }
  }, [currentUser, permissions, navigate, activeTab]);

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

  const loadTasks = async () => {
    try {
      setTasksLoading(true);
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('isTemplate', '==', true)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Fallback: try loading all tasks and filter
      try {
        const allTasksQuery = query(collection(db, 'tasks'));
        const allTasksSnapshot = await getDocs(allTasksQuery);
        const allTasks = allTasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Task));
        const templateTasks = allTasks.filter(
          task => task.isTemplate === true || task.projectId === null || task.projectId === undefined
        );
        setTasks(templateTasks);
      } catch (fallbackError) {
        console.error('Error in fallback task loading:', fallbackError);
      }
    } finally {
      setTasksLoading(false);
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

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) return;

    try {
      setSaving(true);
      
      const dataToSave = {
        title: taskFormData.title.trim(),
        description: taskFormData.notes.trim() || '',
        priority: taskFormData.priority,
        status: taskFormData.status,
        isTemplate: true,
        projectId: null,
        createdAt: editingTaskId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingTaskId) {
        await updateDoc(doc(db, 'tasks', editingTaskId), dataToSave);
      } else {
        await addDoc(collection(db, 'tasks'), dataToSave);
      }
      
      await loadTasks();
      resetTaskForm();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setTaskFormData({
      title: task.title,
      notes: task.description || '',
      priority: task.priority || 'medium',
      status: task.status || 'todo'
    });
    setShowTaskNotesField(!!task.description);
    setEditingTaskId(task.id);
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const resetTaskForm = () => {
    setTaskFormData({
      title: '',
      notes: '',
      priority: 'medium',
      status: 'todo'
    });
    setShowTaskNotesField(false);
    setEditingTaskId(null);
    setShowTaskForm(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Categories & Tasks</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage expense categories, subcategories, and task templates</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button onClick={() => navigate('/')} variant="outline" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
            {activeTab === 'categories' && (
              <Button onClick={() => setShowCategoryForm(true)} className="w-full sm:w-auto">
                Add Category
              </Button>
            )}
            {activeTab === 'tasks' && (
              <Button onClick={() => setShowTaskForm(true)} className="w-full sm:w-auto">
                Add Task
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-2 mb-4">
            <button 
              onClick={() => setActiveTab('categories')} 
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                activeTab === 'categories'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Categories
            </button>
            <button 
              onClick={() => {
                setActiveTab('tasks');
                loadTasks();
              }} 
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors touch-manipulation min-h-[44px] flex-1 sm:flex-none ${
                activeTab === 'tasks'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tasks
            </button>
          </div>

          {activeTab === 'categories' && (
            <>
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
            </>
          )}

          {activeTab === 'tasks' && (
            <>
              {/* Task Form */}
              {showTaskForm && (
                <Card className="p-4 sm:p-6 mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
                    {editingTaskId ? 'Edit Task' : 'Create Task'}
                  </h2>
                  <form onSubmit={handleTaskSubmit} className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Task Title *
                      </label>
                      <Input
                        value={taskFormData.title}
                        onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                        placeholder="e.g., Framing, Drywall Installation, Painting"
                        required
                      />
                    </div>

                    {/* Optional Fields - Toggleable */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {!showTaskNotesField && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTaskNotesField(true)}
                          className="text-sm"
                        >
                          + Add Notes
                        </Button>
                      )}
                    </div>

                    {/* Notes Field */}
                    {showTaskNotesField && (
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
                              setShowTaskNotesField(false);
                              setTaskFormData({ ...taskFormData, notes: '' });
                            }}
                            className="text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                        <textarea
                          value={taskFormData.notes}
                          onChange={(e) => setTaskFormData({ ...taskFormData, notes: e.target.value })}
                          placeholder="Additional notes..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation"
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Priority
                        </label>
                        <select
                          value={taskFormData.priority}
                          onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as any })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status
                        </label>
                        <select
                          value={taskFormData.status}
                          onChange={(e) => setTaskFormData({ ...taskFormData, status: e.target.value as any })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : (editingTaskId ? 'Update' : 'Create')} Task
                      </Button>
                      <Button type="button" variant="outline" onClick={resetTaskForm}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* Tasks List */}
              <Card className="p-4 sm:p-6">
                {tasksLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 text-sm mt-2">Loading tasks...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-gray-500 text-sm">No tasks found</p>
                    <p className="text-gray-400 text-xs mt-1">Create tasks to use as templates</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900 text-sm sm:text-base break-words">{task.title}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority || 'medium')}`}>
                                {task.priority || 'medium'}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2 break-words">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Status: {task.status || 'todo'}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTask(task)}
                              className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-700 flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
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
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CategoryManagementPage;

