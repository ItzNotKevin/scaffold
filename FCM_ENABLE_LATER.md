# Enable FCM Push Notifications Later

This guide shows how to easily enable Firebase Cloud Messaging (FCM) push notifications when you're ready.

## Current Status
- ✅ **FCM code is implemented** but disabled
- ✅ **Email notifications work** without FCM
- ✅ **Easy to enable** with simple flag changes

## Quick Enable Steps

### 1. Upgrade to Firebase Blaze Plan
- Go to [Firebase Console](https://console.firebase.google.com/)
- Select your project → **Upgrade** → **Blaze (Pay as you go)**
- Set spending limits (e.g., $5-10/month)

### 2. Enable FCM in Code

**Frontend (src/components/FCMProvider.tsx):**
```typescript
// Change this line:
const FCM_ENABLED = false;
// To:
const FCM_ENABLED = true;
```

**Backend (functions/src/index.ts):**
```typescript
// Change this line:
const FCM_ENABLED = false;
// To:
const FCM_ENABLED = true;
```

### 3. Add VAPID Key to Environment

**Add to .env.local:**
```bash
VITE_FIREBASE_VAPID_KEY=BFHrhTQRsMGdSJ0Za-rSIy9kZ827CGBdNx3u01M3xwfRzvJqXkpjeVMU835iv_2yq0HFjeSo2DBTdHKe1O2mY1g
```

### 4. Configure Firebase Functions

```bash
# Login to Firebase
npx firebase-tools login

# Set VAPID keys
npx firebase-tools functions:config:set fcm.vapid_private_key="4CNFPs1J0SfYc2GYPS7NGx68OYzii5IA3ph05DGmldA"
npx firebase-tools functions:config:set fcm.vapid_public_key="BFHrhTQRsMGdSJ0Za-rSIy9kZ827CGBdNx3u01M3xwfRzvJqXkpjeVMU835iv_2yq0HFjeSo2DBTdHKe1O2mY1g"

# Deploy functions
cd functions
npm run build
npx firebase-tools deploy --only functions
```

### 5. Deploy Frontend

```bash
# Build and deploy
npm run build
# Deploy to Vercel (or your hosting platform)
```

## What Happens When Enabled

### Automatic Features:
- ✅ **Permission requests** - Users get asked for notification permission
- ✅ **Token generation** - FCM tokens are created and stored
- ✅ **Push notifications** - Real-time notifications for:
  - New project creation
  - Project phase updates
  - New client feedback

### User Experience:
- ✅ **Foreground notifications** - When app is open
- ✅ **Background notifications** - When app is closed
- ✅ **Click actions** - Opens relevant project pages

## Cost Estimation

### Free Tier (Blaze Plan):
- **2M Cloud Function invocations/month** - FREE
- **400,000 GB-seconds compute time/month** - FREE
- **5GB Cloud Storage** - FREE
- **20,000 Firestore reads/day** - FREE

### Typical Usage:
- **1000 notifications/month** - ~$1-2
- **5000 notifications/month** - ~$5-10
- **Most small apps stay within free tier**

## Testing

### Local Testing:
1. Enable FCM flags
2. Run `npm run dev`
3. Grant notification permission
4. Create/update projects to test notifications

### Production Testing:
1. Deploy with FCM enabled
2. Test on different devices
3. Check Firebase Functions logs
4. Monitor costs in Firebase Console

## Troubleshooting

### Common Issues:
- **No notifications**: Check browser permissions
- **Permission denied**: Clear browser data
- **Functions errors**: Check Firebase Console logs
- **High costs**: Set spending limits

### Debug Commands:
```bash
# Check Firebase Functions logs
npx firebase-tools functions:log

# Check FCM configuration
npx firebase-tools functions:config:get
```

## Current Implementation

### Files Ready:
- ✅ `src/lib/firebase.ts` - FCM configuration
- ✅ `src/lib/useFCM.tsx` - FCM hook
- ✅ `src/components/FCMProvider.tsx` - Permission management
- ✅ `public/firebase-messaging-sw.js` - Service worker
- ✅ `functions/src/index.ts` - FCM triggers

### Features Ready:
- ✅ **Project creation notifications**
- ✅ **Phase update notifications**
- ✅ **Feedback notifications**
- ✅ **Company-based targeting**
- ✅ **Smart routing**

## Summary

Everything is set up and ready! Just change two flags and add the VAPID key to enable push notifications. The app will continue working normally with email notifications until you're ready to enable FCM.
