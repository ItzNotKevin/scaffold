# Manual Firestore Rules Deployment

Since Firebase CLI authentication is not available, you'll need to deploy the Firestore rules manually through the Firebase Console.

## Steps to Deploy Rules:

### 1. Go to Firebase Console
- Visit: https://console.firebase.google.com/
- Select your project: `construction-pm`

### 2. Navigate to Firestore
- Click on "Firestore Database" in the left sidebar
- Click on the "Rules" tab

### 3. Replace the Rules
Copy and paste this secure rule set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Companies: users can read/write if they're the owner or a member
    match /companies/{companyId} {
      allow read, write: if request.auth != null && 
        (resource.data.ownerId == request.auth.uid || 
         request.auth.uid in resource.data.members);
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.ownerId;
    }
    
    // Projects: users can read/write if they belong to the project's company
    match /projects/{projectId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/companies/$(resource.data.companyId)) &&
        (get(/databases/$(database)/documents/companies/$(resource.data.companyId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/companies/$(resource.data.companyId)).data.members);
      allow create: if request.auth != null && 
        exists(/databases/$(database)/documents/companies/$(request.resource.data.companyId)) &&
        (get(/databases/$(database)/documents/companies/$(request.resource.data.companyId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/companies/$(request.resource.data.companyId)).data.members);
    }
    
    // Check-ins: users can read/write if they belong to the project's company
    match /checkins/{checkinId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/projects/$(resource.data.projectId)) &&
        exists(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.companyId)) &&
        (get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.companyId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.companyId)).data.members);
      allow create: if request.auth != null && 
        exists(/databases/$(database)/documents/projects/$(request.resource.data.projectId)) &&
        exists(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId)) &&
        (get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId)).data.members);
    }
    
    // Feedback: users can read/write if they belong to the project's company
    match /feedback/{feedbackId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/projects/$(resource.data.projectId)) &&
        exists(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.companyId)) &&
        (get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.companyId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.companyId)).data.members);
      allow create: if request.auth != null && 
        exists(/databases/$(database)/documents/projects/$(request.resource.data.projectId)) &&
        exists(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId)) &&
        (get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/companies/$(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId)).data.members);
    }
  }
}
```

### 4. Publish the Rules
- Click "Publish" button
- Confirm the deployment

## What This Fixes:

- **Data Isolation**: Users can only see projects from their own company
- **Security**: Prevents cross-company data access
- **Permission Errors**: Proper company-based access control
- **Sign Up Issues**: New users can create documents with proper permissions
- **Loading Issues**: Optimized rules that work with your multi-tenant structure

## Security Features:

- **Company Isolation**: Users can only access their company's data
- **Project Privacy**: Projects are private to their company
- **User Privacy**: Users can only see their own user document
- **Team Access**: Company members can see all company projects
- **Owner Permissions**: Company owners have full access to their company's data

## After Deployment:

1. Test sign up with a new account
2. Test creating a new project
3. Test updating project phases
4. Check if the loading issues are resolved

## If Issues Persist:

1. Check browser console for any remaining errors
2. Verify Firebase project configuration
3. Check if environment variables are properly set
4. Clear browser cache and try again
