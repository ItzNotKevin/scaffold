// Vercel serverless function for handling push subscriptions
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      return res.status(400).json({ error: 'Missing subscription or userId' });
    }

    // In a real implementation, you would:
    // 1. Store the subscription in your database
    // 2. Associate it with the user
    // 3. Use it later to send push notifications

    console.log('Push subscription received:', {
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys
    });

    // For now, just log the subscription
    // In production, store this in your database
    const subscriptionData = {
      userId,
      subscription,
      createdAt: new Date().toISOString()
    };

    // TODO: Store in database (Firestore, MongoDB, etc.)
    // await storePushSubscription(subscriptionData);

    return res.status(200).json({ 
      success: true, 
      message: 'Push subscription stored successfully' 
    });

  } catch (error) {
    console.error('Error handling push subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
