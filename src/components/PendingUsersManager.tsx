import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import type { PendingUser } from '../lib/types';
import Button from './ui/Button';
import Card from './ui/Card';

const PendingUsersManager: React.FC = () => {
  const { t } = useTranslation();
  const { getPendingUsers, approvePendingUser, rejectPendingUser } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const users = await getPendingUsers();
      setPendingUsers(users.filter(user => user.status === 'pending'));
    } catch (error) {
      console.error('Error loading pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const handleApprove = async (pendingUserId: string) => {
    if (!confirm('Are you sure you want to approve this user?')) return;
    
    try {
      setProcessing(pendingUserId);
      await approvePendingUser(pendingUserId);
      await loadPendingUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Error approving user. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (pendingUserId: string) => {
    if (!confirm('Are you sure you want to reject this user?')) return;
    
    try {
      setProcessing(pendingUserId);
      await rejectPendingUser(pendingUserId);
      await loadPendingUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Error rejecting user. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pending User Approvals</h3>
          <p className="text-sm text-gray-500">Review and approve new user requests</p>
        </div>
        <Button onClick={loadPendingUsers} variant="outline">
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 text-sm mt-2">Loading pending users...</p>
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-gray-500 text-sm">No pending user requests</p>
          <p className="text-gray-400 text-xs mt-1">All user requests have been processed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <div key={user.id} className="p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-medium text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{user.name}</h4>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400">
                        Requested: {formatDate(user.requestedAt)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(user.id)}
                    disabled={processing === user.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processing === user.id ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReject(user.id)}
                    disabled={processing === user.id}
                    className="text-red-600 hover:text-red-700 border-red-300"
                  >
                    {processing === user.id ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default PendingUsersManager;
