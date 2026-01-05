import { collection, query, where, getDocs, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Calculate and update a project's actual revenue based on income entries
 */
export async function updateProjectActualRevenue(projectId: string): Promise<void> {
  try {
    const roundToCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

    // Get all incomes for this project
    const incomesQuery = query(
      collection(db, 'incomes'),
      where('projectId', '==', projectId)
    );
    const incomesSnapshot = await getDocs(incomesQuery);
    
    // Calculate total revenue from incomes (only count received ones)
    let totalRevenue = 0;
    incomesSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = Number(data.amount) || 0;
      if (data.status === 'received') {
        totalRevenue += amount;
      }
    });

    const revenueRounded = roundToCents(totalRevenue);

    // Update the project document
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      actualRevenue: revenueRounded,
      updatedAt: serverTimestamp()
    });

    console.log(`Updated project ${projectId} actualRevenue to $${revenueRounded.toFixed(2)}`);
  } catch (error) {
    console.error('Error updating project actual revenue:', error);
    throw error;
  }
}

/**
 * Calculate actual revenue for all projects
 * Useful for bulk updates or migrations
 */
export async function updateAllProjectRevenue(): Promise<void> {
  try {
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    
    for (const projectDoc of projectsSnapshot.docs) {
      await updateProjectActualRevenue(projectDoc.id);
    }
    
    console.log(`Updated actual revenue for ${projectsSnapshot.size} projects`);
  } catch (error) {
    console.error('Error updating all project revenue:', error);
    throw error;
  }
}

/**
 * Get a breakdown of project revenue
 */
export async function getProjectRevenueBreakdown(projectId: string): Promise<{
  totalRevenue: number;
  pendingRevenue: number;
  cancelledRevenue: number;
}> {
  try {
    // Get all incomes for this project
    const incomesQuery = query(
      collection(db, 'incomes'),
      where('projectId', '==', projectId)
    );
    const incomesSnapshot = await getDocs(incomesQuery);
    
    let totalRevenue = 0;
    let pendingRevenue = 0;
    let cancelledRevenue = 0;
    
    incomesSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = Number(data.amount) || 0;
      
      if (data.status === 'received') {
        totalRevenue += amount;
      } else if (data.status === 'pending') {
        pendingRevenue += amount;
      } else if (data.status === 'cancelled') {
        cancelledRevenue += amount;
      }
    });

    const revenueRounded = Math.round((totalRevenue + Number.EPSILON) * 100) / 100;
    const pendingRounded = Math.round((pendingRevenue + Number.EPSILON) * 100) / 100;
    const cancelledRounded = Math.round((cancelledRevenue + Number.EPSILON) * 100) / 100;

    return {
      totalRevenue: revenueRounded,
      pendingRevenue: pendingRounded,
      cancelledRevenue: cancelledRounded
    };
  } catch (error) {
    console.error('Error getting project revenue breakdown:', error);
    throw error;
  }
}

