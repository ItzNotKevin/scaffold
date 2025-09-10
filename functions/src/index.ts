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

// Email templates
const getProjectCreatedEmail = (projectName: string, companyName: string, phase: string) => ({
  to: '', // Will be set dynamically
  from: 'noreply@construction-pm.com', // Replace with your verified sender
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
  from: 'noreply@construction-pm.com', // Replace with your verified sender
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
      
      await Promise.all(emailPromises);
      console.log(`Sent project creation emails to ${memberIds.length} members`);
      
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
      
      await Promise.all(emailPromises);
      console.log(`Sent phase update emails to ${memberIds.length} members`);
      
    } catch (error) {
      console.error('Error in onProjectPhaseUpdated:', error);
    }
  });
