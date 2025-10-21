import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { Reimbursement, StaffMember } from '../lib/types';
import { updateProjectActualCost } from '../lib/projectCosts';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

const ReimbursementManager: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    staffId: '',
    projectId: '',
    itemDescription: '',
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

      // Load reimbursements
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
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploadingReceipt(true);
      
      // Create a reference to the file in Firebase Storage
      const timestamp = Date.now();
      const fileName = `receipts/${currentUser.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      // Upload the file
      await uploadBytes(storageRef, file);
      
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
    if (!formData.staffId || !formData.itemDescription || amountValue <= 0 || !currentUser) return;

    try {
      setSaving(true);
      
      const selectedStaff = staff.find(s => s.id === formData.staffId);
      const selectedProject = projects.find(p => p.id === formData.projectId);
      
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
        itemDescription: formData.itemDescription,
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
      
      await loadData();
      resetForm();
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
      itemDescription: reimbursement.itemDescription,
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
      itemDescription: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      receiptUrl: '',
      notes: '',
      status: 'approved'
    });
    setEditingId(null);
    setShowForm(false);
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reimbursement Management</h3>
            <p className="text-sm text-gray-500">Track material reimbursements for staff members</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Reimbursement
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Member *
                </label>
                <select
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Description *
                </label>
                <Input
                  value={formData.itemDescription}
                  onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
                  placeholder="e.g., Lumber, Paint, Tools"
                  required
                />
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving || uploadingReceipt}>
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Add')} Reimbursement
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        )}

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
          <div className="space-y-3">
            {reimbursements.map((reimbursement) => (
              <div key={reimbursement.id} className="p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{reimbursement.itemDescription}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(reimbursement.status)}`}>
                        {reimbursement.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Staff:</span> {reimbursement.staffName}
                      </div>
                      <div>
                        <span className="font-medium">Amount:</span> {formatCurrency(reimbursement.amount)}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {reimbursement.date}
                      </div>
                      {reimbursement.projectName && (
                        <div>
                          <span className="font-medium">Project:</span> {reimbursement.projectName}
                        </div>
                      )}
                    </div>
                    {reimbursement.notes && (
                      <p className="text-sm text-gray-600 mt-2">{reimbursement.notes}</p>
                    )}
                    {reimbursement.receiptUrl && (
                      <a
                        href={reimbursement.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        View Receipt
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(reimbursement)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(reimbursement.id)}
                      className="text-red-600 hover:text-red-700"
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
