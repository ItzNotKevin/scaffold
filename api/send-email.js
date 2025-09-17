// Vercel serverless function for sending emails
const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, type, projectData } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create email message
    const msg = {
      to,
      from: process.env.SENDGRID_SENDER_EMAIL || 'noreply@scaffold.com',
      subject,
      html,
    };

    // Send email
    await sgMail.send(msg);

    console.log(`Email sent successfully to ${to}`);
    console.log(`Type: ${type}, Project: ${projectData?.name || 'N/A'}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      recipient: to,
      type: type
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
}
