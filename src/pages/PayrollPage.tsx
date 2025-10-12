import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PayPeriodConfig } from '../lib/types';
import {
  getPayPeriodConfig,
  getRecentPayPeriods,
  generatePayrollReport,
  calculatePayPeriod,
  exportToCSV,
  downloadCSV
} from '../lib/payroll';

const PayrollPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Pay period config
  const [config, setConfig] = useState<PayPeriodConfig | null>(null);
  const [periodType, setPeriodType] = useState<'weekly' | 'biweekly' | 'monthly'>('biweekly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Payroll report
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [periods, setPeriods] = useState<Array<{ start: string; end: string; label: string }>>([]);
  const [reportData, setReportData] = useState<Array<{
    staffId: string;
    staffName: string;
    dailyRate: number;
    assignments: any[];
    daysWorked: number;
    totalWages: number;
  }>>([]);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !userProfile) return;

    // Check if user is admin
    if (permissions && !permissions?.canManageUsers) {
      navigate('/');
      return;
    }

    if (permissions?.canManageUsers && userProfile?.companyId) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, userProfile?.companyId, permissions?.canManageUsers, navigate]);

  const loadConfig = async () => {
    if (!userProfile?.companyId) return;

    setLoading(true);
    try {
      const existingConfig = await getPayPeriodConfig(userProfile.companyId);
      
      if (existingConfig) {
        setConfig(existingConfig);
        setPeriodType(existingConfig.type);
        setStartDate(existingConfig.startDate);
        
        // Generate periods
        const recentPeriods = getRecentPayPeriods(existingConfig, 12);
        setPeriods(recentPeriods);
        
        // Auto-select current period
        const currentPeriod = calculatePayPeriod(existingConfig);
        const currentPeriodStr = `${currentPeriod.start}_${currentPeriod.end}`;
        setSelectedPeriod(currentPeriodStr);
        
        // Load current period report
        loadReport(currentPeriod.start, currentPeriod.end);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!userProfile?.companyId) return;

    setSaving(true);
    try {
      if (config) {
        // Update existing config
        await updateDoc(doc(db, 'payPeriodConfig', config.id), {
          type: periodType,
          startDate,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new config
        await addDoc(collection(db, 'payPeriodConfig'), {
          companyId: userProfile.companyId,
          type: periodType,
          startDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      alert('Pay period configuration saved successfully!');
      await loadConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const loadReport = async (start: string, end: string) => {
    if (!userProfile?.companyId) return;

    setReportLoading(true);
    try {
      const data = await generatePayrollReport(userProfile.companyId, start, end);
      setReportData(data);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePeriodChange = (periodStr: string) => {
    setSelectedPeriod(periodStr);
    const [start, end] = periodStr.split('_');
    if (start && end) {
      loadReport(start, end);
    }
  };

  const handleExport = () => {
    if (reportData.length === 0) {
      alert('No data to export');
      return;
    }

    const [start, end] = selectedPeriod.split('_');
    const csv = exportToCSV(reportData);
    downloadCSV(csv, `payroll_${start}_to_${end}.csv`);
  };

  const totalWages = reportData.reduce((sum, data) => sum + data.totalWages, 0);
  const totalDays = reportData.reduce((sum, data) => sum + data.daysWorked, 0);

  if (loading) {
    return (
      <Layout title={t('payroll.title')} currentRole="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">{t('payroll.loadingPayroll')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t('payroll.title')} currentRole="admin">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('payroll.title')}</h1>
            <p className="text-gray-600 mt-1">{t('payroll.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            {t('payroll.backToDashboard')}
          </Button>
        </div>

        {/* Pay Period Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('payroll.payPeriodConfig')}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('payroll.payPeriodType')}
                </label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as any)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">{t('payroll.weekly')}</option>
                  <option value="biweekly">{t('payroll.biweekly')}</option>
                  <option value="monthly">{t('payroll.monthly')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('payroll.startDate')}
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('payroll.firstDayOfCycle')}
                </p>
              </div>
            </div>

            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? t('common.saving') : t('payroll.saveConfiguration')}
            </Button>
          </div>
        </Card>

        {/* Payroll Reports */}
        {config && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{t('payroll.payrollReports')}</h2>
                <p className="text-sm text-gray-600 mt-1">{t('payroll.viewAndExport')}</p>
              </div>
              <Button onClick={handleExport} variant="outline" disabled={reportData.length === 0}>
                {t('payroll.exportCSV')}
              </Button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('payroll.selectPayPeriod')}
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="w-full md:w-auto px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('payroll.selectPeriod')}</option>
                {periods.map((period, index) => (
                  <option key={index} value={`${period.start}_${period.end}`}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary Stats */}
            {selectedPeriod && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium">{t('payroll.totalStaff')}</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{reportData.length}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-sm text-green-600 font-medium">{t('payroll.totalDaysWorked')}</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{totalDays}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-sm text-purple-600 font-medium">{t('payroll.totalWages')}</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">${totalWages.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Staff Report Table */}
            {reportLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 text-sm mt-2">{t('payroll.loadingReport')}</p>
              </div>
            ) : reportData.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-gray-500 text-sm">{t('payroll.noPayrollData')}</p>
                <p className="text-gray-400 text-xs mt-1">{t('payroll.assignTasksFirst')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reportData.map((staff) => (
                  <div key={staff.staffId} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{staff.staffName}</h3>
                        <p className="text-sm text-gray-600">{t('payroll.dailyRateLabel')}: ${staff.dailyRate.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{t('payroll.daysWorked')}</p>
                        <p className="text-xl font-bold text-gray-900">{staff.daysWorked}</p>
                      </div>
                    </div>

                    {/* Assignments breakdown */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">{t('payroll.assignments')}:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {staff.assignments.map((assignment) => (
                          <div key={assignment.id} className="text-xs text-gray-600">
                            <span className="font-medium">{assignment.date}</span> - {assignment.projectName}: {assignment.taskDescription}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">{t('payroll.totalWages')}</span>
                      <span className="text-lg font-bold text-green-600">${staff.totalWages.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                {/* Grand Total */}
                <div className="bg-gray-900 text-white rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">{t('payroll.grandTotal')}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {reportData.length} staff · {totalDays} days
                      </p>
                    </div>
                    <p className="text-2xl font-bold">${totalWages.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default PayrollPage;

