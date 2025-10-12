import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { TaskAssignment } from '../lib/types';

interface StaffDashboardProps {
  companyId: string;
  projects: any[];
  onNewProject: () => void;
  onNavigateToProject: (projectId: string) => void;
  permissions?: any;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({
  companyId,
  projects,
  onNewProject,
  onNavigateToProject,
  permissions
}) => {
  const { t } = useTranslation();
  const { userProfile, currentUser } = useAuth();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [daysWorked, setDaysWorked] = useState(0);
  const [estimatedWages, setEstimatedWages] = useState(0);

  const loadAssignments = React.useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Calculate date range based on selected period
      const now = new Date();
      let startDate = new Date();
      
      if (selectedPeriod === 'today') {
        startDate = new Date();
      } else if (selectedPeriod === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedPeriod === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      }
      
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        where('staffId', '==', currentUser.uid),
        where('date', '>=', startDateStr)
      );
      
      const snapshot = await getDocs(assignmentsQuery);
      const assignmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskAssignment[];
      
      console.log('StaffDashboard: Loaded assignments:', assignmentsData.length, assignmentsData);
      
      // Sort by date descending
      assignmentsData.sort((a, b) => b.date.localeCompare(a.date));
      
      setAssignments(assignmentsData);
      
      // Calculate stats
      const uniqueDates = new Set(assignmentsData.map(a => a.date));
      setDaysWorked(uniqueDates.size);
      setEstimatedWages(assignmentsData.reduce((sum, a) => sum + a.dailyRate, 0));
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      // Check if it's an index error
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        console.error('FIRESTORE INDEX REQUIRED: Please deploy firestore.indexes.json');
        alert('Firestore index required. Please deploy the Firestore indexes.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, selectedPeriod]);

  useEffect(() => {
    if (currentUser) {
      loadAssignments();
    }
  }, [loadAssignments, currentUser]);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Sales': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Contract': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Materials': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Construction': return 'bg-green-100 text-green-800 border-green-200';
      case 'Completion': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPhaseProgress = (phase: string) => {
    switch (phase) {
      case 'Sales': return { progress: 20, step: 1, total: 5 };
      case 'Contract': return { progress: 40, step: 2, total: 5 };
      case 'Materials': return { progress: 60, step: 3, total: 5 };
      case 'Construction': return { progress: 80, step: 4, total: 5 };
      case 'Completion': return { progress: 100, step: 5, total: 5 };
      default: return { progress: 20, step: 1, total: 5 };
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl p-4 sm:p-6 text-white">
        <h2 className="text-lg sm:text-xl font-bold mb-2">{t('staffDashboard.welcome')}, {userProfile?.name || 'Staff'}!</h2>
        <p className="text-green-100 text-sm leading-relaxed">{t('staffDashboard.subtitle')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
              <p className="text-sm text-gray-500">Total Projects</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {projects.filter(p => p.phase === 'Construction').length}
              </p>
              <p className="text-sm text-gray-500">Active Projects</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {projects.filter(p => p.phase === 'Completion').length}
              </p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
          <button 
            onClick={onNewProject} 
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors touch-manipulation"
          >
            New Project
          </button>
        </div>
        
        {projects.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-gray-500 text-sm">No projects yet</p>
            <p className="text-gray-400 text-xs">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: any) => (
              <div
                key={p.id}
                className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 touch-manipulation"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 
                    onClick={() => onNavigateToProject(p.id)}
                    className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer flex-1 mr-2"
                  >
                    {p.name}
                  </h4>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{getPhaseProgress(p.phase || 'Sales').step}/{getPhaseProgress(p.phase || 'Sales').total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getPhaseProgress(p.phase || 'Sales').progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPhaseColor(p.phase || 'Sales')}`}>
                    {p.phase || 'Sales'}
                  </span>
                  <button
                    onClick={() => onNavigateToProject(p.id)}
                    className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors touch-manipulation"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Assignments Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('staffDashboard.myAssignments')}</h3>
            <p className="text-sm text-gray-500">{t('staffDashboard.viewAssignedTasks')}</p>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">{t('staffDashboard.today')}</option>
            <option value="week">{t('staffDashboard.thisWeek')}</option>
            <option value="month">{t('staffDashboard.thisMonth')}</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-600 font-medium">{t('staffDashboard.daysWorked')}</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{daysWorked}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-sm text-green-600 font-medium">{t('staffDashboard.totalAssignments')}</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{assignments.length}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-sm text-purple-600 font-medium">{t('staffDashboard.estimatedWages')}</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">${estimatedWages.toFixed(2)}</p>
          </div>
        </div>

        {/* Assignments List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">{t('staffDashboard.loadingAssignments')}</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-gray-500 text-sm">{t('staffDashboard.noAssignmentsForPeriod')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('staffDashboard.checkBackLater')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(assignment => (
              <div key={assignment.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {assignment.date}
                      </span>
                      <span className="text-xs text-gray-500">${assignment.dailyRate.toFixed(2)}/day</span>
                    </div>
                    <p className="font-medium text-gray-900 mb-1">{assignment.projectName}</p>
                    <p className="text-sm text-gray-700 mb-2">{assignment.taskDescription}</p>
                    {assignment.notes && (
                      <p className="text-xs text-gray-500 italic">{assignment.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
