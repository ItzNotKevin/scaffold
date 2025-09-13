# Role-Based Access Control System

This document describes the role-based access control (RBAC) system implemented in the Construction PM application.

## User Roles

### Admin
- **Full access** to all features and data
- Can manage users and assign roles
- Can create, edit, and delete projects
- Can manage company settings
- Can access all check-ins and feedback
- Can delete projects and manage expenses

### Staff
- Can manage projects and check-ins
- Can create new projects (but not delete them)
- Can respond to client feedback
- Can view all project data within their company
- Cannot manage users or company settings

### Client
- **Read-only access** to assigned projects
- Can view project progress and status
- Can submit feedback and concerns
- Cannot create or modify projects
- Cannot access check-ins or administrative features

## Implementation Details

### Database Structure

#### Users Collection
```typescript
interface User {
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
```

#### Firebase Security Rules
The security rules enforce role-based access at the database level:

- **Users**: Can read their own data, admins can manage all users
- **Companies**: Admins have full access, staff/clients can read if they belong to the company
- **Projects**: Role-based access based on company membership and user role
- **Check-ins**: Staff can manage, clients can only read
- **Feedback**: Staff can manage, clients can create their own feedback

### Frontend Components

#### Dashboard Components
- `AdminDashboard`: Full management interface with user management
- `StaffDashboard`: Project and check-in management interface
- `ClientDashboard`: Read-only project viewing interface

#### Permission System
```typescript
interface RolePermissions {
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
```

## Usage

### Setting User Roles
Roles are assigned during user registration or can be updated by admins:

```typescript
// During signup
await signup(email, password, displayName, 'admin');

// Update existing user role (admin only)
await updateUserRole(userId, 'staff');
```

### Checking Permissions
```typescript
const { permissions } = useAuth();

if (permissions?.canManageUsers) {
  // Show user management interface
}

if (permissions?.canCreateProjects) {
  // Show create project button
}
```

### Role-Based UI Rendering
```typescript
const { userProfile } = useAuth();

switch (userProfile?.role) {
  case 'admin':
    return <AdminDashboard />;
  case 'staff':
    return <StaffDashboard />;
  case 'client':
    return <ClientDashboard />;
  default:
    return <ErrorComponent />;
}
```

## Testing

Visit the `/debug` page to test the role system:
- View current user role and permissions
- Test role-based access controls
- Verify permission matrix

## Security Considerations

1. **Client-side permissions** are for UI/UX only
2. **Server-side rules** in Firebase enforce actual data access
3. **Role validation** happens at both authentication and database levels
4. **Permission checks** are performed before rendering sensitive UI elements

## Future Enhancements

- Role inheritance and custom roles
- Time-based permissions
- Project-specific role assignments
- Audit logging for role changes
- Bulk user role management
