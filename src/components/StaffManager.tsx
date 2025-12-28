import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StaffMember } from '../lib/types';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

const StaffManager: React.FC = () => {
  const { t } = useTranslation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dailyRate: '' as string | number,
    status: 'active' as 'active' | 'inactive',
    notes: ''
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const staffSnapshot = await getDocs(collection(db, 'staffMembers'));
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSaving(true);
      
      const dataToSave = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        dailyRate: parseFloat(formData.dailyRate as string) || 0,
        status: formData.status,
        notes: formData.notes.trim() || null
      };

      if (editingId) {
        // Update existing staff member
        await updateDoc(doc(db, 'staffMembers', editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new staff member
        await addDoc(collection(db, 'staffMembers'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      await loadStaff();
      resetForm();
    } catch (error) {
      console.error('Error saving staff member:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (staffMember: StaffMember) => {
    setFormData({
      name: staffMember.name,
      email: staffMember.email || '',
      phone: staffMember.phone || '',
      dailyRate: staffMember.dailyRate,
      status: staffMember.status,
      notes: staffMember.notes || ''
    });
    setEditingId(staffMember.id);
    setShowForm(true);
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    
    try {
      await deleteDoc(doc(db, 'staffMembers', staffId));
      await loadStaff();
    } catch (error) {
      console.error('Error deleting staff member:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      dailyRate: '',
      status: 'active',
      notes: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Staff Management</h3>
            <p className="text-xs sm:text-sm text-gray-500">Manage non-user staff members for task assignments</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            Add Staff Member
          </Button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingId ? 'Edit Staff Member' : 'Add Staff Member'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Staff member name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (optional)
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Rate ($)
                </label>
                <Input
                  type="number"
                  value={formData.dailyRate}
                  onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
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
                rows={3}
              />
            </div>
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? 'Saving...' : (editingId ? 'Update' : 'Add')} Staff Member
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Staff List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading staff...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-gray-500 text-sm">No staff members found</p>
            <p className="text-gray-400 text-xs mt-1">Add staff members to assign tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((staffMember) => (
              <div key={staffMember.id} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-medium text-sm">
                          {staffMember.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base break-words">{staffMember.name}</h4>
                        <p className="text-xs sm:text-sm text-gray-500 break-all">
                          {staffMember.email || 'No email provided'}
                        </p>
                        {staffMember.phone && (
                          <p className="text-xs sm:text-sm text-gray-500">{staffMember.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                      <span className="text-gray-600">
                        Daily Rate: <span className="font-medium">${staffMember.dailyRate.toFixed(2)}</span>
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        staffMember.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {staffMember.status}
                      </span>
                    </div>
                    {staffMember.notes && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">{staffMember.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(staffMember)}
                      className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px]"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(staffMember.id)}
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
  );
};

export default StaffManager;
