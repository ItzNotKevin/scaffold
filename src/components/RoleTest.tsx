import React from 'react';
import { useAuth } from '../lib/useAuth';

const RoleTest: React.FC = () => {
  const { userProfile, permissions } = useAuth();

  if (!userProfile || !permissions) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Role & Permissions Test</h3>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 text-sm mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Role & Permissions Test</h3>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Name:</span> {userProfile.name || 'Not set'}</p>
            <p><span className="font-medium">Email:</span> {userProfile.email}</p>
            <p><span className="font-medium">Role:</span> 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                userProfile.role === 'admin' ? 'bg-red-100 text-red-800' :
                userProfile.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {userProfile.role}
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-2">Permissions</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(permissions).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-700">{key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-2">Role Capabilities</h4>
          <div className="text-sm text-gray-700">
            {userProfile.role === 'admin' && (
              <ul className="space-y-1">
                <li>• Manage all users and their roles</li>
                <li>• Create, edit, and delete projects</li>
                <li>• Access all company data and settings</li>
                <li>• Full administrative control</li>
              </ul>
            )}
            {userProfile.role === 'staff' && (
              <ul className="space-y-1">
                <li>• Manage projects and check-ins</li>
                <li>• Create new projects</li>
                <li>• Respond to client feedback</li>
                <li>• View all project data</li>
              </ul>
            )}
            {userProfile.role === 'client' && (
              <ul className="space-y-1">
                <li>• View assigned projects</li>
                <li>• Submit feedback and concerns</li>
                <li>• Track project progress</li>
                <li>• Read-only access to project data</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleTest;
