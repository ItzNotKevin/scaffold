// User-related types to avoid circular dependencies
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

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  language: string;
}

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
