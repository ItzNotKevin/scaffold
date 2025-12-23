import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import TaskAssignmentManager from '../components/TaskAssignmentManager';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Card from '../components/ui/Card';

const StaffAssignmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [todayAssignments, setTodayAssignments] = useState(0);
  const [todayLaborCost, setTodayLaborCost] = useState(0);

  const loadTodayStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        where('date', '==', today)
      );
      const snapshot = await getDocs(assignmentsQuery);
      const assignments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          // Handle both old format (single task) and new format (tasks array)
          tasks: data.tasks && Array.isArray(data.tasks) 
            ? data.tasks 
            : data.taskDescription 
              ? [{ taskDescription: data.taskDescription, taskId: data.taskId, notes: data.notes }]
              : []
        };
      });
      
      // Count total tasks assigned today (sum of all tasks in all assignments)
      const totalTasks = assignments.reduce((sum: number, a: any) => {
        return sum + (a.tasks?.length || 0);
      }, 0);
      setTodayAssignments(totalTasks);
      
      // Calculate labor cost - only count each staff member's wage once per day
      const dailyWages = new Map<string, number>(); // key: staffId, value: dailyRate
      assignments.forEach((a: any) => {
        const staffId = a.staffId || '';
        const dailyRate = a.dailyRate || 0;
        // Only add if we haven't seen this staff member yet today
        if (!dailyWages.has(staffId)) {
          dailyWages.set(staffId, dailyRate);
        }
      });
      const todayCost = Array.from(dailyWages.values()).reduce((sum: number, rate: number) => sum + rate, 0);
      setTodayLaborCost(todayCost);
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  }, []);

  useEffect(() => {
    loadTodayStats();
  }, [loadTodayStats]);

  if (!currentUser || !userProfile) {
    return (
      <Layout title={t('taskAssignment.title')} currentRole="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t('taskAssignment.title')} currentRole="admin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('taskAssignment.title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{t('taskAssignment.assignDailyTasks')}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation min-h-[44px]"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Today's Stats */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('taskAssignment.staffTaskAssignments')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <p className="text-sm text-green-600 font-medium">{t('taskAssignment.tasksAssignedToday')}</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{todayAssignments}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-600 font-medium">{t('taskAssignment.staffWorkingToday')}</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{todayAssignments}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-sm text-purple-600 font-medium">{t('taskAssignment.todayLaborCost')}</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">${todayLaborCost.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <TaskAssignmentManager 
          onAssignmentCreated={() => {
            // Refresh stats immediately when assignment is created
            setTimeout(() => loadTodayStats(), 100);
          }}
        />
      </div>
    </Layout>
  );
};

export default StaffAssignmentsPage;

