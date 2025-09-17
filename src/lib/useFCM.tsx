import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './useAuth';

export const useFCM = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  // Check if notifications are supported
  useEffect(() => {
    console.log('FCM: Checking notification support...');
    console.log('Notification in window:', 'Notification' in window);
    console.log('ServiceWorker in navigator:', 'serviceWorker' in navigator);
    console.log('Current permission:', Notification.permission);
    
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
      console.log('FCM: Notifications supported, permission:', Notification.permission);
    } else {
      console.log('FCM: Notifications not supported');
    }
  }, []);

  // Request notification permission
  const requestPermission = async () => {
    if (!isSupported) {
      console.log('Notifications not supported');
      setError('Notifications not supported in this browser');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await getFCMToken();
        return true;
      } else {
        console.log('Notification permission denied');
        setError('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setError('Failed to request notification permission');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get FCM token
  const getFCMToken = async () => {
    if (!currentUser || !isSupported) {
      console.log('FCM: Cannot get token - currentUser:', !!currentUser, 'isSupported:', isSupported);
      return;
    }

    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      console.log('FCM: VAPID key length:', vapidKey?.length);
      console.log('FCM: VAPID key starts with:', vapidKey?.substring(0, 10));
      console.log('FCM: VAPID key ends with:', vapidKey?.substring(vapidKey.length - 10));
      console.log('FCM: Attempting to get token with VAPID key:', vapidKey);
      
      const token = await getToken(messaging, {
        vapidKey: vapidKey
      });
      
      if (token) {
        setFcmToken(token);
        console.log('FCM Token obtained:', token);
        
        // Save token to user document
        await saveTokenToUser(token);
      } else {
        console.log('FCM: No registration token available');
      }
    } catch (error) {
      console.error('FCM: Error retrieving token:', error);
      setError('Failed to get FCM token: ' + error.message);
    }
  };

  // Save FCM token to user document
  const saveTokenToUser = async (token: string) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        fcmToken: token,
        fcmTokenUpdatedAt: new Date()
      }, { merge: true });
      console.log('FCM token saved to user document');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  };

  // Listen for foreground messages
  useEffect(() => {
    if (!isSupported) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received in foreground:', payload);
      
      // Show notification in foreground
      if (payload.notification) {
        const notification = new Notification(payload.notification.title || 'Scaffold Update', {
          body: payload.notification.body || 'You have a new project update',
          icon: '/scaffold-logo.png',
          badge: '/scaffold-logo.png',
          tag: payload.data?.projectId || 'project-update',
          data: payload.data
        });

        notification.onclick = () => {
          window.focus();
          const projectId = payload.data?.projectId;
          if (projectId) {
            window.location.href = `/project/${projectId}`;
          } else {
            window.location.href = '/';
          }
        };
      }
    });

    return () => unsubscribe();
  }, [isSupported]);

  // Get FCM token when user logs in
  useEffect(() => {
    if (currentUser && permission === 'granted') {
      getFCMToken();
    }
  }, [currentUser, permission]);

  return {
    fcmToken,
    permission,
    isSupported,
    isLoading,
    error,
    requestPermission,
    getFCMToken
  };
};
