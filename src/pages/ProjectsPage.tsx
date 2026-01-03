import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CollapsibleSection from '../components/ui/CollapsibleSection';
import { collection, query, where, getDocs, serverTimestamp, doc, getDoc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { updateAllProjectCosts } from '../lib/projectCosts';

interface ProjectWithActivity {
  id: string;
  name: string;
  phase?: string;
  createdAt?: any;
  lastActivityTime?: number;
  [key: string]: any;
}

const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState<ProjectWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Sales': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Contract': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Materials': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Construction': return 'bg-green-100 text-green-800 border-green-200';
      case 'Completion': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPhaseProgress = (phase: string) => {
    switch (phase) {
      case 'Sales': return { progress: 20, step: 1, total: 5 };
      case 'Contract': return { progress: 40, step: 2, total: 5 };
      case 'Materials': return { progress: 60, step: 3, total: 5 };
      case 'Construction': return { progress: 80, step: 4, total: 5 };
      case 'Completion': return { progress: 100, step: 5, total: 5 };
      default: return { progress: 20, step: 1, total: 5 };
    }
  };

  const getMostRecentActivityTime = async (projectId: string): Promise<number> => {
    let mostRecentTime = 0;

    try {
      // Get most recent task assignment
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      if (!assignmentsSnapshot.empty) {
        const firstDoc = assignmentsSnapshot.docs[0];
        const createdAt = firstDoc.data().createdAt;
        if (createdAt) {
          const time = createdAt.toMillis ? createdAt.toMillis() : (createdAt || 0);
          mostRecentTime = Math.max(mostRecentTime, time);
        }
      }
    } catch (error) {
      // Index might not exist, try without orderBy
      try {
        const assignmentsQuery = query(
          collection(db, 'taskAssignments'),
          where('projectId', '==', projectId)
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        assignmentsSnapshot.docs.forEach(doc => {
          const createdAt = doc.data().createdAt;
          if (createdAt) {
            const time = createdAt.toMillis ? createdAt.toMillis() : (createdAt || 0);
            mostRecentTime = Math.max(mostRecentTime, time);
          }
        });
      } catch (err) {
        console.warn('Error loading assignments for project:', projectId, err);
      }
    }

    try {
      // Get most recent reimbursement/expense
      const reimbursementsQuery = query(
        collection(db, 'reimbursements'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const reimbursementsSnapshot = await getDocs(reimbursementsQuery);
      if (!reimbursementsSnapshot.empty) {
        const firstDoc = reimbursementsSnapshot.docs[0];
        const createdAt = firstDoc.data().createdAt;
        if (createdAt) {
          const time = createdAt.toMillis ? createdAt.toMillis() : (createdAt || 0);
          mostRecentTime = Math.max(mostRecentTime, time);
        }
      }
    } catch (error) {
      // Index might not exist, try without orderBy
      try {
        const reimbursementsQuery = query(
          collection(db, 'reimbursements'),
          where('projectId', '==', projectId)
        );
        const reimbursementsSnapshot = await getDocs(reimbursementsQuery);
        reimbursementsSnapshot.docs.forEach(doc => {
          const createdAt = doc.data().createdAt;
          if (createdAt) {
            const time = createdAt.toMillis ? createdAt.toMillis() : (createdAt || 0);
            mostRecentTime = Math.max(mostRecentTime, time);
          }
        });
      } catch (err) {
        console.warn('Error loading reimbursements for project:', projectId, err);
      }
    }

    try {
      // Get most recent photo
      const photosQuery = query(
        collection(db, 'projectPhotos'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const photosSnapshot = await getDocs(photosQuery);
      if (!photosSnapshot.empty) {
        const firstDoc = photosSnapshot.docs[0];
        const createdAt = firstDoc.data().createdAt;
        if (createdAt) {
          const time = createdAt.toMillis ? createdAt.toMillis() : (createdAt || 0);
          mostRecentTime = Math.max(mostRecentTime, time);
        }
      }
    } catch (error) {
      // Index might not exist, try without orderBy
      try {
        const photosQuery = query(
          collection(db, 'projectPhotos'),
          where('projectId', '==', projectId)
        );
        const photosSnapshot = await getDocs(photosQuery);
        photosSnapshot.docs.forEach(doc => {
          const createdAt = doc.data().createdAt;
          if (createdAt) {
            const time = createdAt.toMillis ? createdAt.toMillis() : (createdAt || 0);
            mostRecentTime = Math.max(mostRecentTime, time);
          }
        });
      } catch (err) {
        console.warn('Error loading photos for project:', projectId, err);
      }
    }

    return mostRecentTime;
  };

  const loadProjects = async () => {
    if (!currentUser) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Ensure project budgets reflect latest costs before displaying
      try {
        await updateAllProjectCosts();
      } catch (costError) {
        console.error('Error updating project cost totals:', costError);
      }

      // Load all projects
      const projectsQuery = query(collection(db, 'projects'));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsData: ProjectWithActivity[] = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get most recent activity time for each project
      const projectsWithActivity = await Promise.all(
        projectsData.map(async (project) => {
          const lastActivityTime = await getMostRecentActivityTime(project.id);
          return {
            ...project,
            lastActivityTime
          };
        })
      );

      // Sort projects by most recent activity (descending - most recent first)
      // Projects with no activities fall back to createdAt
      projectsWithActivity.sort((a, b) => {
        const aTime = a.lastActivityTime || a.createdAt?.toMillis?.() || a.createdAt || 0;
        const bTime = b.lastActivityTime || b.createdAt?.toMillis?.() || b.createdAt || 0;
        return bTime - aTime;
      });

      setProjects(projectsWithActivity);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = async () => {
    // Prompt for project name
    const projectName = prompt('Enter project name:');
    
    // If user cancelled or entered empty name, don't create project
    if (!projectName || projectName.trim() === '') {
      return;
    }

    try {
      const trimmedName = projectName.trim();
      const newProjectRef = doc(collection(db, 'projects'));
      const newProject = {
        id: newProjectRef.id,
        name: trimmedName,
        description: '',
        status: 'planning',
        phase: 'Sales',
        budget: 0,
        actualCost: 0,
        laborCost: 0,
        reimbursementCost: 0,
        progress: 0,
        startDate: null,
        endDate: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        team: []
      };

      // Wait for the document to be written to Firestore
      await setDoc(newProjectRef, newProject);
      
      // Verify the document was written by reading it back
      const docSnapshot = await getDoc(newProjectRef);
      if (docSnapshot.exists()) {
        // Reload projects to show the new one
        await loadProjects();
        // Navigate after confirming the document exists
        navigate(`/project/${newProjectRef.id}`);
      } else {
        throw new Error('Project was not created successfully');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      setDeleting(true);
      await deleteDoc(doc(db, 'projects', projectId));
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  // Separate projects into active and completed
  const { activeProjects, completedProjects } = useMemo(() => {
    const active = projects.filter(p => p.phase !== 'Completion');
    const completed = projects.filter(p => p.phase === 'Completion');
    return { activeProjects: active, completedProjects: completed };
  }, [projects]);

  // Helper function to render a project card
  const renderProjectCard = (p: ProjectWithActivity) => (
    <div
      key={p.id}
      className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 touch-manipulation"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 
          onClick={() => handleNavigateToProject(p.id)}
          className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer flex-1 mr-2"
        >
          {p.name}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteProject(p.id);
          }}
          disabled={deleting}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="Delete project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{getPhaseProgress(p.phase || 'Sales').step}/{getPhaseProgress(p.phase || 'Sales').total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${getPhaseProgress(p.phase || 'Sales').progress}%` }}
          ></div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPhaseColor(p.phase || 'Sales')}`}>
          {t(`project.${(p.phase || 'Sales').toLowerCase()}`)}
        </span>
        <button
          onClick={() => handleNavigateToProject(p.id)}
          className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors touch-manipulation"
        >
          View Details →
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    if (currentUser) {
      loadProjects();
    }
  }, [currentUser]);

  if (!currentUser || !userProfile) {
    return (
      <Layout title="Loading..." currentRole="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Projects" currentRole="admin">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Projects</h1>
            </div>
            <button 
              onClick={handleNewProject} 
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors touch-manipulation min-h-[44px]"
            >
              {t('project.newProject')}
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-gray-500 text-sm">No projects yet</p>
              <p className="text-gray-400 text-xs">Create your first project to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Projects */}
              {activeProjects.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Projects</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeProjects.map(renderProjectCard)}
                  </div>
                </div>
              )}

              {/* Completed Projects */}
              {completedProjects.length > 0 && (
                <CollapsibleSection
                  title="Completed Projects"
                  count={completedProjects.length}
                  defaultExpanded={false}
                  className="bg-white"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedProjects.map(renderProjectCard)}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ProjectsPage;

