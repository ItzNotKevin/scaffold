import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';

const phases = ['Sales','Contract','Materials','Construction','Completion'] as const;
type Phase = typeof phases[number];

const ProjectPage: React.FC = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [phase, setPhase] = useState<Phase>('Sales');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Photos' | 'Staff'>('Photos');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const ref = doc(db, 'projects', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setProjectName(data.name || 'Project');
        setPhase((data.phase as Phase) || 'Sales');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handlePhaseChange = async (newPhase: Phase) => {
    if (!id) return;
    setPhase(newPhase);
    await updateDoc(doc(db, 'projects', id), { phase: newPhase, updatedAt: serverTimestamp() });
  };

  const handleCheck = async (type: 'checkin' | 'checkout') => {
    if (!id || !currentUser) return;
    await addDoc(collection(db, 'checkins'), {
      projectId: id,
      userId: currentUser.uid,
      type,
      time: serverTimestamp(),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout title={projectName}>
      <div className="space-y-4">
        {/* Header with phase dropdown */}
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{projectName}</h2>
            <p className="text-xs text-gray-500">Project ID: {id}</p>
          </div>
          <select value={phase} onChange={(e) => handlePhaseChange(e.target.value as Phase)} className="px-3 py-2 border border-gray-300 rounded-lg">
            {phases.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex space-x-2 mb-4">
            {['Photos','Staff'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`px-3 py-2 rounded-lg text-sm ${activeTab===t?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>{t}</button>
            ))}
          </div>

          {activeTab === 'Photos' && (
            <div className="text-gray-500 text-sm">Photos coming soon.</div>
          )}

          {activeTab === 'Staff' && (
            <div className="space-x-2">
              <button onClick={() => handleCheck('checkin')} className="px-4 py-2 bg-green-600 text-white rounded-lg">Check In</button>
              <button onClick={() => handleCheck('checkout')} className="px-4 py-2 bg-red-600 text-white rounded-lg">Check Out</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ProjectPage;


