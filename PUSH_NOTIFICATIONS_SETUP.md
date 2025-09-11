# Push Notifications Setup

This project uses native Web Push Notifications with the Push API instead of Firebase Cloud Messaging (FCM).

## Features

- ✅ **Native Push API** - Uses browser's built-in push notification system
- ✅ **Service Worker** - Handles background notifications
- ✅ **Permission Management** - Requests and manages notification permissions
- ✅ **Real-time Notifications** - Shows notifications for task updates, comments, and project changes
- ✅ **Cross-platform** - Works on desktop and mobile browsers

## Setup Instructions

### 1. Generate VAPID Keys

Run the VAPID key generator:

```bash
npm install web-push
node scripts/generate-vapid-keys.js
```

This will generate a public and private key pair. Copy the output.

### 2. Environment Variables

Add the VAPID public key to your `.env.local` file:

```env
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

For production deployment on Vercel, add both keys to your environment variables:

- `VITE_VAPID_PUBLIC_KEY` - Public key for client-side
- `VAPID_PRIVATE_KEY` - Private key for server-side (if implementing backend notifications)

### 3. Service Worker

The service worker is located at `public/sw.js` and handles:
- Push event reception
- Notification display
- Notification click handling
- Background sync

### 4. Push Notification Service

The `src/lib/pushNotifications.ts` file contains:
- Permission management
- Subscription handling
- Notification display
- VAPID key conversion

### 5. React Hook

The `src/lib/usePushNotifications.tsx` provides:
- React context for push notifications
- Permission state management
- Subscription management
- Notification triggers

## Usage

### Requesting Permission

The app automatically shows a permission request banner on the home page. Users can:
- Enable notifications
- View details about what notifications they'll receive
- Disable notifications later

### Notification Types

The app sends notifications for:

1. **Task Updates**
   - Task completion
   - Task status changes
   - Task assignments

2. **Comments**
   - New comments on tasks
   - Replies to comments

3. **Project Updates**
   - Phase changes
   - Project modifications

### Programmatic Usage

```typescript
import { usePushNotifications } from '../lib/usePushNotifications';

const { 
  showTaskNotification, 
  showProjectNotification, 
  showCommentNotification 
} = usePushNotifications();

// Show a task notification
showTaskNotification('Task Title', 'completed', 'Project Name');

// Show a project notification
showProjectNotification('Project Name', 'moved to Construction phase');

// Show a comment notification
showCommentNotification('John Doe', 'Task Title');
```

## Backend Integration

### Current Implementation

The current implementation shows local notifications immediately when actions occur. For server-side push notifications:

1. **Store Subscriptions** - The `/api/push-subscription.js` endpoint receives and stores push subscriptions
2. **Send Notifications** - Use the stored subscriptions to send push notifications from your backend
3. **Database Storage** - Store subscriptions in your database (Firestore, MongoDB, etc.)

### Example Backend Notification

```javascript
const webpush = require('web-push');

// Set VAPID details
webpush.setVAPIDDetails(
  'mailto:your-email@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Send notification
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/...',
  keys: {
    p256dh: '...',
    auth: '...'
  }
};

webpush.sendNotification(subscription, JSON.stringify({
  title: 'Task Update',
  body: 'A task has been completed',
  icon: '/pwa-192x192.png'
}));
```

## Browser Support

- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (iOS 16.4+, macOS 13+)
- ✅ Opera (all versions)

## Security Considerations

1. **HTTPS Required** - Push notifications only work over HTTPS
2. **VAPID Keys** - Keep private keys secure and never expose them client-side
3. **User Consent** - Always request permission before subscribing
4. **Data Privacy** - Only send necessary data in notifications

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Check if notifications are blocked in browser settings
   - Ensure the site is served over HTTPS

2. **Service Worker Not Registering**
   - Check browser console for errors
   - Ensure `sw.js` is accessible at the root path

3. **VAPID Key Issues**
   - Ensure keys are properly formatted
   - Check that public key is set in environment variables

### Debug Mode

Enable debug logging by opening browser console. The service worker and push notification service log detailed information about their operations.

## Migration from FCM

If migrating from FCM:

1. Remove FCM-related code
2. Replace FCM provider with PushNotificationProvider
3. Update notification triggers to use new API
4. Test thoroughly on different browsers

## Future Enhancements

- [ ] Rich notifications with images
- [ ] Action buttons in notifications
- [ ] Notification grouping
- [ ] Custom notification sounds
- [ ] Notification scheduling
- [ ] Analytics and tracking
