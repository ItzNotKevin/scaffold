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
  companyId: string;
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
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  parentTaskId?: string; // Reference to the original task for recurring tasks
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
  role: 'admin' | 'staff' | 'client';
  avatar?: string;
  preferences: UserPreferences;
  companyId?: string;
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

// Role-based permission types
export type UserRole = 'admin' | 'staff' | 'client';

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
      };
    case 'client':
      return {
        canManageUsers: false,
        canManageProjects: false,
        canCreateProjects: false,
        canDeleteProjects: false,
        canManageCheckIns: false,
        canCreateCheckIns: false,
        canViewAllProjects: false,
        canViewProjectDetails: true,
        canManageFeedback: false,
        canCreateFeedback: true,
        canViewFeedback: true,
        canManageCompany: false,
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
      };
  }
};

