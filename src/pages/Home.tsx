import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, type UserRole } from '../lib/useAuth';
import { getRolePermissions } from '../lib/useAuth';
import { usePWAInstall } from '../lib/usePWAInstall';
import { useLanguage } from '../lib/LanguageContext';
import Layout from '../components/Layout';
import NotificationPermission from '../components/NotificationPermission';
import CompanyManagementDashboard from '../components/CompanyManagementDashboard';
import AdminDashboard from '../components/AdminDashboard';
import StaffDashboard from '../components/StaffDashboard';
import ClientDashboard from '../components/ClientDashboard';
import BackButton from '../components/ui/BackButton';
import PageHeader from '../components/ui/PageHeader';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendProjectCreatedEmails } from '../lib/emailNotifications';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions, createCompany, joinCompany } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const { languageKey } = useLanguage();
  const navigate = useNavigate();
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedCompanyPermissions, setSelectedCompanyPermissions] = useState<any>(null);

  const handleMenuClick = () => {
    // Menu click handler
  };

  const handleNavigateToProject = (projectId: string) => {
    // Navigate to project page
    window.location.href = `/project/${projectId}`;
  };

  const loadCompanyData = async (companyId: string) => {
    if (!companyId || !currentUser) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Load company details
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        const companyData = companyDoc.data();
        setSelectedCompanyName(companyData.name || 'Company');
      }
      
      // Load user's role in this company
      const membershipDoc = await getDoc(doc(db, 'companyMemberships', `${currentUser.uid}_${companyId}`));
      
      let userRole = 'client'; // Default role
      
      if (membershipDoc.exists()) {
        const membership = membershipDoc.data();
        userRole = membership.role;
      } else {
        // Check if user is company owner
        if (companyDoc.exists()) {
          const companyData = companyDoc.data();
          if (companyData.ownerId === currentUser.uid) {
            userRole = 'admin';
          }
        }
      }
      
      // Set permissions based on role
      const rolePermissions = getRolePermissions(userRole as UserRole);
      setSelectedCompanyPermissions(rolePermissions);
      
      // Load projects for this company
      const projectsQuery = query(collection(db, 'projects'), where('companyId', '==', companyId));
      const projectsSnapshot = await getDocs(projectsQuery);
      setProjects(projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
    } catch (error) {
      console.error('Error loading company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    await loadCompanyData(companyId);
  };

  const handleBackToCompanies = () => {
    setSelectedCompanyId(null);
    setSelectedCompanyName('');
    setProjects([]);
  };

  const handleCreateCompany = async (companyName: string): Promise<string> => {
    if (!currentUser || !companyName.trim()) {
      throw new Error('Invalid user or company name');
    }
    
    try {
      const newCompanyId = await createCompany(companyName.trim());
      console.log('Company created successfully:', newCompanyId);
      return newCompanyId;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  };

  const handleJoinCompany = async (companyId: string) => {
    if (!currentUser || !companyId.trim()) return;
    
    try {
      await joinCompany(companyId.trim());
      console.log('Joined company successfully:', companyId);
    } catch (error) {
      console.error('Error joining company:', error);
      throw error;
    }
  };

  const handleNewProject = async () => {
    console.log('handleNewProject called, selectedCompanyId:', selectedCompanyId);
    if (!selectedCompanyId) {
      console.log('No selectedCompanyId, cannot create project');
      return;
    }
    
    try {
      console.log('Creating new project...');
      const projectDoc = await addDoc(collection(db, 'projects'), {
        name: `New Project ${projects.length + 1}`,
        companyId: selectedCompanyId,
        phase: 'Sales',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('Project created with ID:', projectDoc.id);
      
      // Send email notifications
      try {
        const projectName = `New Project ${projects.length + 1}`;
        await sendProjectCreatedEmails({
          name: projectName,
          phase: 'Sales'
        }, selectedCompanyId);
        console.log('Email notifications sent');
      } catch (emailError) {
        console.error('Error sending email notifications:', emailError);
      }
      
      console.log('Navigating to project page...');
      navigate(`/project/${projectDoc.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!projectId) return;
    
    setDeleting(true);
    try {
      // Delete associated check-ins first
      const checkinsQuery = query(collection(db, 'checkins'), where('projectId', '==', projectId));
      const checkinsSnapshot = await getDocs(checkinsQuery);
      
      const deleteCheckinsPromises = checkinsSnapshot.docs.map(checkinDoc => 
        deleteDoc(doc(db, 'checkins', checkinDoc.id))
      );
      
      await Promise.all(deleteCheckinsPromises);
      
      // Delete the project
      await deleteDoc(doc(db, 'projects', projectId));
      
      // Update local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Show role-based dashboard if a company is selected
  if (selectedCompanyId) {
    const commonProps = {
      projects,
      onNewProject: handleNewProject,
      onDeleteProject: handleDeleteProject,
      onEditProject: (projectId: string) => navigate(`/project/${projectId}`),
      onNavigateToProject: handleNavigateToProject,
      companyName: selectedCompanyName,
      companyId: selectedCompanyId,
      permissions: selectedCompanyPermissions
    };

    const getUserRole = () => {
      if (!selectedCompanyPermissions) {
        return 'client';
      }
      if (selectedCompanyPermissions.canManageUsers) {
        return 'admin';
      }
      if (selectedCompanyPermissions.canManageProjects) {
        return 'staff';
      }
      return 'client';
    };

    const userRole = getUserRole();

    return (
      <Layout title={`${selectedCompanyName} - ${t('app.title')}`} onMenuClick={handleMenuClick} currentRole={userRole}>
        <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
          <NotificationPermission />
          
          <PageHeader
            title={selectedCompanyName}
            subtitle={t('app.title')}
            className="flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0"
          >
            <BackButton onClick={handleBackToCompanies} className="w-full sm:w-auto">
              {t('common.backToCompanies')}
            </BackButton>
          </PageHeader>
          
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 text-sm mt-2">Loading company data...</p>
            </div>
          ) : (
            <>
              {userRole === 'admin' && <AdminDashboard {...commonProps} />}
              {userRole === 'staff' && <StaffDashboard {...commonProps} />}
              {userRole === 'client' && <ClientDashboard {...commonProps} />}
            </>
          )}
        </div>
      </Layout>
    );
  }

  // Show company management dashboard if no company is selected
  return (
    <Layout title={t('app.title')} onMenuClick={handleMenuClick} currentRole={undefined}>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <NotificationPermission />
        
        
        <CompanyManagementDashboard
          onCreateCompany={handleCreateCompany}
          onJoinCompany={handleJoinCompany}
          onSelectCompany={handleSelectCompany}
          userProfile={userProfile}
        />
      </div>
    </Layout>
  );
};

export default Home;