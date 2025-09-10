// Email notification service for Vercel functions
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// Email templates
const getProjectCreatedEmail = (projectName: string, companyName: string, phase: string) => ({
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
    const companyDoc = await getDocs(query(collection(db, 'companies'), where('__name__', '==', companyId)));
    if (companyDoc.empty) return [];
    
    const companyData = companyDoc.docs[0].data();
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
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    if (userDoc.empty) return null;
    
    const userData = userDoc.docs[0].data();
    return userData?.email || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

// Helper function to send email via Vercel function
async function sendEmail(emailData: any, recipientEmail: string, type: string, projectData: any) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: emailData.subject,
        html: emailData.html,
        type: type,
        projectData: projectData
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Email sent to ${recipientEmail}:`, result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Send project creation emails
export async function sendProjectCreatedEmails(projectData: any, companyId: string) {
  try {
    // Get company details
    const companyDoc = await getDocs(query(collection(db, 'companies'), where('__name__', '==', companyId)));
    if (companyDoc.empty) {
      console.log('Company not found for project:', companyId);
      return;
    }
    
    const companyData = companyDoc.docs[0].data();
    const companyName = companyData?.name || 'Unknown Company';
    
    // Get company members
    const memberIds = await getCompanyMembers(companyId);
    
    // Send emails to all company members
    const emailPromises = memberIds.map(async (memberId) => {
      const userEmail = await getUserEmail(memberId);
      if (userEmail) {
        const emailData = getProjectCreatedEmail(
          projectData.name || 'Unnamed Project',
          companyName,
          projectData.phase || 'Sales'
        );
        await sendEmail(emailData, userEmail, 'project_created', projectData);
      }
    });
    
    await Promise.all(emailPromises);
    console.log(`Sent project creation emails to ${memberIds.length} members`);
    
  } catch (error) {
    console.error('Error in sendProjectCreatedEmails:', error);
  }
}

// Send phase update emails
export async function sendPhaseUpdateEmails(projectData: any, oldPhase: string, companyId: string) {
  try {
    // Get company details
    const companyDoc = await getDocs(query(collection(db, 'companies'), where('__name__', '==', companyId)));
    if (companyDoc.empty) {
      console.log('Company not found for project:', companyId);
      return;
    }
    
    const companyData = companyDoc.docs[0].data();
    const companyName = companyData?.name || 'Unknown Company';
    
    // Get company members
    const memberIds = await getCompanyMembers(companyId);
    
    // Send emails to all company members
    const emailPromises = memberIds.map(async (memberId) => {
      const userEmail = await getUserEmail(memberId);
      if (userEmail) {
        const emailData = getPhaseUpdateEmail(
          projectData.name || 'Unnamed Project',
          companyName,
          oldPhase,
          projectData.phase || 'Unknown'
        );
        await sendEmail(emailData, userEmail, 'phase_updated', projectData);
      }
    });
    
    await Promise.all(emailPromises);
    console.log(`Sent phase update emails to ${memberIds.length} members`);
    
  } catch (error) {
    console.error('Error in sendPhaseUpdateEmails:', error);
  }
}
