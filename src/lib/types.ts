// Type definitions for the Scaffold app

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed';
  startDate: Date;
  endDate?: Date;
  budget: number;
  actualCost: number;
  progress: number;
  team: TeamMember[];
  phase: string;
  createdAt: any;
  updatedAt: any;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  avatar?: string;
}

export interface Task {
  id: string;
  projectId?: string | null; // null for template tasks
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  parentTaskId?: string; // Reference to the original task for recurring tasks
  isTemplate?: boolean; // true for universal template tasks
}

export interface Activity {
  id: string;
  type: 'project' | 'task' | 'team' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  projectId?: string;
  taskId?: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt?: any;
  updatedAt?: any;
}

// Test export to verify the file is working
export const TEST_EXPORT = 'test';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  language: string;
}

export interface Expense {
  id: string;
  projectId: string;
  category: 'materials' | 'labor' | 'equipment' | 'permits' | 'utilities' | 'other';
  description: string;
  amount: number;
  date: Date;
  userId: string;
  userName: string;
  createdAt: any;
  updatedAt: any;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: any;
  updatedAt: any;
}

// @deprecated - Replaced by TaskAssignment system
export interface CheckIn {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  type: 'daily' | 'weekly' | 'milestone' | 'issue';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  photos?: string[];
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  createdAt: any;
  updatedAt: any;
}

// Non-user staff member for task assignments and payroll
export interface StaffMember {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  dailyRate: number; // Flat daily wage
  hireDate?: Date;
  status: 'active' | 'inactive';
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

// Task assignment for staff by admin
export interface TaskAssignment {
  id: string;
  projectId: string;
  projectName: string;
  staffId: string; // References StaffMember.id
  staffName: string;
  taskDescription: string;
  taskId?: string; // Optional reference to task.id if assigned to a project task
  date: string; // YYYY-MM-DD format
  dailyRate: number; // Snapshot of rate at assignment time
  notes?: string;
  createdBy: string; // Admin who assigned
  createdAt: any;
}

// Pay period configuration
export interface PayPeriodConfig {
  id: string;
  type: 'weekly' | 'biweekly' | 'monthly';
  startDate: string; // First day of pay period cycle (YYYY-MM-DD)
  createdAt: any;
  updatedAt: any;
}

// Payroll report for a staff member in a pay period
export interface PayrollReport {
  id: string;
  staffId: string; // References StaffMember.id
  staffName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  assignments: TaskAssignment[];
  totalDays: number;
  totalWages: number;
  status: 'open' | 'closed' | 'paid';
  createdAt: any;
  updatedAt: any;
}

// Pending user awaiting approval
export interface PendingUser {
  id: string;
  email: string;
  name: string;
  requestedAt: any;
  approvedBy?: string;
  approvedAt?: any;
  status: 'pending' | 'approved' | 'rejected';
}

// Reimbursement for materials bought by staff
export interface Reimbursement {
  id: string;
  staffId: string;
  staffName: string;
  projectId?: string;
  projectName?: string;
  itemDescription: string;
  amount: number;
  date: string; // YYYY-MM-DD format
  receiptUrl?: string; // URL to receipt photo in Firebase Storage
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

// Project photo entry with description
export interface ProjectPhotoEntry {
  id: string;
  projectId: string;
  projectName: string;
  photoUrl: string; // URL to photo in Firebase Storage
  photoName: string; // Original filename
  description: string;
  date: string; // YYYY-MM-DD format
  uploadedBy: string; // User ID
  uploadedByName: string; // User name
  createdAt: any;
  updatedAt: any;
}

export interface Feedback {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  type: 'general' | 'issue' | 'suggestion' | 'complaint';
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: any;
  updatedAt: any;
}

export interface DailyReport {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  reportDate: string; // YYYY-MM-DD format
  weather: WeatherData;
  workLog: WorkLogEntry[];
  safetyChecks: SafetyCheck[];
  equipment: EquipmentEntry[];
  materials: MaterialEntry[];
  photos: DailyReportPhoto[];
  notes: string;
  issues: IssueEntry[];
  subcontractors: SubcontractorEntry[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: any;
  approvedAt?: any;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: any;
  updatedAt: any;
}

export interface WeatherData {
  temperature: number;
  condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
  windSpeed?: number;
  humidity?: number;
  notes?: string;
}

export interface WorkLogEntry {
  id: string;
  crewMember: string;
  workPerformed: string;
  hoursWorked: number;
  startTime: string;
  endTime: string;
  location: string;
  notes?: string;
}

export interface SafetyCheck {
  id: string;
  category: 'ppe' | 'equipment' | 'site-conditions' | 'emergency' | 'other';
  description: string;
  status: 'passed' | 'failed' | 'needs-attention';
  notes?: string;
  photos?: string[];
}

export interface EquipmentEntry {
  id: string;
  equipmentName: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'out-of-service';
  hoursUsed?: number;
  fuelUsed?: number;
  maintenanceNotes?: string;
  operator?: string;
}

export interface MaterialEntry {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string;
  deliveryTime?: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
}

export interface DailyReportPhoto {
  id: string;
  url: string;
  caption: string;
  category: 'progress' | 'safety' | 'issue' | 'equipment' | 'materials' | 'general';
  uploadedAt: any;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export interface IssueEntry {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'safety' | 'quality' | 'schedule' | 'cost' | 'other';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  photos?: string[];
  resolution?: string;
  resolvedAt?: any;
  resolvedBy?: string;
}

export interface SubcontractorEntry {
  id: string;
  companyName: string;
  workPerformed: string;
  crewSize: number;
  hoursWorked: number;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
}

// Role-based permission types
export type UserRole = 'admin' | 'staff';

export interface RolePermissions {
  canManageUsers: boolean;
  canManageProjects: boolean;
  canCreateProjects: boolean;
  canDeleteProjects: boolean;
  canManageCheckIns: boolean;
  canCreateCheckIns: boolean;
  canViewAllProjects: boolean;
  canViewProjectDetails: boolean;
  canManageFeedback: boolean;
  canCreateFeedback: boolean;
  canViewFeedback: boolean;
  canManageCompany: boolean;
  canManageDailyReports: boolean;
  canCreateDailyReports: boolean;
  canViewDailyReports: boolean;
  canApproveDailyReports: boolean;
}

// Role-based permission utility
export const getRolePermissions = (role: UserRole): RolePermissions => {
  switch (role) {
    case 'admin':
      return {
        canManageUsers: true,
        canManageProjects: true,
        canCreateProjects: true,
        canDeleteProjects: true,
        canManageCheckIns: true,
        canCreateCheckIns: true,
        canViewAllProjects: true,
        canViewProjectDetails: true,
        canManageFeedback: true,
        canCreateFeedback: true,
        canViewFeedback: true,
        canManageCompany: true,
        canManageDailyReports: true,
        canCreateDailyReports: true,
        canViewDailyReports: true,
        canApproveDailyReports: true,
      };
    case 'staff':
      return {
        canManageUsers: false,
        canManageProjects: true,
        canCreateProjects: true,
        canDeleteProjects: false,
        canManageCheckIns: true,
        canCreateCheckIns: true,
        canViewAllProjects: true,
        canViewProjectDetails: true,
        canManageFeedback: true,
        canCreateFeedback: true,
        canViewFeedback: true,
        canManageCompany: false,
        canManageDailyReports: true,
        canCreateDailyReports: true,
        canViewDailyReports: true,
        canApproveDailyReports: false,
      };
    default:
      return {
        canManageUsers: false,
        canManageProjects: false,
        canCreateProjects: false,
        canDeleteProjects: false,
        canManageCheckIns: false,
        canCreateCheckIns: false,
        canViewAllProjects: false,
        canViewProjectDetails: false,
        canManageFeedback: false,
        canCreateFeedback: false,
        canViewFeedback: false,
        canManageCompany: false,
        canManageDailyReports: false,
        canCreateDailyReports: false,
        canViewDailyReports: false,
        canApproveDailyReports: false,
      };
  }
};

