import React, { useState } from 'react';
import { usePushNotifications } from '../lib/usePushNotifications';

const NotificationPermission: React.FC = () => {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe
  } = usePushNotifications();

  const [showDetails, setShowDetails] = useState(false);

  // Debug logging
  console.log('NotificationPermission render:', {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error
  });

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm text-yellow-800">
            Push notifications are not supported in this browser.
          </span>
        </div>
      </div>
    );
  }

  if (permission === 'granted' && isSubscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-green-800">
              Push notifications are enabled. You'll receive updates about your projects.
            </span>
          </div>
          <button
            onClick={unsubscribe}
            disabled={isLoading}
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >
            {isLoading ? 'Disabling...' : 'Disable'}
          </button>
        </div>
      </div>
    );
  }

  // Don't show the banner if notifications are already granted but not subscribed yet
  if (permission === 'granted' && !isSubscribed && !isLoading) {
    return null;
  }

  if (permission === 'denied') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-800">
              Push notifications are blocked. Please enable them in your browser settings to receive updates.
            </span>
          </div>
          <button
            onClick={() => {
              console.log('Attempting to reset notification permission...');
              // Try to request permission again
              requestPermission().catch(console.error);
            }}
            className="text-xs text-red-600 hover:text-red-700 font-medium underline"
          >
            Try Again
          </button>
        </div>
        <div className="mt-2 text-xs text-red-600">
          <p>To enable notifications:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Click the lock icon in your browser's address bar</li>
            <li>Set notifications to "Allow"</li>
            <li>Refresh this page</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM4 5h6V1H4v4zM15 3h5v5h-5V3z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              Enable Push Notifications
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Get instant updates about task changes, new comments, and project updates.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={async () => {
                  try {
                    const newPermission = await requestPermission();
                    if (newPermission === 'granted') {
                      await subscribe();
                    }
                  } catch (err) {
                    console.error('Failed to enable notifications:', err);
                  }
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Enabling...' : 'Enable Notifications'}
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <h4 className="text-xs font-medium text-blue-900 mb-2">What you'll receive:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Task completion notifications</li>
            <li>• New comments on tasks</li>
            <li>• Project phase updates</li>
            <li>• Team member activities</li>
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default NotificationPermission;
