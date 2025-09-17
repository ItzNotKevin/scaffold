import { initializeApp, getApps } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // For now, we'll use the existing Cloud Function approach
    // This endpoint will be used by the frontend to trigger FCM notifications
    // The actual FCM sending is handled by Cloud Functions

    // Send notification to Cloud Function
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL}/sendFCMNotificationHTTP`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens: [token],
        title,
        body,
        data
      })
    });

    if (!response.ok) {
      throw new Error(`Cloud Function error: ${response.statusText}`);
    }

    res.status(200).json({ success: true, message: 'FCM notification sent' });
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    res.status(500).json({ error: 'Failed to send FCM notification' });
  }
}
