import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { usePWAInstall } from '../lib/usePWAInstall';
import { useLanguage } from '../lib/LanguageContext';
import Layout from '../components/Layout';
import AdminDashboard from '../components/AdminDashboard';
import BackButton from '../components/ui/BackButton';
import PageHeader from '../components/ui/PageHeader';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendProjectCreatedEmails } from '../lib/emailNotifications';
import { updateAllProjectCosts } from '../lib/projectCosts';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const { languageKey } = useLanguage();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleMenuClick = () => {
    // No company selection needed - just refresh
    loadProjects();
  };

  const handleNavigateToProject = (projectId: string) => {
    // Navigate to project page
    window.location.href = `/project/${projectId}`;
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

      // Load all projects (no company filtering needed)
      const projectsQuery = query(collection(db, 'projects'));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(projectsData);
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
        const savedData = docSnapshot.data();
        // Update local state with the actual saved data
        setProjects(prev => [...prev, { id: newProjectRef.id, ...savedData }]);
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
    } finally {
      setDeleting(false);
    }
  };

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
    <Layout title="Dashboard" currentRole="admin">
      <div className="space-y-6">
        {/* PWA Install Prompt */}
        {isInstallable && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Install App</h3>
                  <p className="text-xs text-blue-700">Install this app on your device for a better experience</p>
                </div>
              </div>
              <button
                onClick={installApp}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        )}

        {/* Admin Dashboard */}
        <AdminDashboard
          projects={projects}
          onNewProject={handleNewProject}
          onDeleteProject={handleDeleteProject}
          onNavigateToProject={handleNavigateToProject}
          permissions={permissions}
        />
      </div>
    </Layout>
  );
};

export default Home;