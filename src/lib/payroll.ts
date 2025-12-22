import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { PayPeriodConfig, TaskAssignment, Reimbursement } from './types';

/**
 * Calculate pay period dates based on config and current date
 */
export const calculatePayPeriod = (config: PayPeriodConfig, date: Date = new Date()): { start: string; end: string } => {
  const startDate = new Date(config.startDate);
  const currentDate = new Date(date);
  
  // Calculate how many periods have elapsed
  let periodLength = 7; // default weekly
  if (config.type === 'biweekly') {
    periodLength = 14;
  } else if (config.type === 'monthly') {
    periodLength = 30; // approximate
  }
  
  const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const periodsElapsed = Math.floor(daysSinceStart / periodLength);
  
  const periodStart = new Date(startDate);
  periodStart.setDate(startDate.getDate() + (periodsElapsed * periodLength));
  
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + periodLength - 1);
  
  return {
    start: periodStart.toISOString().split('T')[0],
    end: periodEnd.toISOString().split('T')[0]
  };
};

/**
 * Get list of recent pay periods
 */
export const getRecentPayPeriods = (config: PayPeriodConfig, count: number = 6): Array<{ start: string; end: string; label: string }> => {
  const periods: Array<{ start: string; end: string; label: string }> = [];
  const today = new Date();
  
  let periodLength = 7;
  if (config.type === 'biweekly') {
    periodLength = 14;
  } else if (config.type === 'monthly') {
    periodLength = 30;
  }
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - (i * periodLength));
    
    const period = calculatePayPeriod(config, date);
    const label = `${period.start} to ${period.end}`;
    
    periods.push({ ...period, label });
  }
  
  return periods;
};

/**
 * Get all assignments for a staff member in a specific period
 */
export const getAssignmentsForPeriod = async (
  staffId: string,
  startDate: string,
  endDate: string
): Promise<TaskAssignment[]> => {
  try {
    const assignmentsQuery = query(
      collection(db, 'taskAssignments'),
      where('staffId', '==', staffId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(assignmentsQuery);
    const assignments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TaskAssignment[];
    
    return assignments;
  } catch (error) {
    console.error('Error getting assignments for period:', error);
    return [];
  }
};

/**
 * Calculate total wages for a staff member in a period
 * Only counts wage once per day, even if staff has multiple tasks that day
 */
export const calculateWages = (assignments: TaskAssignment[]): number => {
  // Group by staffId and date, only count each staff member's wage once per day
  const dailyWages = new Map<string, number>(); // key: `${staffId}_${date}`, value: dailyRate
  
  assignments.forEach(assignment => {
    const key = `${assignment.staffId}_${assignment.date}`;
    // Only add if we haven't seen this staff member on this date yet
    if (!dailyWages.has(key)) {
      dailyWages.set(key, assignment.dailyRate);
    }
  });
  
  // Sum all unique daily wages
  return Array.from(dailyWages.values()).reduce((sum, rate) => sum + rate, 0);
};

/**
 * Calculate days worked (unique dates)
 */
export const calculateDaysWorked = (assignments: TaskAssignment[]): number => {
  const uniqueDates = new Set(assignments.map(a => a.date));
  return uniqueDates.size;
};

/**
 * Get pay period configuration
 */
export const getPayPeriodConfig = async (): Promise<PayPeriodConfig | null> => {
  try {
    const configQuery = query(
      collection(db, 'payPeriodConfig')
    );
    
    const snapshot = await getDocs(configQuery);
    
    if (snapshot.empty) {
      return null;
    }
    
    const configDoc = snapshot.docs[0];
    return {
      id: configDoc.id,
      ...configDoc.data()
    } as PayPeriodConfig;
  } catch (error) {
    console.error('Error getting pay period config:', error);
    return null;
  }
};

/**
 * Get reimbursements for a staff member in a period
 */
export const getReimbursementsForPeriod = async (
  staffId: string,
  startDate: string,
  endDate: string
): Promise<Reimbursement[]> => {
  try {
    // Query with staffId and status only, then filter by date in client
    const reimbursementsQuery = query(
      collection(db, 'reimbursements'),
      where('staffId', '==', staffId),
      where('status', '==', 'approved')
    );
    
    const snapshot = await getDocs(reimbursementsQuery);
    
    // Filter by date range in client-side
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reimbursement))
      .filter(r => r.date >= startDate && r.date <= endDate);
  } catch (error) {
    console.error('Error getting reimbursements:', error);
    return [];
  }
};

/**
 * Calculate total reimbursements amount
 */
export const calculateReimbursements = (reimbursements: Reimbursement[]): number => {
  return reimbursements.reduce((total, reimbursement) => total + reimbursement.amount, 0);
};

/**
 * Generate payroll report data for all staff for a specific period
 */
export const generatePayrollReport = async (
  startDate: string,
  endDate: string
): Promise<Array<{
  staffId: string;
  staffName: string;
  dailyRate: number;
  assignments: TaskAssignment[];
  reimbursements: Reimbursement[];
  daysWorked: number;
  totalWages: number;
  totalReimbursements: number;
  totalPayout: number;
}>> => {
  try {
    // Get all staff members
    const staffSnapshot = await getDocs(collection(db, 'staffMembers'));
    const staff = staffSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get assignments and reimbursements for each staff member
    const reportData = await Promise.all(
      staff.map(async (member) => {
        const assignments = await getAssignmentsForPeriod(member.id, startDate, endDate);
        const reimbursements = await getReimbursementsForPeriod(member.id, startDate, endDate);
        const daysWorked = calculateDaysWorked(assignments);
        const totalWages = calculateWages(assignments);
        const totalReimbursements = calculateReimbursements(reimbursements);
        const totalPayout = totalWages + totalReimbursements;
        
        return {
          staffId: member.id,
          staffName: member.name,
          dailyRate: member.dailyRate,
          assignments,
          reimbursements,
          daysWorked,
          totalWages,
          totalReimbursements,
          totalPayout
        };
      })
    );
    
    // Filter out staff with no assignments or reimbursements
    return reportData.filter(data => data.assignments.length > 0 || data.reimbursements.length > 0);
  } catch (error) {
    console.error('Error generating payroll report:', error);
    return [];
  }
};

/**
 * Export payroll report to CSV
 */
export const exportToCSV = (reportData: Array<{
  staffName: string;
  daysWorked: number;
  totalWages: number;
  totalReimbursements?: number;
  totalPayout?: number;
  assignments: TaskAssignment[];
  reimbursements?: Reimbursement[];
}>): string => {
  const headers = ['Staff Name', 'Days Worked', 'Total Wages', 'Reimbursements', 'Total Payout', 'Assignments', 'Reimbursement Details'];
  const rows = reportData.map(data => [
    data.staffName,
    data.daysWorked.toString(),
    `$${data.totalWages.toFixed(2)}`,
    `$${(data.totalReimbursements || 0).toFixed(2)}`,
    `$${(data.totalPayout || data.totalWages).toFixed(2)}`,
    data.assignments.map(a => `${a.date}: ${a.projectName} - ${a.taskDescription}`).join('; '),
    (data.reimbursements || []).map(r => `${r.date}: ${r.itemDescription} - $${r.amount.toFixed(2)}`).join('; ')
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csv;
};

/**
 * Download CSV file
 */
export const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

