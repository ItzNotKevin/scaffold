import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';

// Define types locally to match useAuth
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'client';
  avatar?: string;
  preferences: any;
  companyId?: string;
  createdAt?: any;
  updatedAt?: any;
}

type UserRole = 'admin' | 'staff' | 'client';

interface UserManagementProps {
  companyId: string;
  permissions?: any;
}

const UserManagement: React.FC<UserManagementProps> = ({ companyId, permissions: propPermissions }) => {
  const { updateUserRole, permissions: authPermissions, currentUser } = useAuth();
  const permissions = propPermissions || authPermissions;
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [companyId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Get all users in this company
      const usersQuery = query(
        collection(db, 'users'),
        where('companyId', '==', companyId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      
      // Get roles from companyMemberships for each user
      const usersWithRoles = await Promise.all(
        usersData.map(async (user) => {
          try {
            // Check company membership
            const membershipDoc = await getDoc(doc(db, 'companyMemberships', `${user.id}_${companyId}`));
            if (membershipDoc.exists()) {
              const membership = membershipDoc.data();
              return { ...user, role: membership.role };
            }
            
            // Check if user is company owner
            const companyDoc = await getDoc(doc(db, 'companies', companyId));
            if (companyDoc.exists()) {
              const companyData = companyDoc.data();
              if (companyData.ownerId === user.id) {
                return { ...user, role: 'admin' };
              }
            }
            
            // Default to client if no membership found
            return { ...user, role: 'client' };
          } catch (error) {
            console.error('Error loading role for user:', user.id, error);
            return { ...user, role: 'client' };
          }
        })
      );
      
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdating(userId);
      await updateUserRole(userId, newRole, companyId);
      await loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user role:', error);
    } finally {
      setUpdating(null);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'staff':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'client':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!permissions?.canManageUsers) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🔒</div>
          <p className="text-gray-500 text-sm">You don't have permission to manage users</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 text-sm mt-2">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-500">Manage user roles and permissions for your company</p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation min-h-[44px] w-full sm:w-auto"
        >
          Refresh
        </button>
      </div>

      <div className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-blue-900">Role Management Tips</h4>
            <ul className="text-xs text-blue-800 mt-1 space-y-0.5 sm:space-y-1">
              <li>• <strong>Client:</strong> View projects and submit feedback</li>
              <li>• <strong>Staff:</strong> Manage projects and check-ins</li>
              <li>• <strong>Admin:</strong> Full access including user management</li>
              <li>• New users start as Clients</li>
              <li>• <strong>Security:</strong> Cannot change your own role</li>
            </ul>
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-gray-500 text-sm">No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="p-4 bg-gray-50 rounded-xl border border-gray-100"
            >
              <div className="flex items-start sm:items-center gap-3 mb-3 sm:mb-0">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-medium text-sm">
                    {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm truncate">{user.name || 'No name'}</p>
                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)} w-fit`}>
                  {user.role === 'admin' ? 'admin' : user.role === 'staff' ? 'staff' : 'client'}
                </span>
                
                {user.id === currentUser?.uid ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 italic">(You)</span>
                    <span className="text-xs text-gray-400">Cannot change own role</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      disabled={updating === user.id}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 touch-manipulation min-h-[32px]"
                    >
                      <option value="client">Client</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>

                    {updating === user.id && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
