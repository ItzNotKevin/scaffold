import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { sendPhaseUpdateEmails } from '../lib/emailNotifications';
import { usePushNotifications } from '../lib/usePushNotifications';
import { getProjectCostBreakdown, updateProjectActualCost } from '../lib/projectCosts';
import { compressImage } from '../lib/imageCompression';
import type { ProjectPhotoEntry, Expense } from '../lib/types';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const phases = ['Sales','Contract','Materials','Construction','Completion'] as const;
type Phase = typeof phases[number];



interface ProjectPhoto {
  id: string;
  url: string;
  name: string;
  uploadedBy: string;
  uploadedAt: any;
  size?: number;
  photoUrl?: string; // From ProjectPhotoEntry
  photoName?: string; // From ProjectPhotoEntry
  description?: string; // From ProjectPhotoEntry
  date?: string; // From ProjectPhotoEntry
}


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
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  
  const [showFinancialForm, setShowFinancialForm] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [budget, setBudget] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [submittingFinancial, setSubmittingFinancial] = useState(false);
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
        setStartDate(data.startDate ? (data.startDate.toDate ? data.startDate.toDate().toISOString().split('T')[0] : new Date(data.startDate).toISOString().split('T')[0]) : '');
        setEndDate(data.endDate ? (data.endDate.toDate ? data.endDate.toDate().toISOString().split('T')[0] : new Date(data.endDate).toISOString().split('T')[0]) : '');
        
        // Load cost breakdown (wages + reimbursements)
        await loadCostBreakdown();
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


  // Load photos when component mounts
  useEffect(() => {
    loadPhotos();
  }, [id]);

  // Add timeout for photo loading
  useEffect(() => {
    if (photosLoading) {
      const timeout = setTimeout(() => {
        console.warn('Photo loading timeout - setting loading to false');
        setPhotosLoading(false);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [photosLoading]);

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

    const report = {
      projectName,
      generatedAt: new Date().toISOString(),
      budget,
      actualCost,
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

  // Photo management functions
  const loadPhotos = async () => {
    if (!id) {
      console.log('No project ID available for loading photos');
      setPhotosLoading(false);
      return;
    }
    
    try {
      console.log('Loading photos for project:', id);
      setPhotosLoading(true);
      
      // Load photos from Firestore projectPhotos collection
      const photosQuery = query(
        collection(db, 'projectPhotos'),
        where('projectId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const photosSnapshot = await getDocs(photosQuery);
      
      const photosData: ProjectPhoto[] = photosSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          url: data.photoUrl || '',
          photoUrl: data.photoUrl || '',
          name: data.photoName || data.description || 'Untitled Photo',
          photoName: data.photoName || '',
          description: data.description || '',
          date: data.date || '',
          uploadedBy: data.uploadedBy || 'Unknown',
          uploadedAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
          size: 0
        };
      });
      
      setPhotos(photosData);
      console.log('Photos loaded successfully:', photosData.length);
    } catch (error) {
      console.error('Error loading photos:', error);
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!id || !currentUser) return;
    
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
      // Find the photo entry to get the storage path
      const photo = photos.find(p => p.id === photoId);
      if (!photo) {
        alert('Photo not found');
        return;
      }

      // Delete from Firestore
      await deleteDoc(doc(db, 'projectPhotos', photoId));
      
      // Note: We're not deleting from storage here as the photo structure changed
      // The PhotoManager component handles storage deletion properly
      
      // Reload photos
      await loadPhotos();
      showProjectNotification('Photo deleted successfully', projectName);
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

          {/* Photos Section */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div>
              <div>
                {/* Photo Upload Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Project Photos</h3>
                    <button
                      onClick={() => navigate(`/photos?projectId=${id}`)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 min-h-[44px] touch-manipulation"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Upload Photos</span>
                    </button>
                  </div>
                </div>

                {/* Photos Grid */}
                {photosLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">Loading photos...</p>
                    <p className="text-gray-400 text-xs mt-2">This may take a moment for the first time</p>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">📸</div>
                    <p className="text-gray-500 text-sm">No photos uploaded yet</p>
                    <p className="text-gray-400 text-xs">Upload photos to document your project progress</p>
                    <button
                      onClick={() => navigate(`/photos?projectId=${id}`)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Upload Your First Photo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square">
                        <img
                          src={photo.url || photo.photoUrl || ''}
                          alt={photo.name || photo.description || 'Project photo'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                          }}
                        />
                      </div>
                      
                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                          <button
                            onClick={() => window.open(photo.url || photo.photoUrl || '', '_blank')}
                            className="p-2 bg-white bg-opacity-90 rounded-full hover:bg-opacity-100 transition-colors"
                            title="View full size"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-2 bg-red-500 bg-opacity-90 rounded-full hover:bg-opacity-100 transition-colors"
                            title="Delete photo"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Photo info */}
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-900 truncate" title={photo.description || photo.name}>
                          {photo.description || photo.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          {photo.size && photo.size > 0 && (
                            <span className="text-xs text-gray-500">
                              {formatFileSize(photo.size)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {photo.date ? photo.date : (new Date(photo.uploadedAt).toLocaleDateString())}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-600">${reportData.budget.toLocaleString()}</div>
                  <div className="text-sm text-blue-800">Total Budget</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-orange-600">${reportData.actualCost.toLocaleString()}</div>
                  <div className="text-sm text-orange-800">Actual Cost</div>
                </div>
                <div className={`rounded-xl p-4 ${reportData.isOverBudget ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-2xl font-bold ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(reportData.variance).toLocaleString()}
                  </div>
                  <div className={`text-sm ${reportData.isOverBudget ? 'text-red-800' : 'text-green-800'}`}>
                    {reportData.isOverBudget ? 'Over Budget' : 'Remaining'}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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


