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
      <div className="space-y-6">
        {isInstallable && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Install App</p>
                  <p className="text-xs text-blue-700">Get quick access on your home screen</p>
                </div>
                <button 
                  onClick={installApp}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        )}

        {!companyId ? (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Company</h3>
            <div className="space-y-3">
              <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Company Name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button onClick={handleCreateCompany} className="w-full bg-blue-600 text-white py-2 rounded-lg">Create</button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
              <button onClick={handleNewProject} className="px-3 py-2 bg-blue-600 text-white rounded-lg">New Project</button>
            </div>
            {projects.length === 0 ? (
              <p className="text-gray-500 text-sm">No projects yet.</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p: any) => (
                  <button key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <div className="font-medium text-gray-900">{p.name}</div>
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
