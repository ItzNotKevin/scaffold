import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';

const phases = ['Sales','Contract','Materials','Construction','Completion'] as const;
type Phase = typeof phases[number];

interface Checkin {
  id: string;
  type: 'checkin' | 'checkout';
  time: any;
  userId: string;
  userName?: string;
  userEmail?: string;
}

const ProjectPage: React.FC = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [phase, setPhase] = useState<Phase>('Sales');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Photos' | 'Staff'>('Photos');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhase, setEditPhase] = useState<Phase>('Sales');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checkinMessage, setCheckinMessage] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const ref = doc(db, 'projects', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setProjectName(data.name || 'Project');
        setPhase((data.phase as Phase) || 'Sales');
        setEditName(data.name || 'Project');
        setEditPhase((data.phase as Phase) || 'Sales');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Fetch check-ins with real-time updates
  useEffect(() => {
    if (!id) return;

    const q = query(
      collection(db, 'checkins'),
      where('projectId', '==', id),
      orderBy('time', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const checkinsData: Checkin[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const checkin: Checkin = {
          id: doc.id,
          type: data.type,
          time: data.time,
          userId: data.userId,
        };

        // Fetch user details
        try {
          const userRef = doc(db, 'users', data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            checkin.userName = userData.displayName || userData.name;
            checkin.userEmail = userData.email;
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
        }

        checkinsData.push(checkin);
      }

      setCheckins(checkinsData);
      setCheckinsLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handlePhaseChange = async (newPhase: Phase) => {
    if (!id) return;
    setPhase(newPhase);
    await updateDoc(doc(db, 'projects', id), { phase: newPhase, updatedAt: serverTimestamp() });
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (err) {
      return 'Invalid date';
    }
  };

  const handleCheck = async (type: 'checkin' | 'checkout') => {
    if (!id || !currentUser) return;
    
    setCheckinLoading(true);
    setCheckinMessage('');
    
    try {
      await addDoc(collection(db, 'checkins'), {
        projectId: id,
        userId: currentUser.uid,
        type,
        time: serverTimestamp(),
      });
      
      const action = type === 'checkin' ? 'checked in' : 'checked out';
      setCheckinMessage(`Successfully ${action}!`);
      
      // Clear message after 3 seconds
      setTimeout(() => setCheckinMessage(''), 3000);
    } catch (err: any) {
      setCheckinMessage(`Failed to ${type === 'checkin' ? 'check in' : 'check out'}: ${err.message}`);
      setTimeout(() => setCheckinMessage(''), 5000);
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditName(projectName);
    setEditPhase(phase);
    setError('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(projectName);
    setEditPhase(phase);
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!id || !editName.trim()) {
      setError('Project name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateDoc(doc(db, 'projects', id), {
        name: editName.trim(),
        phase: editPhase,
        updatedAt: serverTimestamp(),
      });

      setProjectName(editName.trim());
      setPhase(editPhase);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
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
      <div className="space-y-4 pb-20">
        {/* Header with phase dropdown and edit button */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{projectName}</h2>
              <p className="text-xs text-gray-500">Project ID: {id}</p>
            </div>
            <button
              onClick={handleEdit}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors touch-manipulation"
            >
              Edit
            </button>
          </div>
          
          {isEditing ? (
            <div className="space-y-3 p-3 bg-gray-50 rounded-xl">
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                <select
                  value={editPhase}
                  onChange={(e) => setEditPhase(e.target.value as Phase)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {phases.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Phase:</span>
              <select 
                value={phase} 
                onChange={(e) => handlePhaseChange(e.target.value as Phase)} 
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {phases.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex space-x-2 mb-4">
            {['Photos','Staff'].map(t => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t as any)} 
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors touch-manipulation ${activeTab===t?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === 'Photos' && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📸</div>
              <p className="text-gray-500 text-sm">Photos coming soon</p>
              <p className="text-gray-400 text-xs">Upload and manage project photos</p>
            </div>
          )}

          {activeTab === 'Staff' && (
            <div>
              <div className="text-center py-4">
                <div className="text-4xl mb-3">👷</div>
                <p className="text-gray-500 text-sm mb-4">Staff Check-in/out</p>
                <p className="text-gray-400 text-xs mb-4">Use the buttons below to check in or out</p>
                
                {checkinMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    checkinMessage.includes('Successfully') 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {checkinMessage}
                  </div>
                )}
              </div>

              {/* Check-ins List */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Check-ins</h3>
                
                {checkinsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">Loading check-ins...</p>
                  </div>
                ) : checkins.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <div className="text-2xl mb-2">📝</div>
                    <p className="text-gray-500 text-sm">No check-ins yet</p>
                    <p className="text-gray-400 text-xs">Check in or out to see activity here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {checkins.map((checkin) => (
                      <div
                        key={checkin.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            checkin.type === 'checkin' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {checkin.type === 'checkin' ? 'Check In' : 'Check Out'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {checkin.userName || checkin.userEmail || 'Unknown User'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatTimestamp(checkin.time)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      {activeTab === 'Staff' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe">
          <div className="flex space-x-3">
            <button 
              onClick={() => handleCheck('checkin')} 
              disabled={checkinLoading}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {checkinLoading ? 'Checking In...' : 'Check In'}
            </button>
            <button 
              onClick={() => handleCheck('checkout')} 
              disabled={checkinLoading}
              className="flex-1 bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {checkinLoading ? 'Checking Out...' : 'Check Out'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProjectPage;


