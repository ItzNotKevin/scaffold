import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { sendPhaseUpdateEmails } from '../lib/emailNotifications';

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

interface Feedback {
  id: string;
  projectId: string;
  clientId: string;
  feedback: string;
  createdAt: any;
  clientName?: string;
  clientEmail?: string;
}

interface Task {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  dueDate: any;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  completed: boolean;
  createdAt: any;
  assignedTo?: string;
  assignedToName?: string;
  assignedToEmail?: string;
}

const ProjectPage: React.FC = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  console.log('ProjectPage: Rendered with project ID:', id);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [phase, setPhase] = useState<Phase>('Sales');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Photos' | 'Staff' | 'Feedback' | 'Tasks'>('Photos');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhase, setEditPhase] = useState<Phase>('Sales');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checkinMessage, setCheckinMessage] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'in-progress' | 'completed'>('all');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const ref = doc(db, 'projects', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setProjectName(data.name || 'Project');
        setProjectDescription(data.description || '');
        setPhase((data.phase as Phase) || 'Sales');
        setEditName(data.name || 'Project');
        setEditDescription(data.description || '');
        setEditPhase((data.phase as Phase) || 'Sales');
        setCompanyId(data.companyId || '');
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
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const checkin: Checkin = {
          id: docSnapshot.id,
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

  // Fetch feedback for this project
  useEffect(() => {
    if (!id) return;

    const loadFeedback = async () => {
      try {
        console.log('Loading feedback for project:', id);
        const q = query(
          collection(db, 'feedback'),
          where('projectId', '==', id)
        );
        const snapshot = await getDocs(q);
        console.log('Found', snapshot.docs.length, 'feedback documents on load');
        
        const feedbackData: Feedback[] = [];
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          console.log('Loading feedback doc:', docSnapshot.id, data);
          const feedbackItem: Feedback = {
            id: docSnapshot.id,
            projectId: data.projectId,
            clientId: data.clientId,
            feedback: data.feedback,
            createdAt: data.createdAt,
          };

          // Fetch client details
          try {
            const clientRef = doc(db, 'users', data.clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
              const clientData = clientSnap.data();
              feedbackItem.clientName = clientData.displayName || clientData.name;
              feedbackItem.clientEmail = clientData.email;
              console.log('Client details loaded:', feedbackItem.clientName, feedbackItem.clientEmail);
            }
          } catch (err) {
            console.error('Error fetching client data:', err);
          }

          feedbackData.push(feedbackItem);
        }

        // Sort by creation time (newest first)
        feedbackData.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return timeB.getTime() - timeA.getTime();
        });

        console.log('Setting initial feedback data:', feedbackData);
        setFeedback(feedbackData);
        setFeedbackLoading(false);
      } catch (error) {
        console.error('Error loading feedback:', error);
        setFeedbackLoading(false);
      }
    };

    loadFeedback();
    loadTasks();
    loadCompanyUsers();
  }, [id, companyId]);

  // Load company users for task assignment
  const loadCompanyUsers = async () => {
    if (!companyId) {
      console.log('No companyId available for loading users');
      return;
    }

    try {
      console.log('Loading company users for company:', companyId);
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (!companyDoc.exists()) {
        console.log('Company document not found:', companyId);
        return;
      }

      const companyData = companyDoc.data();
      const memberIds = companyData?.members || [];
      const ownerId = companyData?.ownerId;
      
      // Include owner in members list
      if (ownerId && !memberIds.includes(ownerId)) {
        memberIds.push(ownerId);
      }

      const users: Array<{id: string, name: string, email: string}> = [];
      for (const userId of memberIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            users.push({
              id: userId,
              name: userData.displayName || userData.name || 'Unknown User',
              email: userData.email || 'No email'
            });
          }
        } catch (err) {
          console.error('Error loading user:', userId, err);
        }
      }

      setCompanyUsers(users);
      console.log('Loaded company users:', users);
    } catch (error) {
      console.error('Error loading company users:', error);
    }
  };

  // Load tasks for this project
  const loadTasks = async () => {
    if (!id) return;
    
    try {
      console.log('Loading tasks for project:', id);
      const q = query(
        collection(db, 'tasks'),
        where('projectId', '==', id)
      );
      const snapshot = await getDocs(q);
      console.log('Found', snapshot.docs.length, 'task documents on load');

      const taskData: Task[] = [];
      for (const docSnapshot of snapshot.docs) {
        console.log('Loading task doc:', docSnapshot.id, docSnapshot.data());
        const data = docSnapshot.data();
        const taskItem: Task = {
          id: docSnapshot.id,
          projectId: data.projectId,
          userId: data.userId,
          title: data.title,
          description: data.description,
          dueDate: data.dueDate,
          priority: data.priority,
          completed: data.completed || false,
          createdAt: data.createdAt,
          assignedTo: data.assignedTo,
        };

        // Load assigned user details if assignedTo exists
        if (data.assignedTo) {
          try {
            const assignedUserRef = doc(db, 'users', data.assignedTo);
            const assignedUserSnap = await getDoc(assignedUserRef);
            if (assignedUserSnap.exists()) {
              const assignedUserData = assignedUserSnap.data();
              taskItem.assignedToName = assignedUserData.displayName || assignedUserData.name;
              taskItem.assignedToEmail = assignedUserData.email;
              console.log('Assigned user details loaded:', taskItem.assignedToName, taskItem.assignedToEmail);
            }
          } catch (err) {
            console.error('Error fetching assigned user data:', err);
          }
        }

        taskData.push(taskItem);
      }

      // Sort by due date (earliest first), then by priority
      taskData.sort((a, b) => {
        const dueDateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        const dueDateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
        
        if (dueDateA.getTime() !== dueDateB.getTime()) {
          return dueDateA.getTime() - dueDateB.getTime();
        }
        
        const priorityOrder = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      console.log('Setting initial task data:', taskData);
      setTasks(taskData);
      setTasksLoading(false);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasksLoading(false);
    }
  };

  // Create a new task
  const handleCreateTask = async () => {
    if (!id || !currentUser || !newTaskTitle.trim()) return;

    setSubmittingTask(true);
    try {
      console.log('Creating task for project:', id);
      const taskDoc = await addDoc(collection(db, 'tasks'), {
        projectId: id,
        userId: currentUser.uid,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        dueDate: newTaskDueDate ? new Date(newTaskDueDate) : null,
        priority: newTaskPriority,
        assignedTo: newTaskAssignedTo || null,
        completed: false,
        createdAt: serverTimestamp(),
      });

      console.log('Task created with ID:', taskDoc.id);

      // Clear form
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskDueDate('');
      setNewTaskPriority('Medium');
      setNewTaskAssignedTo('');
      setShowTaskForm(false);

      // Refresh task list
      await loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setSubmittingTask(false);
    }
  };

  // Toggle task completion status
  const handleToggleTaskCompletion = async (taskId: string, currentStatus: boolean) => {
    if (!id || !currentUser) return;

    try {
      console.log('Toggling task completion:', taskId, 'from', currentStatus, 'to', !currentStatus);
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus,
        updatedAt: serverTimestamp(),
      });

      // Refresh task list
      await loadTasks();
    } catch (error) {
      console.error('Error updating task completion:', error);
    }
  };

  // Calculate task statistics
  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const inProgress = tasks.filter(task => !task.completed).length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, inProgress, progressPercentage };
  };

  // Filter tasks based on current filter
  const getFilteredTasks = () => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter(task => taskFilter === 'completed' ? task.completed : !task.completed);
  };

  const handlePhaseChange = async (newPhase: Phase) => {
    if (!id) return;
    const oldPhase = phase;
    setPhase(newPhase);
    await updateDoc(doc(db, 'projects', id), { phase: newPhase, updatedAt: serverTimestamp() });
    
    // Send email notifications for phase update
    try {
      await sendPhaseUpdateEmails({
        name: projectName,
        phase: newPhase
      }, oldPhase, companyId || '');
      console.log('ProjectPage: Phase update email notifications sent');
    } catch (emailError) {
      console.error('ProjectPage: Error sending phase update emails:', emailError);
    }
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

  const handleSubmitFeedback = async () => {
    if (!id || !currentUser || !feedbackText.trim()) return;
    
    setSubmittingFeedback(true);
    
    try {
      console.log('Submitting feedback for project:', id);
      const feedbackDoc = await addDoc(collection(db, 'feedback'), {
        projectId: id,
        clientId: currentUser.uid,
        feedback: feedbackText.trim(),
        createdAt: serverTimestamp(),
      });
      console.log('Feedback submitted with ID:', feedbackDoc.id);
      
      // Refresh feedback list
      console.log('Refreshing feedback list...');
      const q = query(collection(db, 'feedback'), where('projectId', '==', id));
      const snapshot = await getDocs(q);
      console.log('Found', snapshot.docs.length, 'feedback documents');
      
      const feedbackData: Feedback[] = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        console.log('Processing feedback doc:', docSnapshot.id, data);
        const feedbackItem: Feedback = {
          id: docSnapshot.id,
          projectId: data.projectId,
          clientId: data.clientId,
          feedback: data.feedback,
          createdAt: data.createdAt,
        };

        // Fetch client details
        try {
          const clientRef = doc(db, 'users', data.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            feedbackItem.clientName = clientData.displayName || clientData.name;
            feedbackItem.clientEmail = clientData.email;
            console.log('Client details:', feedbackItem.clientName, feedbackItem.clientEmail);
          }
        } catch (err) {
          console.error('Error fetching client data:', err);
        }

        feedbackData.push(feedbackItem);
      }

      // Sort by creation time (newest first)
      feedbackData.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return timeB.getTime() - timeA.getTime();
      });

      console.log('Setting feedback data:', feedbackData);
      setFeedback(feedbackData);
      setFeedbackText('');
      setShowFeedbackForm(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmittingFeedback(false);
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
    setEditDescription(projectDescription);
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
        description: editDescription.trim(),
        phase: editPhase,
        updatedAt: serverTimestamp(),
      });

      setProjectName(editName.trim());
      setProjectDescription(editDescription.trim());
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
        {/* Header with project name, description, and phase */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation"
                  aria-label="Back to Dashboard"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">{projectName}</h1>
              </div>
              {projectDescription && (
                <p className="text-gray-600 text-sm leading-relaxed mb-3">{projectDescription}</p>
              )}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">Phase:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                  phase === 'Sales' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  phase === 'Contract' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                  phase === 'Materials' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                  phase === 'Construction' ? 'bg-green-100 text-green-800 border-green-200' :
                  'bg-gray-100 text-gray-800 border-gray-200'
                }`}>
                  {phase}
                </span>
              </div>
            </div>
            <button
              onClick={handleEdit}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors touch-manipulation font-medium"
            >
              Edit Project
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  placeholder="Enter project description"
                  rows={3}
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
              <span className="text-sm font-medium text-gray-700">Update Phase:</span>
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
            {['Photos','Staff','Feedback','Tasks'].map(t => (
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

          {activeTab === 'Feedback' && (
            <div>
              {/* Leave Feedback Button - Only show for Completion phase */}
              {phase === 'Completion' && (
                <div className="mb-6">
                  {!showFeedbackForm ? (
                    <button
                      onClick={() => setShowFeedbackForm(true)}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-2xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 touch-manipulation shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Leave Feedback</span>
                      </div>
                    </button>
                  ) : (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                      <h3 className="text-lg font-semibold text-green-900 mb-4">Share Your Feedback</h3>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell us about your experience with this project..."
                        className="w-full h-32 px-4 py-3 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-none"
                      />
                      <div className="flex space-x-3 mt-4">
                        <button
                          onClick={() => {
                            setShowFeedbackForm(false);
                            setFeedbackText('');
                          }}
                          disabled={submittingFeedback}
                          className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmitFeedback}
                          disabled={submittingFeedback || !feedbackText.trim()}
                          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {submittingFeedback ? (
                            <div className="flex items-center justify-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Submitting...</span>
                            </div>
                          ) : (
                            'Submit Feedback'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Feedback</h3>
                
                {feedbackLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">Loading feedback...</p>
                  </div>
                ) : feedback.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium mb-1">No feedback yet</p>
                    <p className="text-gray-400 text-sm">
                      {phase === 'Completion' 
                        ? 'Be the first to share your experience!' 
                        : 'Feedback will be available when the project reaches completion.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedback.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl p-5 border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {item.clientName || item.clientEmail || 'Anonymous Client'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatTimestamp(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-700 leading-relaxed">
                          {item.feedback}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Tasks' && (
            <div>
              {/* Create Task Button */}
              <div className="mb-6">
                {!showTaskForm ? (
                  <button
                    onClick={() => setShowTaskForm(true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 touch-manipulation shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Create New Task</span>
                    </div>
                  </button>
                ) : (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">Create New Task</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-2">Task Title *</label>
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Enter task title"
                          className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-2">Description</label>
                        <textarea
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Enter task description"
                          className="w-full h-24 px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-blue-900 mb-2">Due Date</label>
                          <input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-blue-900 mb-2">Priority</label>
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                            className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-2">Assign To</label>
                        <select
                          value={newTaskAssignedTo}
                          onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                          className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">No assignment</option>
                          {companyUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            setShowTaskForm(false);
                            setNewTaskTitle('');
                            setNewTaskDescription('');
                            setNewTaskDueDate('');
                            setNewTaskPriority('Medium');
                            setNewTaskAssignedTo('');
                          }}
                          disabled={submittingTask}
                          className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateTask}
                          disabled={submittingTask || !newTaskTitle.trim()}
                          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {submittingTask ? (
                            <div className="flex items-center justify-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Creating...</span>
                            </div>
                          ) : (
                            'Create Task'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks List */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Project Tasks</h3>
                  {!tasksLoading && tasks.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500">
                        {getTaskStats().completed}/{getTaskStats().total} completed
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getTaskStats().progressPercentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {getTaskStats().progressPercentage}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Task Filter */}
                {!tasksLoading && tasks.length > 0 && (
                  <div className="flex items-center space-x-2 mb-6">
                    <span className="text-sm font-medium text-gray-700">Filter:</span>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setTaskFilter('all')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          taskFilter === 'all'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        All ({getTaskStats().total})
                      </button>
                      <button
                        onClick={() => setTaskFilter('in-progress')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          taskFilter === 'in-progress'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        In Progress ({getTaskStats().inProgress})
                      </button>
                      <button
                        onClick={() => setTaskFilter('completed')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          taskFilter === 'completed'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Completed ({getTaskStats().completed})
                      </button>
                    </div>
                  </div>
                )}

                {tasksLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">Loading tasks...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="text-gray-600 font-medium mb-1">No tasks yet</p>
                    <p className="text-gray-400 text-sm">Create your first task to get started</p>
                  </div>
                ) : getFilteredTasks().length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-gray-600 font-medium mb-1">No {taskFilter} tasks</p>
                    <p className="text-gray-400 text-sm">Try changing the filter or create a new task</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getFilteredTasks().map((task) => {
                      const getPriorityColor = (priority: string) => {
                        switch (priority) {
                          case 'Urgent': return 'bg-red-100 text-red-800 border-red-200';
                          case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
                          case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                          case 'Low': return 'bg-green-100 text-green-800 border-green-200';
                          default: return 'bg-gray-100 text-gray-800 border-gray-200';
                        }
                      };

                      const formatDueDate = (dueDate: any) => {
                        if (!dueDate) return 'No due date';
                        try {
                          const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
                          return date.toLocaleDateString();
                        } catch {
                          return 'Invalid date';
                        }
                      };

                      const isOverdue = (dueDate: any) => {
                        if (!dueDate) return false;
                        try {
                          const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
                          return date < new Date() && !task.completed;
                        } catch {
                          return false;
                        }
                      };

                      return (
                        <div
                          key={task.id}
                          className={`bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 ${
                            task.completed ? 'opacity-60 bg-gray-50' : 'hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className={`text-lg font-semibold text-gray-900 ${task.completed ? 'line-through' : ''}`}>
                                  {task.title}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                {task.completed && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    ✓ Completed
                                  </span>
                                )}
                              </div>

                              {task.description && (
                                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{task.description}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className={isOverdue(task.dueDate) ? 'text-red-600 font-medium' : ''}>
                                    {formatDueDate(task.dueDate)}
                                  </span>
                                </div>

                                {task.assignedToName && (
                                  <div className="flex items-center space-x-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-gray-600">{task.assignedToName}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {task.completed ? (
                                <button
                                  onClick={() => handleToggleTaskCompletion(task.id, task.completed)}
                                  className="bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-800 p-2 rounded-full border-2 border-green-300 hover:border-green-400 transition-all duration-200 shadow-sm hover:shadow-md"
                                  title="Mark as in-progress"
                                >
                                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleTaskCompletion(task.id, task.completed)}
                                  className="bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600 p-2 rounded-full border-2 border-gray-300 hover:border-green-400 transition-all duration-200 shadow-sm hover:shadow-md"
                                  title="Mark as completed"
                                >
                                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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


