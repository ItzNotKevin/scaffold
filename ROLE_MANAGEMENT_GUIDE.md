# Role Management System Guide

## Overview
The Construction PM app uses a role-based access control (RBAC) system with two distinct user roles: **Admin** and **Staff**.

## User Roles

### 🔧 Admin
- **Full system access** - Can manage everything
- **User management** - Can create, update, and delete user accounts
- **Role assignment** - Can promote/demote users between admin and staff roles
- **Project management** - Full CRUD access to all projects
- **Company management** - Can manage company settings and data
- **Analytics access** - Can view all reports and analytics
- **Delete projects** - Can delete projects and manage all company data

### 👷 Staff
- **Project management** - Can create, update, and manage projects
- **Check-in management** - Can create and manage daily check-ins
- **Daily reports** - Can create and manage daily reports
- **Project access** - Can view and manage all projects in their company
- **Feedback** - Can view and manage feedback
- **Limited permissions** - Cannot manage users, company settings, or delete projects

## How Roles Are Assigned

### 1. Initial Signup
- **All new users start as "Staff"** by default
- Users cannot self-assign Admin role during signup
- New accounts have staff-level access until promoted by an admin

### 2. Role Promotion (Admin Only)
- Only existing Admins can promote users to Admin role
- This is done through the **User Management** section in the Admin Dashboard
- Admins can change any user's role at any time (except their own)

### 3. Role Demotion
- Admins can demote other admins to staff
- Admins cannot change their own role (security measure)

## Role Management Workflow

### For New Users:
1. **Sign up** with email/password
2. **Start as Staff** role automatically
3. **Join a company** or create a new company
4. **Admin promotes** to Admin role if needed (or you become admin when creating a company)

### For Admins:
1. **Go to Admin Dashboard**
2. **Navigate to "User Management"** section
3. **View all users** in the company
4. **Change roles** using the dropdown next to each user
5. **Changes take effect immediately**

## Security Rules

### Firebase Security Rules
- **Users collection**: Only admins can create/delete users
- **Projects collection**: Admins have full access, Staff can manage assigned projects, Clients can only read
- **Check-ins collection**: Staff and Admins can create/manage, Clients can only read
- **Feedback collection**: All roles can create, Staff and Admins can manage

### Frontend Permissions
- **Conditional rendering** based on user role
- **Protected routes** that check user permissions
- **UI elements** shown/hidden based on role capabilities

## Best Practices

### For Admins:
- **Start conservatively** - Give new users Client role initially
- **Promote gradually** - Move users to Staff role as they prove trustworthy
- **Regular audits** - Periodically review user roles and permissions
- **Document changes** - Keep track of role changes and reasons

### For Staff:
- **Understand limitations** - Know what you can and cannot access
- **Request permissions** - Ask admin for role promotion if needed
- **Follow protocols** - Use the system as intended for your role

### For Clients:
- **Provide feedback** - Use the feedback system to communicate with staff
- **Check regularly** - Monitor project progress through the dashboard
- **Ask questions** - Use the feedback system for any concerns

## Troubleshooting

### "Unknown user role" Error
- This happens when a user's role field is missing or invalid
- **Solution**: Admin should update the user's role in User Management
- **Prevention**: Always ensure new users get a proper role assignment

### Permission Denied Errors
- User is trying to access something their role doesn't allow
- **Solution**: Check if user needs role promotion
- **Alternative**: Contact admin for access

### Role Not Updating
- Changes might take a moment to sync
- **Solution**: Refresh the page or wait a few seconds
- **If persistent**: Check browser console for errors

## Migration from Old System

If you have existing users without roles:
1. **Admin login** required
2. **Go to User Management**
3. **Assign appropriate roles** to existing users
4. **Test functionality** to ensure roles work correctly

## Future Enhancements

Potential improvements to the role system:
- **Custom roles** - Define company-specific roles
- **Role hierarchies** - More granular permission levels
- **Temporary roles** - Time-limited role assignments
- **Bulk role changes** - Update multiple users at once
- **Role audit logs** - Track all role changes over time
