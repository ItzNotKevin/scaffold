import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';

// Define types locally to match useAuth
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  avatar?: string;
  preferences: any;
  companyId?: string;
  dailyRate?: number;
  createdAt?: any;
  updatedAt?: any;
}

type UserRole = 'admin' | 'staff';

interface UserManagementProps {
  companyId: string;
  permissions?: any;
}

const UserManagement: React.FC<UserManagementProps> = ({ companyId, permissions: propPermissions }) => {
  const { t } = useTranslation();
  const { updateUserRole, permissions: authPermissions, currentUser } = useAuth();
  const permissions = propPermissions || authPermissions;
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState<string>('');

  useEffect(() => {
    if (companyId) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            
            // Default to staff if no membership found
            return { ...user, role: 'staff' };
          } catch (error) {
            console.error('Error loading role for user:', user.id, error);
            return { ...user, role: 'staff' };
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

  const handleDailyRateUpdate = async (userId: string, newRate: number) => {
    try {
      setUpdating(userId);
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        dailyRate: newRate,
        updatedAt: serverTimestamp()
      });
      await loadUsers(); // Refresh the list
      setEditingRate(null);
    } catch (error) {
      console.error('Error updating daily rate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const startEditingRate = (userId: string, currentRate?: number) => {
    setEditingRate(userId);
    setRateValue(currentRate?.toString() || '0');
  };

  const cancelEditingRate = () => {
    setEditingRate(null);
    setRateValue('');
  };

  const saveRate = (userId: string) => {
    const rate = parseFloat(rateValue);
    if (!isNaN(rate) && rate >= 0) {
      handleDailyRateUpdate(userId, rate);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'staff':
        return 'bg-blue-100 text-blue-800 border-blue-200';
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
          <h3 className="text-lg font-semibold text-gray-900">{t('userManagement.title')}</h3>
          <p className="text-sm text-gray-500">{t('userManagement.manageUserRoles')}</p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation min-h-[44px] w-full sm:w-auto"
        >
          {t('userManagement.refreshUsers')}
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
            <h4 className="text-sm font-medium text-blue-900">{t('userManagement.roleManagementTips')}</h4>
            <ul className="text-xs text-blue-800 mt-1 space-y-0.5 sm:space-y-1">
              <li>• <strong>Staff:</strong> {t('userManagement.staffRole')}</li>
              <li>• <strong>Admin:</strong> {t('userManagement.adminRole')}</li>
              <li>• {t('userManagement.newUsersStartAsStaff')}</li>
              <li>• <strong>Security:</strong> {t('userManagement.cannotChangeOwnRole')}</li>
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
                  <p className="font-medium text-gray-900 text-sm truncate">{user.name || t('userManagement.noName')}</p>
                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="text-xs text-gray-600 font-medium">{t('company.role')}:</span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)} w-fit`}>
                    {user.role === 'admin' ? t('userManagement.admin') : t('userManagement.staff')}
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
                        <option value="staff">{t('userManagement.staff')}</option>
                        <option value="admin">{t('userManagement.admin')}</option>
                      </select>

                      {updating === user.id && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="text-xs text-gray-600 font-medium">{t('userManagement.dailyRate')}:</span>
                  {editingRate === user.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <span className="text-xs text-gray-600 mr-1">$</span>
                        <input
                          type="number"
                          value={rateValue}
                          onChange={(e) => setRateValue(e.target.value)}
                          className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[32px]"
                          min="0"
                          step="1"
                        />
                      </div>
                      <button
                        onClick={() => saveRate(user.id)}
                        disabled={updating === user.id}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 min-h-[32px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditingRate}
                        disabled={updating === user.id}
                        className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-300 disabled:opacity-50 min-h-[32px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        ${user.dailyRate?.toFixed(2) || '0.00'}/day
                      </span>
                      <button
                        onClick={() => startEditingRate(user.id, user.dailyRate)}
                        disabled={updating === user.id}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
