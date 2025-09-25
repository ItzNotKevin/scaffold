import React from 'react';
import { useAuth } from '../lib/useAuth';
import UserManagement from './UserManagement';

interface AdminDashboardProps {
  companyId: string;
  projects: any[];
  onNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onNavigateToProject: (projectId: string) => void;
  permissions?: any; // Add permissions prop
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  companyId,
  projects,
  onNewProject,
  onDeleteProject,
  onNavigateToProject,
  permissions
}) => {
  const { userProfile } = useAuth();

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
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 sm:p-6 text-white">
        <h2 className="text-lg sm:text-xl font-bold mb-2">Welcome back, {userProfile?.name || 'Admin'}!</h2>
        <p className="text-blue-100 text-sm">You have full access to manage users, projects, and company settings.</p>
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
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Projects</h3>
          <button 
            onClick={onNewProject} 
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors touch-manipulation w-full sm:w-auto min-h-[44px]"
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
                className="group bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 touch-manipulation"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 
                    onClick={() => onNavigateToProject(p.id)}
                    className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer flex-1 mr-2"
                  >
                    {p.name}
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(p.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px]"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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

      {/* User Management Section */}
      {permissions?.canManageUsers && <UserManagement companyId={companyId} permissions={permissions} />}
    </div>
  );
};

export default AdminDashboard;
