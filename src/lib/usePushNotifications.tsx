import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { pushNotificationService } from './pushNotifications';

interface PushNotificationContextType {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  showTaskNotification: (taskTitle: string, action: string, projectName: string) => void;
  showProjectNotification: (projectName: string, action: string) => void;
  showCommentNotification: (commenterName: string, taskTitle: string) => void;
}

const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

export const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (context === undefined) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
};

interface PushNotificationProviderProps {
  children: ReactNode;
}

export const PushNotificationProvider: React.FC<PushNotificationProviderProps> = ({ children }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('PushNotificationProvider: Initializing...');
    console.log('VAPID Key check:', import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'Present' : 'Missing');
    
    // Check if push notifications are supported
    const supported = pushNotificationService.isSupported();
    console.log('Push notifications supported:', supported);
    setIsSupported(supported);

    if (supported) {
      // Check current permission status
      const currentPermission = Notification.permission;
      console.log('Current notification permission:', currentPermission);
      setPermission(currentPermission);
      
      // Check if already subscribed
      const subscription = pushNotificationService.getSubscription();
      console.log('Existing subscription:', !!subscription);
      setIsSubscribed(!!subscription);
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Requesting notification permission...');
      const newPermission = await pushNotificationService.requestPermission();
      console.log('Permission result:', newPermission);
      setPermission(newPermission);
      return newPermission;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permission';
      console.error('Permission request error:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = async (): Promise<void> => {
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting push notification subscription...');
      console.log('Step 1: Calling pushNotificationService.subscribe()');
      
      const subscription = await pushNotificationService.subscribe();
      console.log('Step 2: Subscription result:', subscription);
      
      if (subscription) {
        console.log('Step 3: Subscription created, sending to server...');
        await pushNotificationService.sendSubscriptionToServer(subscription);
        console.log('Step 4: Subscription sent to server successfully');
        setIsSubscribed(true);
        console.log('Successfully subscribed to push notifications');
        
        // Show a test notification to confirm it's working
        pushNotificationService.showNotification('Notifications Enabled!', {
          body: 'You will now receive updates about your projects.',
          icon: '/pwa-192x192.png'
        });
      } else {
        console.log('Step 3: No subscription returned');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to push notifications';
      console.error('Subscription error:', err);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError(errorMessage);
      throw err;
    } finally {
      console.log('Step 5: Setting loading to false');
      setIsLoading(false);
    }
  };

  const unsubscribe = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (title: string, options?: NotificationOptions): void => {
    pushNotificationService.showNotification(title, options);
  };

  const showTaskNotification = (taskTitle: string, action: string, projectName: string): void => {
    pushNotificationService.showTaskNotification(taskTitle, action, projectName);
  };

  const showProjectNotification = (projectName: string, action: string): void => {
    pushNotificationService.showProjectNotification(projectName, action);
  };

  const showCommentNotification = (commenterName: string, taskTitle: string): void => {
    pushNotificationService.showCommentNotification(commenterName, taskTitle);
  };

  const value: PushNotificationContextType = {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    showTaskNotification,
    showProjectNotification,
    showCommentNotification,
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};
