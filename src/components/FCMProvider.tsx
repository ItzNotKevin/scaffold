import React, { useEffect, useState } from 'react';
import { useFCM } from '../lib/useFCM';
import { useAuth } from '../lib/useAuth';

// FCM Feature Flag - Set to true when ready to enable FCM
const FCM_ENABLED = false;

const FCMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { isSupported, permission, requestPermission } = useFCM();
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  useEffect(() => {
    // Skip FCM if disabled
    if (!FCM_ENABLED) {
      console.log('FCM is disabled. Set FCM_ENABLED = true to enable push notifications.');
      return;
    }

    // Only request permission if user is logged in and we haven't asked yet
    if (currentUser && isSupported && !hasRequestedPermission && permission === 'default') {
      const requestNotificationPermission = async () => {
        const granted = await requestPermission();
        if (granted) {
          console.log('Notification permission granted');
        } else {
          console.log('Notification permission denied');
        }
        setHasRequestedPermission(true);
      };

      // Show a small delay to let the app load first
      const timer = setTimeout(requestNotificationPermission, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, isSupported, hasRequestedPermission, permission, requestPermission]);

  return <>{children}</>;
};

export default FCMProvider;
