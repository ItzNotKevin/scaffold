// Vercel API route for sending push notifications
// This replaces the Firebase Cloud Function approach

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ error: 'Invalid or missing tokens' });
      return;
    }

    if (!title || !body) {
      res.status(400).json({ error: 'Missing title or body' });
      return;
    }

    // For now, just return success - the frontend will handle the actual notification
    // This API route can be extended later to send notifications to multiple devices
    console.log('Notification request received:', { title, body, tokens: tokens.length });
    
    res.status(200).json({ 
      success: true, 
      message: 'Notification request processed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in notification API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


