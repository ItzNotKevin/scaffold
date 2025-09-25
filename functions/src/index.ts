import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize SendGrid
const SENDGRID_API_KEY = functions.config().sendgrid?.key;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Get FCM VAPID configuration (unused for now)
// const FCM_VAPID_PRIVATE_KEY = functions.config().fcm?.vapid_private_key;
// const FCM_VAPID_PUBLIC_KEY = functions.config().fcm?.vapid_public_key;

// FCM Feature Flag - Set to true when ready to enable FCM
const FCM_ENABLED = true;

// Email templates
const getProjectCreatedEmail = (projectName: string, companyName: string, phase: string) => ({
  to: '', // Will be set dynamically
  from: 'noreply@scaffold.com', // Replace with your verified sender
  subject: `New Project Created: ${projectName}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">New Project Created</h2>
      <p>A new project has been created in your construction management system.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1f2937;">Project Details</h3>
        <p><strong>Project Name:</strong> ${projectName}</p>
        <p><strong>Company:</strong> ${companyName}</p>
        <p><strong>Initial Phase:</strong> ${phase}</p>
        <p><strong>Created:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <p>You can view and manage this project in your dashboard.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated notification from Construction PM.
        </p>
      </div>
    </div>
  `
});

const getPhaseUpdateEmail = (projectName: string, companyName: string, oldPhase: string, newPhase: string) => ({
  to: '', // Will be set dynamically
  from: 'noreply@scaffold.com', // Replace with your verified sender
  subject: `Project Phase Updated: ${projectName}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Project Phase Updated</h2>
      <p>The phase of a project has been updated in your construction management system.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1f2937;">Project Details</h3>
        <p><strong>Project Name:</strong> ${projectName}</p>
        <p><strong>Company:</strong> ${companyName}</p>
        <p><strong>Previous Phase:</strong> <span style="color: #6b7280;">${oldPhase}</span></p>
        <p><strong>New Phase:</strong> <span style="color: #059669; font-weight: bold;">${newPhase}</span></p>
        <p><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <p>You can view the updated project in your dashboard.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated notification from Construction PM.
        </p>
      </div>
    </div>
  `
});

// Helper function to get company members
async function getCompanyMembers(companyId: string): Promise<string[]> {
  try {
    const companyDoc = await admin.firestore().collection('companies').doc(companyId).get();
    if (!companyDoc.exists) return [];
    
    const companyData = companyDoc.data();
    const members = companyData?.members || [];
    const ownerId = companyData?.ownerId;
    
    // Include owner in members list
    if (ownerId && !members.includes(ownerId)) {
      members.push(ownerId);
    }
    
    return members;
  } catch (error) {
    console.error('Error getting company members:', error);
    return [];
  }
}

// Helper function to get user email
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    
    const userData = userDoc.data();
    return userData?.email || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

// Helper function to send email
async function sendEmail(emailData: any, recipientEmail: string) {
  if (!SENDGRID_API_KEY) {
    console.log('📧 EMAIL NOTIFICATION (SendGrid not configured):');
    console.log('To:', recipientEmail);
    console.log('Subject:', emailData.subject);
    console.log('Content:', emailData.html);
    console.log('---');
    return;
  }
  
  try {
    const email = { ...emailData, to: recipientEmail };
    await sgMail.send(email);
    console.log(`Email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Helper function to get user FCM tokens
async function getUserFCMTokens(userId: string): Promise<string[]> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return [];
    
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    
    return fcmToken ? [fcmToken] : [];
  } catch (error) {
    console.error('Error getting user FCM tokens:', error);
    return [];
  }
}

// Helper function to send FCM notification
async function sendFCMNotification(tokens: string[], title: string, body: string, data: any = {}) {
  // Skip FCM if disabled
  if (!FCM_ENABLED) {
    console.log('FCM is disabled. Set FCM_ENABLED = true to enable push notifications.');
    return;
  }

  if (tokens.length === 0) {
    console.log('No FCM tokens available for notification');
    return;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`FCM notification sent to ${response.successCount}/${tokens.length} devices`);
    
    if (response.failureCount > 0) {
      console.log('FCM failures:', response.responses
        .map((resp, idx) => resp.success ? null : `Token ${idx}: ${resp.error}`)
        .filter(Boolean));
    }
  } catch (error) {
    console.error('Error sending FCM notification:', error);
  }
}

// HTTP function to send FCM notifications directly
export const sendFCMNotificationHTTP = functions.https.onRequest(async (req, res) => {
  console.log('sendFCMNotificationHTTP called:', req.method, req.url);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tokens, title, body, data } = req.body;
    console.log('Request data:', { tokens, title, body, data });

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      console.log('Invalid tokens');
      res.status(400).json({ error: 'Invalid or missing tokens' });
      return;
    }

    if (!title || !body) {
      console.log('Missing title or body');
      res.status(400).json({ error: 'Missing title or body' });
      return;
    }

    console.log('Sending FCM notification...');
    await sendFCMNotification(tokens, title, body, data);
    console.log('FCM notification sent successfully');
    res.status(200).json({ success: true, message: 'FCM notification sent' });
  } catch (error) {
    console.error('Error in sendFCMNotification function:', error);
    res.status(500).json({ error: 'Failed to send FCM notification' });
  }
});

// Simple test function
export const testNotification = functions.https.onRequest(async (req, res) => {
  console.log('testNotification called:', req.method, req.url);
  
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  res.status(200).json({ 
    success: true, 
    message: 'Test function working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
});

// Trigger when a new project is created
export const onProjectCreated = functions.firestore
  .document('projects/{projectId}')
  .onCreate(async (snap, context) => {
    const projectData = snap.data();
    const projectId = context.params.projectId;
    
    console.log('New project created:', projectId, projectData);
    
    try {
      // Get company details
      const companyDoc = await admin.firestore()
        .collection('companies')
        .doc(projectData.companyId)
        .get();
      
      if (!companyDoc.exists) {
        console.log('Company not found for project:', projectData.companyId);
        return;
      }
      
      const companyData = companyDoc.data();
      const companyName = companyData?.name || 'Unknown Company';
      
      // Get company members
      const memberIds = await getCompanyMembers(projectData.companyId);
      
      // Send emails to all company members
      const emailPromises = memberIds.map(async (memberId) => {
        const userEmail = await getUserEmail(memberId);
        if (userEmail) {
          const emailData = getProjectCreatedEmail(
            projectData.name || 'Unnamed Project',
            companyName,
            projectData.phase || 'Sales'
          );
          await sendEmail(emailData, userEmail);
        }
      });
      
      // Send FCM notifications to all company members
      const fcmPromises = memberIds.map(async (memberId) => {
        const tokens = await getUserFCMTokens(memberId);
        if (tokens.length > 0) {
          await sendFCMNotification(
            tokens,
            'New Project Created',
            `${projectData.name || 'Unnamed Project'} has been created in ${companyName}`,
            {
              projectId,
              type: 'project_created',
              companyId: projectData.companyId
            }
          );
        }
      });
      
      await Promise.all([...emailPromises, ...fcmPromises]);
      console.log(`Sent project creation notifications to ${memberIds.length} members`);
      
    } catch (error) {
      console.error('Error in onProjectCreated:', error);
    }
  });

// Trigger when a project phase is updated
export const onProjectPhaseUpdated = functions.firestore
  .document('projects/{projectId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const projectId = context.params.projectId;
    
    // Check if phase was updated
    if (beforeData.phase === afterData.phase) {
      return; // No phase change
    }
    
    console.log('Project phase updated:', projectId, beforeData.phase, '->', afterData.phase);
    
    try {
      // Get company details
      const companyDoc = await admin.firestore()
        .collection('companies')
        .doc(afterData.companyId)
        .get();
      
      if (!companyDoc.exists) {
        console.log('Company not found for project:', afterData.companyId);
        return;
      }
      
      const companyData = companyDoc.data();
      const companyName = companyData?.name || 'Unknown Company';
      
      // Get company members
      const memberIds = await getCompanyMembers(afterData.companyId);
      
      // Send emails to all company members
      const emailPromises = memberIds.map(async (memberId) => {
        const userEmail = await getUserEmail(memberId);
        if (userEmail) {
          const emailData = getPhaseUpdateEmail(
            afterData.name || 'Unnamed Project',
            companyName,
            beforeData.phase || 'Unknown',
            afterData.phase || 'Unknown'
          );
          await sendEmail(emailData, userEmail);
        }
      });
      
      // Send FCM notifications to all company members
      const fcmPromises = memberIds.map(async (memberId) => {
        const tokens = await getUserFCMTokens(memberId);
        if (tokens.length > 0) {
          await sendFCMNotification(
            tokens,
            'Project Phase Updated',
            `${afterData.name || 'Unnamed Project'} moved from ${beforeData.phase || 'Unknown'} to ${afterData.phase || 'Unknown'}`,
            {
              projectId,
              type: 'phase_updated',
              companyId: afterData.companyId,
              oldPhase: beforeData.phase || 'Unknown',
              newPhase: afterData.phase || 'Unknown'
            }
          );
        }
      });
      
      await Promise.all([...emailPromises, ...fcmPromises]);
      console.log(`Sent phase update notifications to ${memberIds.length} members`);
      
    } catch (error) {
      console.error('Error in onProjectPhaseUpdated:', error);
    }
  });

// Trigger when client feedback is added
export const onFeedbackAdded = functions.firestore
  .document('feedback/{feedbackId}')
  .onCreate(async (snap, context) => {
    const feedbackData = snap.data();
    const feedbackId = context.params.feedbackId;
    const projectId = feedbackData.projectId;
    
    console.log('New feedback added:', feedbackId, 'for project:', projectId);
    
    try {
      // Get project details
      const projectDoc = await admin.firestore()
        .collection('projects')
        .doc(projectId)
        .get();
      
      if (!projectDoc.exists) {
        console.log('Project not found for feedback:', projectId);
        return;
      }
      
      const projectData = projectDoc.data();
      const projectName = projectData?.name || 'Unnamed Project';
      
      // Get company details
      const companyDoc = await admin.firestore()
        .collection('companies')
        .doc(projectData?.companyId || '')
        .get();
      
      if (!companyDoc.exists) {
        console.log('Company not found for project:', projectData?.companyId);
        return;
      }
      
      // const companyData = companyDoc.data();
      // const companyName = companyData?.name || 'Unknown Company';
      
      // Get company members
      const memberIds = await getCompanyMembers(projectData?.companyId || '');
      
      // Send FCM notifications to all company members
      const fcmPromises = memberIds.map(async (memberId) => {
        const tokens = await getUserFCMTokens(memberId);
        if (tokens.length > 0) {
          await sendFCMNotification(
            tokens,
            'New Client Feedback',
            `New feedback received for ${projectName}`,
            {
              projectId,
              type: 'feedback_added',
              companyId: projectData?.companyId || '',
              feedbackId
            }
          );
        }
      });
      
      await Promise.all(fcmPromises);
      console.log(`Sent feedback notifications to ${memberIds.length} members`);
      
    } catch (error) {
      console.error('Error in onFeedbackAdded:', error);
    }
  });
