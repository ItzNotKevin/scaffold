# SendGrid Email Setup - Complete Guide

## Step 1: Create SendGrid Account

1. **Go to SendGrid**: https://sendgrid.com
2. **Sign Up**: Create a free account (100 emails/day free)
3. **Verify Email**: Check your email and verify your account
4. **Complete Setup**: Fill out the account information

## Step 2: Get SendGrid API Key

1. **Login to SendGrid Dashboard**
2. **Go to Settings → API Keys**
3. **Click "Create API Key"**
4. **Choose "Restricted Access"**
5. **Give it a name**: "Construction PM Functions"
6. **Set permissions**:
   - ✅ Mail Send: Full Access
   - ❌ Everything else: No Access
7. **Click "Create & View"**
8. **Copy the API Key** (starts with SG.)

## Step 3: Verify Sender Email

1. **Go to Settings → Sender Authentication**
2. **Click "Verify a Single Sender"**
3. **Fill out the form**:
   - From Name: Construction PM
   - From Email: noreply@yourdomain.com (or use your email for testing)
   - Reply To: your-email@domain.com
4. **Click "Create"**
5. **Check your email and verify the sender**

## Step 4: Deploy Firebase Functions

### Option A: Using Firebase CLI (Recommended)

```bash
# Login to Firebase
npx firebase login

# Set SendGrid configuration
npx firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY_HERE"
npx firebase functions:config:set sendgrid.sender="noreply@yourdomain.com"

# Deploy functions
cd functions
npm install
npm run build
cd ..
npx firebase deploy --only functions
```

### Option B: Manual Deployment

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: scaffold
3. **Go to Functions**
4. **Click "Get Started"** if first time
5. **Upload the functions code** (or use Firebase CLI)

## Step 5: Test Email Notifications

### Test Project Creation:
1. **Create a new project** in your app
2. **Check Firebase Functions logs**:
   ```bash
   npx firebase functions:log
   ```
3. **Check your email** for the notification

### Test Phase Updates:
1. **Go to a project details page**
2. **Change the project phase**
3. **Check Firebase Functions logs**
4. **Check your email** for the notification

## Step 6: Verify Email Delivery

### Check SendGrid Dashboard:
1. **Go to Activity → Email Activity**
2. **Look for your test emails**
3. **Check delivery status**

### Check Firebase Functions Logs:
```bash
npx firebase functions:log --only onProjectCreated
npx firebase functions:log --only onProjectPhaseUpdated
```

## Troubleshooting

### Common Issues:

1. **"SendGrid API key not configured"**
   - Make sure you set the config: `npx firebase functions:config:set sendgrid.key="YOUR_KEY"`
   - Redeploy functions after setting config

2. **"Email not sent"**
   - Check SendGrid API key is correct
   - Verify sender email is verified in SendGrid
   - Check Firebase Functions logs for errors

3. **"Functions not deployed"**
   - Make sure you're in the right project
   - Check Firebase CLI is logged in
   - Try: `npx firebase projects:list`

4. **"Permission denied"**
   - Make sure you have the right permissions in Firebase
   - Check if your account has access to the project

### Debug Commands:

```bash
# Check Firebase project
npx firebase projects:list

# Check functions config
npx firebase functions:config:get

# View function logs
npx firebase functions:log

# Test function locally
cd functions
npm run serve
```

## Email Templates

The functions include these email templates:

### Project Created Email:
- **Subject**: "New Project Created: [Project Name]"
- **Recipients**: All company members
- **Content**: Project details, company name, initial phase

### Phase Update Email:
- **Subject**: "Project Phase Updated: [Project Name]"
- **Recipients**: All company members
- **Content**: Project details, old phase → new phase

## Next Steps

1. **Test thoroughly** with different scenarios
2. **Customize email templates** if needed
3. **Set up email preferences** for users
4. **Monitor email delivery** in SendGrid dashboard
5. **Consider email limits** (100/day free on SendGrid)

## Support

If you run into issues:
1. Check Firebase Functions logs
2. Check SendGrid dashboard
3. Verify all configuration steps
4. Test with a simple email first
