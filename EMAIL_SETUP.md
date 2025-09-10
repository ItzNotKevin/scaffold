# Email Notifications Setup Guide

## Why You're Not Getting Emails

The email notifications are implemented as Firebase Functions, but they haven't been deployed yet. Here's how to get them working:

## Option 1: Quick Test (Console Logs)

The functions are already set up to log email notifications to the console when SendGrid isn't configured. You can see them in the Firebase Functions logs.

## Option 2: Deploy Functions (Recommended)

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Deploy Functions
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### Step 4: Test Email Notifications
1. Create a new project in your app
2. Update a project phase
3. Check Firebase Functions logs for email notifications

## Option 3: Set Up SendGrid (For Real Emails)

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com
2. Sign up for a free account
3. Verify your email address

### Step 2: Get API Key
1. Go to Settings → API Keys
2. Create a new API key with "Mail Send" permissions
3. Copy the API key

### Step 3: Configure Firebase
```bash
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
firebase functions:config:set sendgrid.sender="noreply@yourdomain.com"
```

### Step 4: Redeploy Functions
```bash
firebase deploy --only functions
```

## Testing Email Notifications

### Test Project Creation:
1. Create a new project
2. Check Firebase Functions logs
3. You should see email notifications logged

### Test Phase Updates:
1. Go to a project details page
2. Change the project phase
3. Check Firebase Functions logs
4. You should see phase update notifications logged

## Current Email Recipients

- **Project Created**: All company members
- **Phase Updated**: All company members

## Troubleshooting

### Check Firebase Functions Logs:
```bash
firebase functions:log
```

### Check if Functions are Deployed:
```bash
firebase functions:list
```

### Test Function Locally:
```bash
cd functions
npm run serve
```

## Next Steps

1. Deploy the functions to see console logs
2. Set up SendGrid for real email delivery
3. Test with real email addresses
4. Customize email templates if needed
