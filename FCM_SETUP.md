# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you set up push notifications for your Construction PM app using Firebase Cloud Messaging.

## ⚠️ Current Status: DISABLED
FCM is currently **disabled** but fully implemented. See `FCM_ENABLE_LATER.md` for quick enable instructions.

## Prerequisites

- Firebase project with Cloud Messaging enabled
- Firebase Functions deployed
- VAPID keys generated

## Step 1: Enable Cloud Messaging in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `construction-pm`
3. Go to **Project Settings** → **Cloud Messaging**
4. Note your **Server Key** (if needed for legacy FCM)

## Step 2: Add VAPID Key to Environment

Add the VAPID key to your `.env.local` file:

```bash
VITE_FIREBASE_VAPID_KEY=BFHrhTQRsMGdSJ0Za-rSIy9kZ827CGBdNx3u01M3xwfRzvJqXkpjeVMU835iv_2yq0HFjeSo2DBTdHKe1O2mY1g
```

## Step 3: Configure Firebase Functions

Set the VAPID keys in Firebase Functions configuration:

```bash
# Set VAPID private key
firebase functions:config:set fcm.vapid_private_key="4CNFPs1J0SfYc2GYPS7NGx68OYzii5IA3ph05DGmldA"

# Set VAPID public key
firebase functions:config:set fcm.vapid_public_key="BFHrhTQRsMGdSJ0Za-rSIy9kZ827CGBdNx3u01M3xwfRzvJqXkpjeVMU835iv_2yq0HFjeSo2DBTdHKe1O2mY1g"
```

## Step 4: Deploy Firebase Functions

Deploy the updated functions with FCM support:

```bash
cd functions
npm run build
firebase deploy --only functions
```

## Step 5: Test Notifications

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Grant notification permission** when prompted

3. **Test notifications by:**
   - Creating a new project
   - Updating a project phase
   - Adding client feedback

## How It Works

### Notification Triggers

The app sends push notifications for:

1. **Project Creation** - When a new project is created
2. **Phase Updates** - When a project phase changes
3. **Client Feedback** - When new feedback is added

### Notification Types

- **Foreground**: Shows as browser notification when app is open
- **Background**: Shows as system notification when app is closed
- **Click Action**: Opens the relevant project page

### User Experience

1. **Permission Request**: Automatically requested on first visit
2. **Token Storage**: FCM token saved to user document in Firestore
3. **Real-time Updates**: Notifications sent immediately when triggers fire
4. **Smart Routing**: Clicking notifications opens the relevant project

## Troubleshooting

### Common Issues

1. **No notifications received:**
   - Check browser notification permissions
   - Verify FCM token is generated and saved
   - Check Firebase Functions logs

2. **Permission denied:**
   - Clear browser data and try again
   - Check if notifications are blocked in browser settings

3. **Service worker errors:**
   - Check browser console for errors
   - Verify `firebase-messaging-sw.js` is accessible

### Debug Steps

1. **Check FCM token:**
   ```javascript
   // In browser console
   console.log('FCM Token:', localStorage.getItem('fcmToken'));
   ```

2. **Check user document:**
   - Look in Firestore for `users/{userId}` document
   - Verify `fcmToken` field exists

3. **Check Firebase Functions logs:**
   ```bash
   firebase functions:log
   ```

## Security Notes

- VAPID keys are safe to include in client-side code
- FCM tokens are user-specific and stored securely
- Notifications only sent to company members
- All triggers are server-side for security

## Next Steps

- Customize notification appearance
- Add notification preferences
- Implement notification history
- Add sound and vibration options
