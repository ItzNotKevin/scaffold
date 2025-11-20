import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { TaskAssignment, Reimbursement, StaffMember } from '../lib/types';

interface ActivityLog {
  id: string;
  type: 'assignment' | 'reimbursement';
  date: string;
  staffId: string;
  staffName: string;
  projectId?: string;
  projectName?: string;
  description: string;
  amount?: number;
  createdAt: any;
  // Assignment-specific
  taskDescription?: string;
  dailyRate?: number;
  // Reimbursement-specific
  itemDescription?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

type SortField = 'date' | 'amount' | 'staffName' | 'projectName';
type SortDirection = 'asc' | 'desc';

const ActivityLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'assignment' | 'reimbursement'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Projects list for filtering
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

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
      
      // Load task assignments
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        orderBy('createdAt', 'desc')
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData: ActivityLog[] = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'assignment',
          date: data.date || '',
          staffId: data.staffId || '',
          staffName: data.staffName || 'Unknown Staff',
          projectId: data.projectId || '',
          projectName: data.projectName || 'Unknown Project',
          description: data.taskDescription || '',
          taskDescription: data.taskDescription || '',
          dailyRate: data.dailyRate || 0,
          createdAt: data.createdAt
        };
      });
      
      // Load reimbursements
      const reimbursementsQuery = query(
        collection(db, 'reimbursements'),
        orderBy('createdAt', 'desc')
      );
      const reimbursementsSnapshot = await getDocs(reimbursementsQuery);
      const reimbursementsData: ActivityLog[] = reimbursementsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'reimbursement',
          date: data.date || '',
          staffId: data.staffId || '',
          staffName: data.staffName || 'Unknown Staff',
          projectId: data.projectId || undefined,
          projectName: data.projectName || undefined,
          description: data.itemDescription || '',
          itemDescription: data.itemDescription || '',
          amount: data.amount || 0,
          status: data.status || 'pending',
          createdAt: data.createdAt
        };
      });
      
      // Combine and sort by creation date
      const allActivities = [...assignmentsData, ...reimbursementsData];
      allActivities.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return bTime - aTime;
      });
      
      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort activities
  const filteredAndSortedActivities = useMemo(() => {
    let filtered = [...activities];
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(activity => activity.type === typeFilter);
    }
    
    // Apply staff filter
    if (staffFilter !== 'all') {
      filtered = filtered.filter(activity => activity.staffId === staffFilter);
    }
    
    // Apply project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(activity => activity.projectId === projectFilter);
    }
    
    // Apply status filter (for reimbursements)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(activity => 
        activity.type === 'reimbursement' ? activity.status === statusFilter : true
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'date':
          aValue = a.date || '';
          bValue = b.date || '';
          break;
        case 'amount':
          aValue = a.amount || 0;
          bValue = b.amount || 0;
          break;
        case 'staffName':
          aValue = a.staffName || '';
          bValue = b.staffName || '';
          break;
        case 'projectName':
          aValue = a.projectName || '';
          bValue = b.projectName || '';
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return filtered;
  }, [activities, typeFilter, staffFilter, projectFilter, statusFilter, sortField, sortDirection]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status?: string) => {
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortButton: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-gray-900 touch-manipulation min-h-[44px] px-2 py-1"
    >
      <span>{label}</span>
      {sortField === field && (
        <span className="text-blue-600">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  if (!currentUser || !userProfile) {
    return (
      <Layout title="Activity Logs" currentRole="admin">
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
    <Layout title="Activity Logs" currentRole="admin">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Track staff assignments and reimbursements</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full sm:w-auto">
            Back to Dashboard
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
              >
                <option value="all">All Types</option>
                <option value="assignment">Assignments</option>
                <option value="reimbursement">Reimbursements</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member</label>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
              >
                <option value="all">All Staff</option>
                {staff.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            
            {typeFilter === 'reimbursement' || typeFilter === 'all' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base touch-manipulation min-h-[44px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex items-center space-x-4 pt-3">
                  <SortButton field="date" label="Date" />
                  <SortButton field="amount" label="Amount" />
                  <SortButton field="staffName" label="Staff" />
                </div>
              </div>
            )}
          </div>
          
          {/* Sort controls (when status filter is shown) */}
          {typeFilter === 'reimbursement' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="flex flex-wrap items-center gap-3">
                <SortButton field="date" label="Date" />
                <SortButton field="amount" label="Amount" />
                <SortButton field="staffName" label="Staff" />
                <SortButton field="projectName" label="Project" />
              </div>
            </div>
          )}
        </Card>

        {/* Activity List */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Activities ({filteredAndSortedActivities.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
              <SortButton field="date" label="Date" />
              {typeFilter === 'all' || typeFilter === 'reimbursement' ? (
                <SortButton field="amount" label="Amount" />
              ) : null}
              <SortButton field="staffName" label="Staff" />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">Loading activities...</p>
            </div>
          ) : filteredAndSortedActivities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-gray-500 text-sm">No activities found</p>
              <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.type === 'assignment'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {activity.type === 'assignment' ? '📋 Assignment' : '💰 Reimbursement'}
                      </span>
                      {activity.status && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      )}
                      <span className="text-xs sm:text-sm text-gray-500">
                        {formatDate(activity.date)}
                      </span>
                    </div>
                    
                    <div className="mb-2">
                      <p className="font-medium text-gray-900 text-sm sm:text-base">
                        {activity.staffName}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                        {activity.type === 'assignment' 
                          ? activity.taskDescription || activity.description
                          : activity.itemDescription || activity.description
                        }
                      </p>
                      {activity.projectName && (
                        <p className="text-xs text-gray-500 mt-1 break-words">
                          Project: {activity.projectName}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                      {activity.type === 'assignment' && activity.dailyRate !== undefined && (
                        <span>
                          Rate: <span className="font-medium">{formatCurrency(activity.dailyRate)}/day</span>
                        </span>
                      )}
                      {activity.type === 'reimbursement' && activity.amount !== undefined && (
                        <span>
                          Amount: <span className="font-medium text-green-600">{formatCurrency(activity.amount)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default ActivityLogsPage;

