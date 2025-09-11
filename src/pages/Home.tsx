import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../lib/useAuth';
import { usePWAInstall } from '../lib/usePWAInstall';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { sendProjectCreatedEmails } from '../lib/emailNotifications';

const Home: React.FC = () => {
  const { currentUser } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  useEffect(() => {
    const load = async () => {
      console.log('Home: Starting load, currentUser:', currentUser ? 'exists' : 'null');
      if (!currentUser) {
        console.log('Home: No currentUser, returning');
        return;
      }
      
      try {
        // get user doc to determine companyId
        console.log('Home: Fetching user doc for', currentUser.uid);
        const userRef = doc(db, 'users', currentUser.uid);
        let userData = null;
        let existingCompanyId = null;
        
        try {
          const userSnap = await getDoc(userRef);
          console.log('Home: User doc exists:', userSnap.exists());
          
          if (!userSnap.exists()) {
            console.log('Home: User doc does not exist, creating it');
            // Create user doc if it doesn't exist
            await setDoc(userRef, {
              email: currentUser.email,
              displayName: currentUser.displayName || '',
              createdAt: serverTimestamp(),
            });
          }
          
          userData = userSnap.exists() ? (userSnap.data() as any) : null;
          existingCompanyId = userData?.companyId || null;
        } catch (firestoreError) {
          console.error('Home: Firestore error, continuing without company data:', firestoreError);
          // Continue without company data if Firestore fails
        }
        
        console.log('Home: User data:', userData);
        console.log('Home: Company ID:', existingCompanyId);
        
        if (existingCompanyId) {
          setCompanyId(existingCompanyId);
          // fetch company name
          console.log('Home: Fetching company name');
          try {
            const compSnap = await getDoc(doc(db, 'companies', existingCompanyId));
            if (compSnap.exists()) setCompanyName((compSnap.data() as any).name || 'Company');
          } catch (error) {
            console.error('Home: Error fetching company:', error);
          }
          
          // fetch projects
          console.log('Home: Fetching projects');
          try {
            const q = query(collection(db, 'projects'), where('companyId', '==', existingCompanyId));
            const projSnap = await getDocs(q);
            setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (error) {
            console.error('Home: Error fetching projects:', error);
          }
        }
        console.log('Home: Setting loading to false');
        setLoading(false);
      } catch (error) {
        console.error('Home: Error loading data:', error);
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleCreateCompany = async () => {
    if (!currentUser || !newCompanyName.trim()) return;
    const companyDoc = await addDoc(collection(db, 'companies'), {
      name: newCompanyName.trim(),
      ownerId: currentUser.uid,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'users', currentUser.uid), { companyId: companyDoc.id }, { merge: true });
    setCompanyId(companyDoc.id);
    setCompanyName(newCompanyName.trim());
  };

  const handleNewProject = async () => {
    console.log('Home: New Project button clicked');
    console.log('Home: companyId:', companyId);
    
    if (!companyId) {
      console.log('Home: No companyId, cannot create project');
      return;
    }
    
    try {
      console.log('Home: Creating new project...');
      const projectDoc = await addDoc(collection(db, 'projects'), {
        name: `New Project ${projects.length + 1}`,
        companyId,
        phase: 'Sales',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('Home: Project created with ID:', projectDoc.id);
      
      // Send email notifications
      try {
        const projectName = `New Project ${projects.length + 1}`;
        await sendProjectCreatedEmails({
          name: projectName,
          phase: 'Sales'
        }, companyId);
        console.log('Home: Email notifications sent');
      } catch (emailError) {
        console.error('Home: Error sending email notifications:', emailError);
      }
      
      console.log('Home: Navigating to project page...');
      navigate(`/project/${projectDoc.id}`);
    } catch (error) {
      console.error('Home: Error creating project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!projectId) return;
    
    setDeleting(true);
    try {
      console.log('Home: Deleting project:', projectId);
      
      // Delete associated check-ins first
      const checkinsQuery = query(collection(db, 'checkins'), where('projectId', '==', projectId));
      const checkinsSnapshot = await getDocs(checkinsQuery);
      
      const deleteCheckinsPromises = checkinsSnapshot.docs.map(checkinDoc => 
        deleteDoc(doc(db, 'checkins', checkinDoc.id))
      );
      
      await Promise.all(deleteCheckinsPromises);
      console.log('Home: Deleted', checkinsSnapshot.docs.length, 'check-ins');
      
      // Delete the project
      await deleteDoc(doc(db, 'projects', projectId));
      console.log('Home: Project deleted successfully');
      
      // Update local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Home: Error deleting project:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Construction PM" onMenuClick={handleMenuClick}>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Construction PM" onMenuClick={handleMenuClick}>
      <div className="space-y-4">
        {isInstallable && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Install App</p>
                  <p className="text-xs text-blue-700">Get quick access on your home screen</p>
                </div>
                <button 
                  onClick={installApp}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        )}

        {!companyId ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Company</h3>
            <div className="space-y-3">
              <input 
                value={newCompanyName} 
                onChange={(e) => setNewCompanyName(e.target.value)} 
                placeholder="Company Name" 
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" 
              />
              <button 
                onClick={handleCreateCompany} 
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors touch-manipulation"
              >
                Create Company
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
              <button 
                onClick={handleNewProject} 
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors touch-manipulation"
              >
                New Project
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-gray-500 text-sm">No projects yet</p>
                <p className="text-gray-400 text-xs">Create your first project to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p: any) => {
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

                  return (
                    <div
                      key={p.id}
                      className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 touch-manipulation"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 
                          onClick={() => navigate(`/project/${p.id}`)}
                          className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer flex-1 mr-2"
                        >
                          {p.name}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(p.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                          {p.phase || 'Sales'}
                        </span>
                        <button
                          onClick={() => navigate(`/project/${p.id}`)}
                          className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors touch-manipulation"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this project? This will also delete all associated check-ins and cannot be undone.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(deleteConfirm)}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  'Delete Project'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Home;
