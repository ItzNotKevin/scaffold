// Import Firebase scripts
// Note: FCM is currently disabled but ready to enable
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyDjZPSI4YQrQJnJrrco_B4u8fEz8FPMpTk",
  authDomain: "construction-pm.firebaseapp.com",
  projectId: "construction-pm",
  storageBucket: "construction-pm.firebasestorage.app",
  messagingSenderId: "123323892546",
  appId: "1:123323892546:web:0b2a618a72fc91c5017edb"
};

firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Construction PM Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new project update',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.data?.projectId || 'project-update',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  // Get the project ID from the notification data
  const projectId = event.notification.data?.projectId;
  
  if (projectId) {
    // Open the project page
    event.waitUntil(
      clients.openWindow(`/project/${projectId}`)
    );
  } else {
    // Open the dashboard
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
