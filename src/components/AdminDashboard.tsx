import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import PendingUsersManager from './PendingUsersManager';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AdminDashboardProps {
  permissions?: any;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  permissions 
}) => {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const navigate = useNavigate();



  return (
    <div className="space-y-6">
      {/* Welcome Section with Navigation Buttons */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 sm:p-6 text-white">
        <h2 className="text-lg sm:text-xl font-bold mb-4">{t('adminDashboard.welcome')}, {userProfile?.name || 'Admin'}!</h2>
        
        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {/* 1. Projects */}
          <button
            onClick={() => navigate('/projects')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Projects</p>
                <p className="text-xs text-blue-100 truncate">View all projects</p>
              </div>
            </div>
          </button>

          {/* 2. Activity Logs */}
          <button
            onClick={() => navigate('/activity-logs')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Activity Logs</p>
                <p className="text-xs text-blue-100 truncate">View all activity</p>
              </div>
            </div>
          </button>

          {/* 3. Staff Assignments */}
          <button
            onClick={() => navigate('/staff-assignments')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Staff Assignments</p>
                <p className="text-xs text-blue-100 truncate">Assign daily tasks</p>
              </div>
            </div>
          </button>

          {/* 4. Expenses */}
          <button
            onClick={() => navigate('/expenses')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Expenses</p>
                <p className="text-xs text-blue-100 truncate">Track expenses</p>
              </div>
            </div>
          </button>

          {/* 5. Income */}
          <button
            onClick={() => navigate('/income')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Income</p>
                <p className="text-xs text-blue-100 truncate">Track income</p>
              </div>
            </div>
          </button>

          {/* 6. Photos */}
          <button
            onClick={() => navigate('/photos')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Photos</p>
                <p className="text-xs text-blue-100 truncate">Manage photos</p>
              </div>
            </div>
          </button>

          {/* 7. Payroll */}
          {permissions?.canManageUsers && (
            <button
              onClick={() => navigate('/payroll')}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">Payroll</p>
                  <p className="text-xs text-blue-100 truncate">View payroll reports</p>
                </div>
              </div>
            </button>
          )}

          {/* 8. Staff Management */}
          {permissions?.canManageUsers && (
            <button
              onClick={() => navigate('/staff-management')}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">Staff Management</p>
                  <p className="text-xs text-blue-100 truncate">Manage staff members</p>
                </div>
              </div>
            </button>
          )}

          {/* 9. Categories */}
          {permissions?.canManageUsers && (
            <button
              onClick={() => navigate('/task-templates')}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/30 touch-manipulation min-h-[72px]"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">Categories</p>
                  <p className="text-xs text-blue-100 truncate">Manage categories</p>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Pending Users Section */}
      <PendingUsersManager />
    </div>
  );
};

export default AdminDashboard;
