import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task } from '../lib/types';

const TaskTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'todo' as 'todo' | 'in-progress' | 'review' | 'completed'
  });

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // Load all tasks that are templates (isTemplate === true or projectId is null)
      const templatesQuery = query(
        collection(db, 'tasks'),
        where('isTemplate', '==', true)
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
      // Fallback: try loading tasks with null projectId
      try {
        const allTasksQuery = query(collection(db, 'tasks'));
        const allTasksSnapshot = await getDocs(allTasksQuery);
        const allTasks = allTasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Task));
        // Filter for templates (projectId is null or isTemplate is true)
        const templateTasks = allTasks.filter(
          task => task.isTemplate === true || task.projectId === null || task.projectId === undefined
        );
        setTemplates(templateTasks);
      } catch (fallbackError) {
        console.error('Error in fallback template loading:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && permissions?.canManageUsers) {
      loadTemplates();
    } else if (currentUser && !permissions?.canManageUsers) {
      navigate('/');
    }
  }, [currentUser, permissions, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      setSaving(true);
      
      const dataToSave = {
        title: formData.title.trim(),
        description: formData.notes.trim() || '',
        priority: formData.priority,
        status: formData.status,
        isTemplate: true,
        projectId: null,
        createdAt: editingId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        // Update existing template
        await updateDoc(doc(db, 'tasks', editingId), dataToSave);
      } else {
        // Create new template
        await addDoc(collection(db, 'tasks'), dataToSave);
      }
      
      await loadTemplates();
      resetForm();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: Task) => {
    setFormData({
      title: template.title,
      notes: template.description || '',
      priority: template.priority || 'medium',
      status: template.status || 'todo'
    });
    setShowNotesField(!!template.description);
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await deleteDoc(doc(db, 'tasks', templateId));
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      notes: '',
      priority: 'medium',
      status: 'todo'
    });
    setShowNotesField(false);
    setEditingId(null);
    setShowForm(false);
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
      <Layout title="Task Templates" currentRole="admin">
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
    <Layout title="Task Templates" currentRole="admin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Task Templates</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Create universal task templates that can be used across all projects</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button onClick={() => navigate('/')} variant="outline" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
            <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
              Add Template
            </Button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
              {editingId ? 'Edit Template' : 'Create Template'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Framing, Drywall Installation, Painting"
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
              </div>

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
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
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
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
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
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')} Template
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Templates List */}
        <Card className="p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-gray-500 text-sm">No task templates found</p>
              <p className="text-gray-400 text-xs mt-1">Create templates to make staff assignments easier</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base break-words">{template.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(template.priority || 'medium')}`}>
                          {template.priority || 'medium'}
                        </span>
                        <span className="text-xs text-blue-600 font-medium">🌐 Universal</span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 mb-2 break-words">{template.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Status: {template.status || 'todo'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
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
      </div>
    </Layout>
  );
};

export default TaskTemplatesPage;

