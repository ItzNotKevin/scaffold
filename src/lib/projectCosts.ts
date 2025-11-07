import { collection, query, where, getDocs, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Calculate and update a project's actual cost based on:
 * 1. Task assignments (staff wages)
 * 2. Approved reimbursements
 */
export async function updateProjectActualCost(projectId: string): Promise<void> {
  try {
    const roundToCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

    // Get all task assignments for this project
    const assignmentsQuery = query(
      collection(db, 'taskAssignments'),
      where('projectId', '==', projectId)
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    
    // Calculate total wages from task assignments
    let totalWages = 0;
    assignmentsSnapshot.forEach(doc => {
      const data = doc.data();
      totalWages += Number(data.dailyRate) || 0;
    });

    // Get all approved reimbursements for this project
    const reimbursementsQuery = query(
      collection(db, 'reimbursements'),
      where('projectId', '==', projectId),
      where('status', '==', 'approved')
    );
    const reimbursementsSnapshot = await getDocs(reimbursementsQuery);
    
    // Calculate total reimbursements
    let totalReimbursements = 0;
    reimbursementsSnapshot.forEach(doc => {
      const data = doc.data();
      totalReimbursements += Number(data.amount) || 0;
    });

    // Calculate total actual cost
    const wagesRounded = roundToCents(totalWages);
    const reimbursementsRounded = roundToCents(totalReimbursements);
    const totalActualCost = roundToCents(wagesRounded + reimbursementsRounded);

    // Update the project document
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      actualCost: totalActualCost,
      laborCost: wagesRounded,
      reimbursementCost: reimbursementsRounded,
      updatedAt: serverTimestamp()
    });

    console.log(`Updated project ${projectId} actualCost to $${totalActualCost.toFixed(2)} (Wages: $${totalWages.toFixed(2)}, Reimbursements: $${totalReimbursements.toFixed(2)})`);
  } catch (error) {
    console.error('Error updating project actual cost:', error);
    throw error;
  }
}

/**
 * Calculate actual costs for all projects
 * Useful for bulk updates or migrations
 */
export async function updateAllProjectCosts(): Promise<void> {
  try {
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    
    for (const projectDoc of projectsSnapshot.docs) {
      await updateProjectActualCost(projectDoc.id);
    }
    
    console.log(`Updated actual costs for ${projectsSnapshot.size} projects`);
  } catch (error) {
    console.error('Error updating all project costs:', error);
    throw error;
  }
}

/**
 * Get a breakdown of project costs
 */
export async function getProjectCostBreakdown(projectId: string): Promise<{
  totalWages: number;
  totalReimbursements: number;
  totalActualCost: number;
  budget: number;
  remaining: number;
  percentUsed: number;
}> {
  try {
    // Get project data
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }
    
    const projectData = projectDoc.data();
    const budget = projectData.budget || 0;

    // Get all task assignments for this project
    const assignmentsQuery = query(
      collection(db, 'taskAssignments'),
      where('projectId', '==', projectId)
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    
    let totalWages = 0;
    assignmentsSnapshot.forEach(doc => {
      const data = doc.data();
      totalWages += Number(data.dailyRate) || 0;
    });

    // Get all approved reimbursements for this project
    const reimbursementsQuery = query(
      collection(db, 'reimbursements'),
      where('projectId', '==', projectId),
      where('status', '==', 'approved')
    );
    const reimbursementsSnapshot = await getDocs(reimbursementsQuery);
    
    let totalReimbursements = 0;
    reimbursementsSnapshot.forEach(doc => {
      const data = doc.data();
      totalReimbursements += Number(data.amount) || 0;
    });

    const wagesRounded = Math.round((totalWages + Number.EPSILON) * 100) / 100;
    const reimbursementsRounded = Math.round((totalReimbursements + Number.EPSILON) * 100) / 100;
    const totalActualCost = Math.round((wagesRounded + reimbursementsRounded + Number.EPSILON) * 100) / 100;
    const remaining = Math.round(((budget - totalActualCost) + Number.EPSILON) * 100) / 100;
    const percentUsed = budget > 0 ? (totalActualCost / budget) * 100 : 0;

    return {
      totalWages: wagesRounded,
      totalReimbursements: reimbursementsRounded,
      totalActualCost,
      budget,
      remaining,
      percentUsed
    };
  } catch (error) {
    console.error('Error getting project cost breakdown:', error);
    throw error;
  }
}

