import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { DailyReport } from '../lib/types';
import Button from './ui/Button';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';

interface DailyReportListProps {
  projectId: string;
  onEditReport: (report: DailyReport) => void;
  onCreateReport: () => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

const DailyReportList: React.FC<DailyReportListProps> = ({
  projectId,
  onEditReport,
  onCreateReport,
  canCreate,
  canEdit,
  canDelete,
  canApprove
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');
  const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    if (!projectId) return;

    console.log('Loading daily reports for project:', projectId);

    const q = query(
      collection(db, 'dailyReports'),
      where('projectId', '==', projectId)
      // Temporarily removed orderBy until index is created
      // orderBy('reportDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('Daily reports query result:', snapshot.docs.length, 'documents found');
        console.log('Query snapshot:', snapshot);
        const reportsData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Report data:', doc.id, data);
          console.log('Photos in report:', data.photos);
          return {
            id: doc.id,
            ...data
          } as DailyReport;
        });
        
        // Sort by reportDate descending (client-side sorting)
        reportsData.sort((a, b) => {
          const dateA = new Date(a.reportDate);
          const dateB = new Date(b.reportDate);
          return dateB.getTime() - dateA.getTime();
        });
        
        setReports(reportsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching daily reports:', error);
        setLoading(false);
      }
    );

    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('Daily reports query timeout - stopping loading state');
      setLoading(false);
    }, 10000); // 10 second timeout

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [projectId]);

  const handleDelete = async (reportId: string) => {
    if (!canDelete || !window.confirm('Are you sure you want to delete this report?')) return;
    
    try {
      await deleteDoc(doc(db, 'dailyReports', reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const handleApprove = async (reportId: string) => {
    if (!canApprove || !currentUser) return;
    
    try {
      await updateDoc(doc(db, 'dailyReports', reportId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName || 'Unknown User',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error approving report:', error);
    }
  };

  const handleReject = async (reportId: string) => {
    if (!canApprove || !currentUser) return;
    
    try {
      await updateDoc(doc(db, 'dailyReports', reportId), {
        status: 'rejected',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName || 'Unknown User',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error rejecting report:', error);
    }
  };

  const filteredReports = reports.filter(report => {
    if (filter === 'all') return true;
    return report.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <div className="text-gray-500">Loading daily reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('dailyReport.title')}
        subtitle={`${reports.length} ${t('dailyReport.reportsFound')}`}
      >
        {canCreate && (
          <Button onClick={onCreateReport}>
            Create Report
          </Button>
        )}
      </PageHeader>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'All', count: reports.length },
          { key: 'draft', label: 'Draft', count: reports.filter(r => r.status === 'draft').length },
          { key: 'submitted', label: 'Submitted', count: reports.filter(r => r.status === 'submitted').length },
          { key: 'approved', label: 'Approved', count: reports.filter(r => r.status === 'approved').length },
          { key: 'rejected', label: 'Rejected', count: reports.filter(r => r.status === 'rejected').length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 touch-manipulation min-h-[44px] ${
              filter === key 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' 
              ? 'No daily reports yet'
              : `No ${filter} reports found`
            }
          </h3>
          <p className="text-gray-500 mb-6">
            {filter === 'all' 
              ? 'Start documenting your project progress with daily reports.'
              : `No reports with ${filter} status found.`
            }
          </p>
          {canCreate && (
            <Button onClick={onCreateReport} size="lg">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create First Report
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="p-6 hover:shadow-md transition-shadow duration-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Daily Report - {formatDate(report.reportDate)}
                    </h3>
                    <p className="text-sm text-gray-500">by {report.userName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setViewingReport(report)}
                      size="sm"
                      variant="outline"
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Details
                    </Button>
                    
                    {canEdit && report.status === 'draft' && (
                      <Button
                        onClick={() => onEditReport(report)}
                        size="sm"
                        variant="outline"
                      >
                        Edit
                      </Button>
                    )}
                    
                    {canApprove && report.status === 'submitted' && (
                      <>
                        <Button
                          onClick={() => handleApprove(report.id)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject(report.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {canDelete && (
                      <Button
                        onClick={() => handleDelete(report.id)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700">Weather</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {report.weather.temperature}°C, {report.weather.condition}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700">Work Log</span>
                      </div>
                      <p className="text-sm text-gray-600">{report.workLog.length} entries</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700">Safety</span>
                      </div>
                      {report.safetyChecks.length > 0 ? (
                        <div className="space-y-1">
                          {report.safetyChecks.slice(0, 2).map((check, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${check.status === 'passed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span className="text-xs text-gray-600 truncate">{check.description || check.category}</span>
                            </div>
                          ))}
                          {report.safetyChecks.length > 2 && (
                            <p className="text-xs text-gray-500">+{report.safetyChecks.length - 2} more</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">No safety checks</p>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700">Photos</span>
                      </div>
                      {report.photos && report.photos.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1">
                            {report.photos.slice(0, 3).map((photo, index) => {
                              console.log('Photo data:', photo);
                              return (
                                <img
                                  key={index}
                                  src={photo.url}
                                  alt={photo.caption}
                                  className="w-6 h-6 rounded-full object-cover border-2 border-white"
                                  onError={(e) => console.error('Image load error:', e)}
                                />
                              );
                            })}
                          </div>
                          <span className="text-xs text-gray-600">{report.photos.length} photos</span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">No photos</p>
                      )}
                    </div>
                  </div>

                  {report.notes && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <span className="text-xs font-medium text-blue-800">Notes</span>
                      <p className="text-sm text-blue-700 mt-1 line-clamp-2">
                        {report.notes}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Created {formatTimestamp(report.createdAt)}
                    {report.submittedAt && (
                      <span> • Submitted {formatTimestamp(report.submittedAt)}</span>
                    )}
                    {report.approvedAt && (
                      <span> • Approved by {report.approvedByName}</span>
                    )}
                  </div>

                  {report.issues.length > 0 && (
                    <div className="mt-3">
                      <span className="font-medium text-sm">Issues:</span>
                      <p className="text-sm text-gray-600">
                        {report.issues.length} issue{report.issues.length !== 1 ? 's' : ''} reported
                      </p>
                    </div>
                  )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detailed Report Modal */}
      {viewingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Daily Report Details</h2>
                    <p className="text-sm text-gray-600">
                      {new Date(viewingReport.reportDate).toLocaleDateString('en-CA', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setViewingReport(null)}
                  variant="outline"
                  size="sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </Button>
              </div>

              {/* Report Content */}
              <div className="space-y-6">
                {/* Weather Section */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    Weather Conditions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Temperature</p>
                      <p className="text-lg font-semibold">{viewingReport.weather.temperature}°C</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Wind Speed</p>
                      <p className="text-lg font-semibold">{viewingReport.weather.windSpeed} km/h</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Humidity</p>
                      <p className="text-lg font-semibold">{viewingReport.weather.humidity}%</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Condition</p>
                    <p className="text-lg font-semibold capitalize">{viewingReport.weather.condition}</p>
                  </div>
                  {viewingReport.weather.notes && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="text-sm">{viewingReport.weather.notes}</p>
                    </div>
                  )}
                </Card>

                {/* Work Log Section */}
                {viewingReport.workLog && viewingReport.workLog.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Work Log
                    </h3>
                    <div className="space-y-4">
                      {viewingReport.workLog.map((entry, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Crew Member</p>
                              <p className="font-medium">{entry.crewMember}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Work Performed</p>
                              <p className="font-medium">{entry.workPerformed}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Start Time</p>
                              <p className="font-medium">{entry.startTime}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">End Time</p>
                              <p className="font-medium">{entry.endTime}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Hours Worked</p>
                              <p className="font-medium">{entry.hoursWorked} hours</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Location</p>
                              <p className="font-medium">{entry.location}</p>
                            </div>
                          </div>
                          {entry.notes && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600">Notes</p>
                              <p className="text-sm">{entry.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Safety Checks Section */}
                {viewingReport.safetyChecks && viewingReport.safetyChecks.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Safety Checks
                    </h3>
                    <div className="space-y-3">
                      {viewingReport.safetyChecks.map((check, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className={`w-3 h-3 rounded-full ${check.status === 'passed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div className="flex-1">
                            <span className="font-medium">{check.description || check.category}</span>
                            <span className="text-sm text-gray-500 ml-2">({check.status})</span>
                          </div>
                          {check.notes && (
                            <span className="text-sm text-gray-600">- {check.notes}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Equipment Section */}
                {viewingReport.equipment && viewingReport.equipment.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      Equipment
                    </h3>
                    <div className="space-y-3">
                      {viewingReport.equipment.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{item.equipmentName}</p>
                            <p className="text-sm text-gray-600">
                              {item.hoursUsed} hours used • {item.condition} condition
                            </p>
                          </div>
                          {item.notes && (
                            <p className="text-sm text-gray-600">{item.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Materials Section */}
                {viewingReport.materials && viewingReport.materials.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Materials
                    </h3>
                    <div className="space-y-3">
                      {viewingReport.materials.map((material, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{material.materialName}</p>
                            <p className="text-sm text-gray-600">
                              {material.quantity} {material.unit} • {material.condition} condition
                            </p>
                          </div>
                          {material.supplier && (
                            <p className="text-sm text-gray-600">Supplier: {material.supplier}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Issues Section */}
                {viewingReport.issues && viewingReport.issues.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Issues & Concerns
                    </h3>
                    <div className="space-y-3">
                      {viewingReport.issues.map((issue, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                              issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="font-medium">{issue.title}</span>
                          </div>
                          <p className="text-sm text-gray-600">{issue.description}</p>
                          {issue.assignedTo && (
                            <p className="text-sm text-gray-500 mt-1">Assigned to: {issue.assignedToName || issue.assignedTo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Subcontractors Section */}
                {viewingReport.subcontractors && viewingReport.subcontractors.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Subcontractors
                    </h3>
                    <div className="space-y-3">
                      {viewingReport.subcontractors.map((sub, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium">{sub.companyName}</p>
                          <p className="text-sm text-gray-600">{sub.workPerformed}</p>
                          <p className="text-sm text-gray-500">
                            Crew: {sub.crewSize} people • Hours: {sub.hoursWorked}
                          </p>
                          {sub.contactPerson && (
                            <p className="text-sm text-gray-500">Contact: {sub.contactPerson}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Notes Section */}
                {viewingReport.notes && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Additional Notes
                    </h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingReport.notes}</p>
                  </Card>
                )}

                {/* Photos Section */}
                {viewingReport.photos && viewingReport.photos.length > 0 ? (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Photos ({viewingReport.photos.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {viewingReport.photos.map((photo, index) => {
                        console.log('Detailed view photo:', photo);
                        return (
                          <div key={index} className="relative group cursor-pointer" onClick={() => {
                            // Open image in new tab for full view
                            window.open(photo.url, '_blank');
                          }}>
                            <img
                              src={photo.url}
                              alt={photo.caption}
                              className="w-full h-48 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                              onError={(e) => console.error('Detailed view image load error:', e)}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <div className="bg-white bg-opacity-90 rounded-full p-3">
                                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white p-3 rounded-b-lg">
                              <p className="text-sm font-medium truncate">{photo.caption}</p>
                              <p className="text-xs opacity-75">Click to view full size</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Photos
                    </h3>
                    <p className="text-gray-500">No photos uploaded</p>
                  </Card>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div>
                    <p>Report by: {viewingReport.userName}</p>
                    <p>Created: {new Date(viewingReport.createdAt?.toDate?.() || viewingReport.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p>Status: <span className={`font-medium ${
                      viewingReport.status === 'approved' ? 'text-green-600' :
                      viewingReport.status === 'rejected' ? 'text-red-600' :
                      viewingReport.status === 'submitted' ? 'text-blue-600' :
                      'text-gray-600'
                    }`}>{viewingReport.status.toUpperCase()}</span></p>
                    {viewingReport.approvedAt && (
                      <p>Approved: {new Date(viewingReport.approvedAt?.toDate?.() || viewingReport.approvedAt).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportList;
