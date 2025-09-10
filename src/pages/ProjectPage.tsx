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
  
  console.log('ProjectPage: Rendered with project ID:', id);
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
      where('projectId', '==', id)
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

      // Sort by time (newest first) on the client side
      checkinsData.sort((a, b) => {
        const timeA = a.time?.toDate ? a.time.toDate() : new Date(a.time);
        const timeB = b.time?.toDate ? b.time.toDate() : new Date(b.time);
        return timeB.getTime() - timeA.getTime();
      });

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
              <span className="text-sm font-medium text-gray-700">Current Phase:</span>
              <div className="relative">
                <select 
                  value={phase} 
                  onChange={(e) => handlePhaseChange(e.target.value as Phase)} 
                  className="appearance-none bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 cursor-pointer min-w-[140px]"
                >
                  {phases.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
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
              {/* Check-in/out Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-blue-100">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Staff Check-in/out</h3>
                  <p className="text-blue-700 text-sm mb-4">Use the buttons below to check in or out of this project</p>
                  
                  {checkinMessage && (
                    <div className={`p-4 rounded-xl text-sm font-medium ${
                      checkinMessage.includes('Successfully') 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      <div className="flex items-center justify-center space-x-2">
                        {checkinMessage.includes('Successfully') ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span>{checkinMessage}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Check-ins List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Check In</span>
                    <div className="w-2 h-2 bg-red-500 rounded-full ml-3"></div>
                    <span>Check Out</span>
                  </div>
                </div>
                
                {checkinsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">Loading activity...</p>
                  </div>
                ) : checkins.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium mb-1">No activity yet</p>
                    <p className="text-gray-400 text-sm">Check in or out to see activity here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkins.map((checkin) => (
                      <div
                        key={checkin.id}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${
                            checkin.type === 'checkin' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {checkin.type === 'checkin' ? 'Checked In' : 'Checked Out'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {checkin.userName || checkin.userEmail || 'Unknown User'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
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
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 pb-safe shadow-lg">
          <div className="flex space-x-3">
            <button 
              onClick={() => handleCheck('checkin')} 
              disabled={checkinLoading}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-2xl font-semibold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              <div className="flex items-center justify-center space-x-2">
                {checkinLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Checking In...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Check In</span>
                  </>
                )}
              </div>
            </button>
            <button 
              onClick={() => handleCheck('checkout')} 
              disabled={checkinLoading}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-2xl font-semibold hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              <div className="flex items-center justify-center space-x-2">
                {checkinLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Checking Out...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Check Out</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProjectPage;


