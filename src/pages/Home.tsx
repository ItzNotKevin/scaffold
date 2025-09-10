import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../lib/useAuth';
import { usePWAInstall } from '../lib/usePWAInstall';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const { currentUser } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      // get user doc to determine companyId
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as any) : null;
      const existingCompanyId = userData?.companyId || null;
      if (existingCompanyId) {
        setCompanyId(existingCompanyId);
        // fetch company name
        const compSnap = await getDoc(doc(db, 'companies', existingCompanyId));
        if (compSnap.exists()) setCompanyName((compSnap.data() as any).name || 'Company');
        // fetch projects
        const q = query(collection(db, 'projects'), where('companyId', '==', existingCompanyId));
        const projSnap = await getDocs(q);
        setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
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
    if (!companyId) return;
    const projectDoc = await addDoc(collection(db, 'projects'), {
      name: `New Project ${projects.length + 1}`,
      companyId,
      phase: 'Sales',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigate(`/project/${projectDoc.id}`);
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
              <div className="space-y-2">
                {projects.map((p: any) => (
                  <button 
                    key={p.id} 
                    onClick={() => navigate(`/project/${p.id}`)} 
                    className="w-full text-left p-4 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-colors touch-manipulation"
                  >
                    <div className="font-medium text-gray-900 mb-1">{p.name}</div>
                    <div className="text-xs text-gray-500">Phase: {p.phase || 'Sales'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Home;
