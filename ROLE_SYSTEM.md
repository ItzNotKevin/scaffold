# Role-Based Access Control System

This document describes the role-based access control (RBAC) system implemented in the Construction PM application.

## User Roles

### Admin
- **Full access** to all features and data
- Can manage users and assign roles
- Can create, edit, and delete projects
- Can manage company settings
- Can access all check-ins, feedback, and daily reports
- Can delete projects and manage expenses
- Can approve daily reports

### Staff
- Can manage projects and check-ins
- Can create new projects (but not delete them)
- Can manage feedback
- Can create and manage daily reports (but not approve them)
- Can view all project data within their company
- Cannot manage users or company settings
- Cannot delete projects or approve daily reports

## Implementation Details

### Database Structure

#### Users Collection
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
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
- **Companies**: Admins have full access, staff can read if they belong to the company
- **Projects**: Admins and staff can read/write projects in their company
- **Check-ins**: Admins and staff can manage check-ins
- **Feedback**: Admins and staff can manage feedback
- **Daily Reports**: Admins and staff can create/edit, only admins can approve

### Frontend Components

#### Dashboard Components
- `AdminDashboard`: Full management interface with user management
- `StaffDashboard`: Project and daily report management interface

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
