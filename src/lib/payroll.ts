import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { PayPeriodConfig, TaskAssignment } from './types';

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
 */
export const calculateWages = (assignments: TaskAssignment[]): number => {
  return assignments.reduce((sum, assignment) => sum + assignment.dailyRate, 0);
};

/**
 * Calculate days worked (unique dates)
 */
export const calculateDaysWorked = (assignments: TaskAssignment[]): number => {
  const uniqueDates = new Set(assignments.map(a => a.date));
  return uniqueDates.size;
};

/**
 * Get pay period configuration for a company
 */
export const getPayPeriodConfig = async (companyId: string): Promise<PayPeriodConfig | null> => {
  try {
    const configQuery = query(
      collection(db, 'payPeriodConfig'),
      where('companyId', '==', companyId)
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
 * Generate payroll report data for all staff in a company for a specific period
 */
export const generatePayrollReport = async (
  companyId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  staffId: string;
  staffName: string;
  dailyRate: number;
  assignments: TaskAssignment[];
  daysWorked: number;
  totalWages: number;
}>> => {
  try {
    // Get all staff in the company
    const usersQuery = query(
      collection(db, 'users'),
      where('companyId', '==', companyId)
    );
    const usersSnapshot = await getDocs(usersQuery);
    const staff = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Unknown',
      dailyRate: doc.data().dailyRate || 0
    }));
    
    // Get assignments for each staff member
    const reportData = await Promise.all(
      staff.map(async (member) => {
        const assignments = await getAssignmentsForPeriod(member.id, startDate, endDate);
        const daysWorked = calculateDaysWorked(assignments);
        const totalWages = calculateWages(assignments);
        
        return {
          staffId: member.id,
          staffName: member.name,
          dailyRate: member.dailyRate,
          assignments,
          daysWorked,
          totalWages
        };
      })
    );
    
    // Filter out staff with no assignments
    return reportData.filter(data => data.assignments.length > 0);
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
  assignments: TaskAssignment[];
}>): string => {
  const headers = ['Staff Name', 'Days Worked', 'Total Wages', 'Assignments'];
  const rows = reportData.map(data => [
    data.staffName,
    data.daysWorked.toString(),
    `$${data.totalWages.toFixed(2)}`,
    data.assignments.map(a => `${a.date}: ${a.projectName} - ${a.taskDescription}`).join('; ')
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

