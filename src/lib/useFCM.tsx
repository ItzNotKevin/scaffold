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

  // Check if notifications are supported and register service worker
  useEffect(() => {
    console.log('FCM: Checking notification support...');
    console.log('Notification in window:', 'Notification' in window);
    console.log('ServiceWorker in navigator:', 'serviceWorker' in navigator);
    console.log('Current permission:', Notification.permission);
    
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
      console.log('FCM: Notifications supported, permission:', Notification.permission);
      
      // Register service worker for FCM
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then((registration) => {
            console.log('FCM: Service worker registered successfully:', registration);
          })
          .catch((error) => {
            console.error('FCM: Service worker registration failed:', error);
          });
      }
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
      
      // Try to get token with VAPID key first
      let token;
      if (vapidKey && vapidKey.length === 87) {
        console.log('FCM: Using VAPID key for token generation');
        try {
          token = await getToken(messaging, {
            vapidKey: vapidKey
          });
        } catch (vapidError) {
          console.log('FCM: VAPID key failed, trying without VAPID key:', vapidError);
          token = await getToken(messaging);
        }
      } else {
        console.log('FCM: VAPID key invalid, trying without VAPID key');
        token = await getToken(messaging);
      }
      
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
      
      // If FCM fails, we'll use a fallback approach
      if (error.message.includes('token-subscribe-failed') || error.message.includes('401')) {
        console.log('FCM: Authentication failed, using fallback notification system');
        setError('FCM authentication failed. Using fallback notification system.');
        
        // Create a mock token for fallback
        const fallbackToken = 'fallback-' + Date.now();
        setFcmToken(fallbackToken);
        console.log('FCM: Using fallback token:', fallbackToken);
      } else {
        setError('Failed to get FCM token: ' + error.message);
      }
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
