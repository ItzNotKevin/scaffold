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
  const { currentUser } = useAuth();

  // Check if notifications are supported
  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = async () => {
    if (!isSupported) {
      console.log('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await getFCMToken();
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Get FCM token
  const getFCMToken = async () => {
    if (!currentUser || !isSupported) return;

    try {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      
      if (token) {
        setFcmToken(token);
        console.log('FCM Token:', token);
        
        // Save token to user document
        await saveTokenToUser(token);
      } else {
        console.log('No registration token available');
      }
    } catch (error) {
      console.error('An error occurred while retrieving token:', error);
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
    requestPermission,
    getFCMToken
  };
};
