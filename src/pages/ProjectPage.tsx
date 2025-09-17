import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { sendPhaseUpdateEmails } from '../lib/emailNotifications';
import { useFCM } from '../lib/useFCM';
import DailyReportForm from '../components/DailyReportForm';
import DailyReportList from '../components/DailyReportList';
import type { DailyReport } from '../lib/types';

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
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  dueDate: any;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  completed: boolean;
  createdAt: any;
  updatedAt?: any;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  assignedTo?: string;
  assignedToName?: string;
  assignedToEmail?: string;
}

interface Comment {
  id: string;
  taskId: string;
  comment: string;
  userId: string;
  timestamp: any;
  userName?: string;
  userEmail?: string;
  parentCommentId?: string; // For replies
  replies?: Comment[]; // Nested replies
}

interface Reply {
  id: string;
  commentId: string;
  taskId: string;
  reply: string;
  userId: string;
  timestamp: any;
  userName?: string;
  userEmail?: string;
}

interface ProjectPhoto {
  id: string;
  url: string;
  name: string;
  uploadedBy: string;
  uploadedAt: any;
  size: number;
}

interface Expense {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  category: 'materials' | 'labor' | 'equipment' | 'permits' | 'utilities' | 'other';
  date: any;
  userId: string;
  userName?: string;
  userEmail?: string;
}

const ProjectPage: React.FC = () => {
  const { id } = useParams();
  const { currentUser, permissions } = useAuth();
  const navigate = useNavigate();
  const { fcmToken } = useFCM();
  
  // Debug the id parameter
  console.log('ProjectPage: id from useParams:', id);
  console.log('ProjectPage: current URL:', window.location.href);
  

  // FCM Notification functions
  const showTaskNotification = (taskTitle: string, action: string, projectName: string) => {
    if (fcmToken) {
      // Check if it's a fallback token
      if (fcmToken.startsWith('fallback-')) {
        // Use basic browser notification as fallback
        if (Notification.permission === 'granted') {
          new Notification('Task Update', {
            body: `Task "${taskTitle}" was ${action} in project "${projectName}"`,
            icon: '/scaffold-logo.png',
            tag: `task-${id}-${Date.now()}`
          });
        }
        return;
      }
      
      // Send FCM notification via Cloud Function
      fetch(`${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL}/sendFCMNotificationHTTP`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: [fcmToken],
          title: 'Task Update',
          body: `Task "${taskTitle}" was ${action} in project "${projectName}"`,
          data: {
            type: 'task-update',
            taskTitle,
            action,
            projectName,
            projectId: id
          }
        })
      }).catch(error => {
        console.error('Error sending FCM notification:', error);
        // Fallback to basic notification if FCM fails
        if (Notification.permission === 'granted') {
          new Notification('Task Update', {
            body: `Task "${taskTitle}" was ${action} in project "${projectName}"`,
            icon: '/scaffold-logo.png',
            tag: `task-${id}-${Date.now()}`
          });
        }
      });
    } else {
      // Use basic notification if no FCM token
      if (Notification.permission === 'granted') {
        new Notification('Task Update', {
          body: `Task "${taskTitle}" was ${action} in project "${projectName}"`,
          icon: '/scaffold-logo.png',
          tag: `task-${id}-${Date.now()}`
        });
      }
    }
  };

  const showProjectNotification = (projectName: string, action: string) => {
    console.log('showProjectNotification called:', { projectName, action, fcmToken, permission: Notification.permission, id });
    
    // Check if id is available
    if (!id) {
      console.error('Project ID is undefined, cannot send notification');
      return;
    }
    
    if (fcmToken) {
      // Check if it's a fallback token
      if (fcmToken.startsWith('fallback-')) {
        console.log('Using fallback notification for project');
        // Use basic browser notification as fallback
        if (Notification.permission === 'granted') {
          new Notification('Project Update', {
            body: `Project "${projectName}" was ${action}`,
            icon: '/scaffold-logo.png',
            tag: `project-${id}-${Date.now()}`
          });
          console.log('Fallback project notification sent');
        } else {
          console.log('Notification permission not granted for fallback');
        }
        return;
      }
      
      console.log('Sending FCM notification for project');
      // Send FCM notification via Cloud Function
      const fcmUrl = `${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL}/sendFCMNotificationHTTP`;
      console.log('FCM URL:', fcmUrl);
      fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: [fcmToken],
          title: 'Project Update',
          body: `Project "${projectName}" was ${action}`,
          data: {
            type: 'project-update',
            projectName,
            action,
            projectId: id
          }
        })
      }).catch(error => {
        console.error('Error sending FCM notification:', error);
        // Fallback to basic notification if FCM fails
        console.log('FCM failed, using fallback notification for project');
        if (Notification.permission === 'granted') {
          new Notification('Project Update', {
            body: `Project "${projectName}" was ${action}`,
            icon: '/scaffold-logo.png',
            tag: `project-${id}-${Date.now()}`
          });
          console.log('Fallback project notification sent after FCM error');
        }
      });
    } else {
      console.log('No FCM token available for project notification');
      // Use basic notification if no FCM token
      if (Notification.permission === 'granted') {
        new Notification('Project Update', {
          body: `Project "${projectName}" was ${action}`,
          icon: '/scaffold-logo.png',
          tag: `project-${id}-${Date.now()}`
        });
        console.log('Basic project notification sent (no FCM token)');
      } else {
        console.log('Notification permission not granted');
      }
    }
  };

  const showCommentNotification = (commenterName: string, taskTitle: string) => {
    if (fcmToken) {
      // Check if it's a fallback token
      if (fcmToken.startsWith('fallback-')) {
        // Use basic browser notification as fallback
        if (Notification.permission === 'granted') {
          new Notification('New Comment', {
            body: `${commenterName} commented on task "${taskTitle}"`,
            icon: '/scaffold-logo.png',
            tag: `comment-${id}-${Date.now()}`
          });
        }
        return;
      }
      
      // Send FCM notification via Cloud Function
      fetch(`${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL}/sendFCMNotificationHTTP`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: [fcmToken],
          title: 'New Comment',
          body: `${commenterName} commented on task "${taskTitle}"`,
          data: {
            type: 'comment',
            commenterName,
            taskTitle,
            projectId: id
          }
        })
      }).catch(error => console.error('Error sending FCM notification:', error));
    }
  };
  
  console.log('ProjectPage: Rendered with project ID:', id);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [phase, setPhase] = useState<Phase>('Sales');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Photos' | 'Staff' | 'Feedback' | 'Tasks' | 'Daily Reports'>('Photos');
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
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentingTaskId, setCommentingTaskId] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [newReply, setNewReply] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  
  // Daily Reports state
  const [showDailyReportForm, setShowDailyReportForm] = useState(false);
  const [editingDailyReport, setEditingDailyReport] = useState<DailyReport | null>(null);
  
  // Photo upload feature enabled - Firebase Storage bucket is now available
  const PHOTO_UPLOAD_ENABLED = true;
  const [showFinancialForm, setShowFinancialForm] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [budget, setBudget] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [submittingFinancial, setSubmittingFinancial] = useState(false);
  
  // Expense management state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState<'materials' | 'labor' | 'equipment' | 'permits' | 'utilities' | 'other'>('materials');
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
  const [newExpenseDate, setNewExpenseDate] = useState<string>('');
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'materials' | 'labor' | 'equipment' | 'permits' | 'utilities' | 'other'>('all');

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
        
        // Load financial data
        setBudget(data.budget || 0);
        setActualCost(data.actualCost || 0);
        setStartDate(data.startDate ? (data.startDate.toDate ? data.startDate.toDate().toISOString().split('T')[0] : new Date(data.startDate).toISOString().split('T')[0]) : '');
        setEndDate(data.endDate ? (data.endDate.toDate ? data.endDate.toDate().toISOString().split('T')[0] : new Date(data.endDate).toISOString().split('T')[0]) : '');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Fetch expenses with real-time updates
  useEffect(() => {
    if (!id) return;

    const expensesRef = collection(db, 'expenses');
    const q = query(expensesRef, where('projectId', '==', id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Expenses snapshot received:', snapshot.docs.length, 'documents');
      const expensesData: Expense[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Expense));
      
      console.log('Expenses data:', expensesData);
      
      // Sort by date in descending order (newest first)
      expensesData.sort((a, b) => {
        const dateA = a.date ? (a.date.toDate ? a.date.toDate() : new Date(a.date)) : new Date(0);
        const dateB = b.date ? (b.date.toDate ? b.date.toDate() : new Date(b.date)) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setExpenses(expensesData);
      setExpensesLoading(false);
      
      // Calculate total actual cost from expenses
      const totalExpenses = expensesData.reduce((sum, expense) => sum + (expense.amount || 0), 0);
      setActualCost(totalExpenses);
      
      console.log('Expenses loading completed, total:', totalExpenses);
    }, (error) => {
      console.error('Error fetching expenses:', error);
      setExpensesLoading(false);
    });

    return () => unsubscribe();
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

  // Load comments when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      loadComments();
    }
  }, [tasks]);

  // Load photos when component mounts
  useEffect(() => {
    loadPhotos();
  }, [id]);

  // Add timeout for photo loading
  useEffect(() => {
    if (photosLoading) {
      const timeout = setTimeout(() => {
        console.warn('Photo loading timeout - setting loading to false');
        setPhotosLoading(false);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [photosLoading]);

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

  // Load comments for all tasks in this project
  const loadComments = async () => {
    if (!id || tasks.length === 0) return;
    
    try {
      console.log('Loading comments for project:', id, 'with tasks:', tasks.map(t => t.id));
      const q = query(
        collection(db, 'comments'),
        where('taskId', 'in', tasks.map(task => task.id))
      );
      const snapshot = await getDocs(q);
      console.log('Found', snapshot.docs.length, 'comment documents');
      
      const commentsData: Comment[] = [];
      const repliesData: Comment[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const commentItem: Comment = {
          id: docSnapshot.id,
          taskId: data.taskId,
          comment: data.comment,
          userId: data.userId,
          timestamp: data.timestamp,
          parentCommentId: data.parentCommentId || null,
        };

        // Load user details for the comment
        try {
          const userRef = doc(db, 'users', data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            commentItem.userName = userData.displayName || userData.name || 'Unknown User';
            commentItem.userEmail = userData.email;
          }
        } catch (err) {
          console.error('Error fetching user data for comment:', err);
        }

        // Separate main comments from replies
        if (data.parentCommentId) {
          repliesData.push(commentItem);
        } else {
          commentsData.push(commentItem);
        }
      }

      // Sort main comments by timestamp (newest first)
      commentsData.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return timeB.getTime() - timeA.getTime();
      });

      // Sort replies by timestamp (oldest first for better reading flow)
      repliesData.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return timeA.getTime() - timeB.getTime();
      });

      // Attach replies to their parent comments
      commentsData.forEach(comment => {
        comment.replies = repliesData.filter(reply => reply.parentCommentId === comment.id);
      });

      console.log('Setting comments data:', commentsData);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setCommentsLoading(false);
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
          status: data.status || 'todo',
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
        recurrence: newTaskRecurrence,
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
      setNewTaskRecurrence('none');
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
      
      // Find the task to check for recurrence
      const task = tasks.find(t => t.id === taskId);
      
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus,
        updatedAt: serverTimestamp(),
      });

      // If task is being completed and has recurrence, create a new recurring task
      if (!currentStatus && task && task.recurrence && task.recurrence !== 'none') {
        await createRecurringTask(task);
      }

      // Refresh task list
      await loadTasks();
      
      // Show notification
      if (task) {
        showTaskNotification(
          task.title,
          !currentStatus ? 'completed' : 'marked as in-progress',
          projectName
        );
      }
    } catch (error) {
      console.error('Error updating task completion:', error);
    }
  };

  // Create a new recurring task based on the completed task
  const createRecurringTask = async (originalTask: any) => {
    if (!id || !currentUser || !originalTask.recurrence || originalTask.recurrence === 'none') return;

    try {
      console.log('Creating recurring task for:', originalTask.title, 'with recurrence:', originalTask.recurrence);
      
      // Calculate the new due date based on recurrence
      let newDueDate = new Date();
      if (originalTask.dueDate) {
        const originalDueDate = originalTask.dueDate.toDate ? originalTask.dueDate.toDate() : new Date(originalTask.dueDate);
        newDueDate = new Date(originalDueDate);
        
        if (originalTask.recurrence === 'daily') {
          newDueDate.setDate(newDueDate.getDate() + 1);
        } else if (originalTask.recurrence === 'weekly') {
          newDueDate.setDate(newDueDate.getDate() + 7);
        } else if (originalTask.recurrence === 'monthly') {
          newDueDate.setMonth(newDueDate.getMonth() + 1);
        }
      } else {
        // If no original due date, set based on recurrence
        if (originalTask.recurrence === 'daily') {
          newDueDate.setDate(newDueDate.getDate() + 1);
        } else if (originalTask.recurrence === 'weekly') {
          newDueDate.setDate(newDueDate.getDate() + 7);
        } else if (originalTask.recurrence === 'monthly') {
          newDueDate.setMonth(newDueDate.getMonth() + 1);
        }
      }

      // Create the new recurring task
      const recurringTaskDoc = await addDoc(collection(db, 'tasks'), {
        projectId: id,
        userId: currentUser.uid,
        title: originalTask.title,
        description: originalTask.description,
        dueDate: newDueDate,
        priority: originalTask.priority,
        recurrence: originalTask.recurrence,
        assignedTo: originalTask.assignedTo || null,
        completed: false,
        parentTaskId: originalTask.id, // Reference to the original task
        createdAt: serverTimestamp(),
      });

      console.log('Recurring task created with ID:', recurringTaskDoc.id);
      
      // Show notification about the new recurring task
      showTaskNotification(
        originalTask.title,
        `recurring task created (${originalTask.recurrence})`,
        projectName
      );
    } catch (error) {
      console.error('Error creating recurring task:', error);
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

  // Generate task completion report
  const generateTaskReport = () => {
    const stats = getTaskStats();
    const completedTasks = tasks.filter(task => task.completed);
    const incompleteTasks = tasks.filter(task => !task.completed);
    
    // Calculate additional metrics
    const overdueTasks = incompleteTasks.filter(task => {
      if (!task.dueDate) return false;
      try {
        const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        return dueDate < new Date();
      } catch {
        return false;
      }
    });

    const priorityBreakdown = {
      low: tasks.filter(task => task.priority === 'Low').length,
      medium: tasks.filter(task => task.priority === 'Medium').length,
      high: tasks.filter(task => task.priority === 'High').length,
      urgent: tasks.filter(task => task.priority === 'Urgent').length,
    };

    const recurrenceBreakdown = {
      none: tasks.filter(task => !task.recurrence || task.recurrence === 'none').length,
      daily: tasks.filter(task => task.recurrence === 'daily').length,
      weekly: tasks.filter(task => task.recurrence === 'weekly').length,
      monthly: tasks.filter(task => task.recurrence === 'monthly').length,
    };

    const report = {
      projectName,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTasks: stats.total,
        completedTasks: stats.completed,
        incompleteTasks: stats.inProgress,
        completionPercentage: stats.progressPercentage,
        overdueTasks: overdueTasks.length,
      },
      priorityBreakdown,
      recurrenceBreakdown,
      completedTasks: completedTasks.map(task => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate ? (task.dueDate.toDate ? task.dueDate.toDate().toISOString() : new Date(task.dueDate).toISOString()) : null,
        completedAt: task.updatedAt ? (task.updatedAt.toDate ? task.updatedAt.toDate().toISOString() : new Date(task.updatedAt).toISOString()) : null,
        recurrence: task.recurrence || 'none',
      })),
      incompleteTasks: incompleteTasks.map(task => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate ? (task.dueDate.toDate ? task.dueDate.toDate().toISOString() : new Date(task.dueDate).toISOString()) : null,
        isOverdue: overdueTasks.includes(task),
        recurrence: task.recurrence || 'none',
      })),
    };

    setReportData(report);
    setShowReport(true);
  };

  // Export report as CSV
  const exportToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      // Header
      ['Project Task Completion Report', ''],
      ['Project Name', reportData.projectName],
      ['Generated At', new Date(reportData.generatedAt).toLocaleString()],
      [''],
      ['Summary', ''],
      ['Total Tasks', reportData.summary.totalTasks],
      ['Completed Tasks', reportData.summary.completedTasks],
      ['Incomplete Tasks', reportData.summary.incompleteTasks],
      ['Completion Percentage', `${reportData.summary.completionPercentage}%`],
      ['Overdue Tasks', reportData.summary.overdueTasks],
      [''],
      ['Priority Breakdown', ''],
      ['Low Priority', reportData.priorityBreakdown.low],
      ['Medium Priority', reportData.priorityBreakdown.medium],
      ['High Priority', reportData.priorityBreakdown.high],
      ['Urgent Priority', reportData.priorityBreakdown.urgent],
      [''],
      ['Recurrence Breakdown', ''],
      ['None', reportData.recurrenceBreakdown.none],
      ['Daily', reportData.recurrenceBreakdown.daily],
      ['Weekly', reportData.recurrenceBreakdown.weekly],
      ['Monthly', reportData.recurrenceBreakdown.monthly],
      [''],
      ['Completed Tasks', ''],
      ['Title', 'Description', 'Priority', 'Assigned To', 'Due Date', 'Completed At', 'Recurrence'],
      ...reportData.completedTasks.map((task: any) => [
        task.title,
        task.description || '',
        task.priority,
        task.assignedTo || 'Unassigned',
        task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
        task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Unknown',
        task.recurrence,
      ]),
      [''],
      ['Incomplete Tasks', ''],
      ['Title', 'Description', 'Priority', 'Assigned To', 'Due Date', 'Is Overdue', 'Recurrence'],
      ...reportData.incompleteTasks.map((task: any) => [
        task.title,
        task.description || '',
        task.priority,
        task.assignedTo || 'Unassigned',
        task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
        task.isOverdue ? 'Yes' : 'No',
        task.recurrence,
      ]),
    ].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_task_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export report as PDF (simple text-based PDF)
  const exportToPDF = () => {
    if (!reportData) return;

    const pdfContent = `
Project Task Completion Report
============================

Project: ${reportData.projectName}
Generated: ${new Date(reportData.generatedAt).toLocaleString()}

SUMMARY
-------
Total Tasks: ${reportData.summary.totalTasks}
Completed Tasks: ${reportData.summary.completedTasks}
Incomplete Tasks: ${reportData.summary.incompleteTasks}
Completion Percentage: ${reportData.summary.completionPercentage}%
Overdue Tasks: ${reportData.summary.overdueTasks}

PRIORITY BREAKDOWN
------------------
Low Priority: ${reportData.priorityBreakdown.low}
Medium Priority: ${reportData.priorityBreakdown.medium}
High Priority: ${reportData.priorityBreakdown.high}
Urgent Priority: ${reportData.priorityBreakdown.urgent}

RECURRENCE BREAKDOWN
--------------------
None: ${reportData.recurrenceBreakdown.none}
Daily: ${reportData.recurrenceBreakdown.daily}
Weekly: ${reportData.recurrenceBreakdown.weekly}
Monthly: ${reportData.recurrenceBreakdown.monthly}

COMPLETED TASKS
---------------
${reportData.completedTasks.map((task: any) => 
  `• ${task.title} (${task.priority}) - ${task.assignedTo || 'Unassigned'} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}`
).join('\n')}

INCOMPLETE TASKS
----------------
${reportData.incompleteTasks.map((task: any) => 
  `• ${task.title} (${task.priority}) - ${task.assignedTo || 'Unassigned'} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}${task.isOverdue ? ' - OVERDUE' : ''}`
).join('\n')}
    `.trim();

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_task_report_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter tasks based on current filter
  const getFilteredTasks = () => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter(task => taskFilter === 'completed' ? task.completed : !task.completed);
  };

  // Financial management functions
  const handleUpdateFinancials = async () => {
    if (!id || !currentUser) return;

    setSubmittingFinancial(true);
    try {
      await updateDoc(doc(db, 'projects', id), {
        budget: budget,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        updatedAt: serverTimestamp(),
      });

      setShowFinancialForm(false);
      showProjectNotification('Financial information updated successfully', projectName);
    } catch (error) {
      console.error('Error updating financial information:', error);
    } finally {
      setSubmittingFinancial(false);
    }
  };

  const generateFinancialReport = () => {
    const variance = budget - actualCost;
    const variancePercentage = budget > 0 ? ((variance / budget) * 100) : 0;
    const isOverBudget = actualCost > budget;

    const report = {
      projectName,
      generatedAt: new Date().toISOString(),
      budget,
      actualCost,
      variance,
      variancePercentage: Math.round(variancePercentage * 100) / 100,
      isOverBudget,
      startDate: startDate ? new Date(startDate).toLocaleDateString() : 'Not set',
      endDate: endDate ? new Date(endDate).toLocaleDateString() : 'Not set',
      remainingBudget: Math.max(0, budget - actualCost),
      budgetUtilization: budget > 0 ? Math.round((actualCost / budget) * 100) : 0,
    };

    setReportData(report);
    setShowFinancialReport(true);
  };

  const exportFinancialToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      ['Project Financial Report', ''],
      ['Project Name', reportData.projectName],
      ['Generated At', new Date(reportData.generatedAt).toLocaleString()],
      [''],
      ['Financial Summary', ''],
      ['Budget', `$${reportData.budget.toLocaleString()}`],
      ['Actual Cost', `$${reportData.actualCost.toLocaleString()}`],
      ['Variance', `$${reportData.variance.toLocaleString()}`],
      ['Variance Percentage', `${reportData.variancePercentage}%`],
      ['Remaining Budget', `$${reportData.remainingBudget.toLocaleString()}`],
      ['Budget Utilization', `${reportData.budgetUtilization}%`],
      ['Status', reportData.isOverBudget ? 'Over Budget' : 'Within Budget'],
      [''],
      ['Project Timeline', ''],
      ['Start Date', reportData.startDate],
      ['End Date', reportData.endDate],
    ].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFinancialToPDF = () => {
    if (!reportData) return;

    const pdfContent = `
Project Financial Report
======================

Project: ${reportData.projectName}
Generated: ${new Date(reportData.generatedAt).toLocaleString()}

FINANCIAL SUMMARY
-----------------
Budget: $${reportData.budget.toLocaleString()}
Actual Cost: $${reportData.actualCost.toLocaleString()}
Variance: $${reportData.variance.toLocaleString()} (${reportData.variancePercentage}%)
Remaining Budget: $${reportData.remainingBudget.toLocaleString()}
Budget Utilization: ${reportData.budgetUtilization}%
Status: ${reportData.isOverBudget ? 'OVER BUDGET' : 'Within Budget'}

PROJECT TIMELINE
----------------
Start Date: ${reportData.startDate}
End Date: ${reportData.endDate}

ANALYSIS
--------
${reportData.isOverBudget 
  ? `⚠️  WARNING: Project is over budget by $${Math.abs(reportData.variance).toLocaleString()} (${Math.abs(reportData.variancePercentage)}%)`
  : `✅ Project is within budget with $${reportData.remainingBudget.toLocaleString()} remaining`
}
    `.trim();

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_financial_report_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Expense management functions
  const handleAddExpense = async () => {
    if (!id || !currentUser || !newExpenseDescription.trim() || newExpenseAmount <= 0) return;

    setSubmittingExpense(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        projectId: id,
        category: newExpenseCategory,
        description: newExpenseDescription.trim(),
        amount: newExpenseAmount,
        date: newExpenseDate ? new Date(newExpenseDate) : new Date(),
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Unknown User',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Reset form
      setNewExpenseCategory('materials');
      setNewExpenseDescription('');
      setNewExpenseAmount(0);
      setNewExpenseDate('');
      setShowExpenseForm(false);
      
      showProjectNotification('Expense added successfully', projectName);
    } catch (error) {
      console.error('Error adding expense:', error);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!id || !currentUser) return;

    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      showProjectNotification('Expense deleted successfully', projectName);
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const getExpenseCategoryColor = (category: string) => {
    const colors = {
      materials: 'bg-blue-100 text-blue-800 border-blue-200',
      labor: 'bg-green-100 text-green-800 border-green-200',
      equipment: 'bg-orange-100 text-orange-800 border-orange-200',
      permits: 'bg-purple-100 text-purple-800 border-purple-200',
      utilities: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      other: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const getExpenseCategoryIcon = (category: string) => {
    const icons = {
      materials: '🔨',
      labor: '👷',
      equipment: '🚜',
      permits: '📋',
      utilities: '⚡',
      other: '💰',
    };
    return icons[category as keyof typeof icons] || icons.other;
  };

  const getFilteredExpenses = () => {
    if (expenseFilter === 'all') return expenses;
    return expenses.filter(expense => expense.category === expenseFilter);
  };

  const getExpensesByCategory = () => {
    const categories = ['materials', 'labor', 'equipment', 'permits', 'utilities', 'other'];
    return categories.map(category => {
      const categoryExpenses = expenses.filter(expense => expense.category === category);
      const total = categoryExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
      return {
        category,
        count: categoryExpenses.length,
        total,
        percentage: actualCost > 0 ? (total / actualCost) * 100 : 0
      };
    }).filter(item => item.count > 0);
  };

  // Submit a new comment
  const handleSubmitComment = async (taskId: string) => {
    if (!currentUser || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      console.log('Submitting comment for task:', taskId);
      await addDoc(collection(db, 'comments'), {
        taskId: taskId,
        comment: newComment.trim(),
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
      });

      console.log('Comment submitted successfully');
      
      // Clear form
      setNewComment('');
      setCommentingTaskId(null);
      
      // Refresh comments
      await loadComments();
      
      // Show notification
      const task = tasks.find(t => t.id === taskId);
      if (task && currentUser) {
        showCommentNotification(
          currentUser.displayName || currentUser.email || 'Someone',
          task.title
        );
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Get comments for a specific task
  const getTaskComments = (taskId: string) => {
    return comments.filter(comment => comment.taskId === taskId);
  };

  // Submit a reply to a comment
  const handleSubmitReply = async (commentId: string, taskId: string) => {
    if (!currentUser || !newReply.trim()) return;

    setSubmittingReply(true);
    try {
      console.log('Submitting reply for comment:', commentId);
      await addDoc(collection(db, 'comments'), {
        taskId: taskId,
        comment: newReply.trim(),
        userId: currentUser.uid,
        parentCommentId: commentId,
        timestamp: serverTimestamp(),
      });

      console.log('Reply submitted successfully');
      
      // Clear form
      setNewReply('');
      setReplyingToCommentId(null);
      
      // Refresh comments
      await loadComments();
      
      // Show notification
      const task = tasks.find(t => t.id === taskId);
      if (task && currentUser) {
        showCommentNotification(
          currentUser.displayName || currentUser.email || 'Someone',
          task.title
        );
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handlePhaseChange = async (newPhase: Phase) => {
    console.log('handlePhaseChange called:', { newPhase, projectName, fcmToken });
    if (!id) return;
    const oldPhase = phase;
    setPhase(newPhase);
    await updateDoc(doc(db, 'projects', id), { phase: newPhase, updatedAt: serverTimestamp() });
    
    // Email notifications disabled - using push notifications only
    // try {
    //   await sendPhaseUpdateEmails({
    //     name: projectName,
    //     phase: newPhase
    //   }, oldPhase, companyId || '');
    //   console.log('ProjectPage: Phase update email notifications sent');
    // } catch (emailError) {
    //   console.error('ProjectPage: Error sending phase update emails:', emailError);
    // }
    
    // Show notification
    console.log('Calling showProjectNotification...');
    showProjectNotification(projectName, `moved to ${newPhase} phase`);
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

  // Photo management functions
  const loadPhotos = async () => {
    if (!id) {
      console.log('No project ID available for loading photos');
      setPhotosLoading(false);
      return;
    }
    
    try {
      console.log('Loading photos for project:', id);
      setPhotosLoading(true);
      const photosRef = ref(storage, `projects/${id}/photos`);
      console.log('Photos ref:', photosRef.fullPath);
      
      const result = await listAll(photosRef);
      console.log('Found', result.items.length, 'photos');
      
      const photosData: ProjectPhoto[] = [];
      for (const itemRef of result.items) {
        try {
          console.log('Loading photo:', itemRef.name);
          const url = await getDownloadURL(itemRef);
          const metadata = await getMetadata(itemRef);
          photosData.push({
            id: itemRef.name,
            url,
            name: metadata.name,
            uploadedBy: metadata.customMetadata?.uploadedBy || 'Unknown',
            uploadedAt: metadata.timeCreated,
            size: metadata.size
          });
          console.log('Successfully loaded photo:', itemRef.name);
        } catch (error) {
          console.error('Error loading photo metadata for', itemRef.name, ':', error);
        }
      }
      
      // Sort by upload date (newest first)
      photosData.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      setPhotos(photosData);
      console.log('Photos loaded successfully:', photosData.length);
    } catch (error) {
      console.error('Error loading photos:', error);
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id || !currentUser) {
      console.log('No files selected or missing project ID/user');
      return;
    }

    console.log('Starting photo upload for', files.length, 'files');
    setUploadingPhoto(true);
    
    // Test Firebase Storage connection first (with timeout)
    console.log('Testing Firebase Storage connection...');
    try {
      const connectionOk = await Promise.race([
        testStorageConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection test timeout')), 15000)
        )
      ]);
      
      if (!connectionOk) {
        console.warn('Firebase Storage connection test failed, but proceeding with upload...');
      } else {
        console.log('Firebase Storage connection test successful');
      }
    } catch (error) {
      console.warn('Firebase Storage connection test failed, but proceeding with upload:', error);
    }
    
    // Add overall timeout protection
    const uploadTimeout = setTimeout(() => {
      console.error('Overall upload timeout - stopping upload process');
      setUploadingPhoto(false);
      setShowPhotoUpload(false);
      alert('Upload timed out. Please check your internet connection and try again.');
    }, 60000); // 60 second overall timeout
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const fileArray = Array.from(files);
      
      // Validate files first
      console.log('Total files selected:', fileArray.length);
      const validationErrors: string[] = [];
      const validFiles = fileArray.filter(file => {
        const fileSizeMB = file.size / (1024 * 1024);
        const maxSizeMB = 10;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        console.log('Validating file:', {
          name: file.name,
          type: file.type,
          sizeBytes: file.size,
          sizeMB: fileSizeMB.toFixed(2),
          maxSizeMB: maxSizeMB,
          maxSizeBytes: maxSizeBytes,
          isImage: file.type.startsWith('image/'),
          isWithinSizeLimit: file.size <= maxSizeBytes
        });
        
        if (!file.type.startsWith('image/')) {
          console.error('Invalid file type:', file.type);
          validationErrors.push(`${file.name} is not an image file (type: ${file.type})`);
          return false;
        }
        
        if (file.size > maxSizeBytes) {
          console.error('File too large:', {
            actualSize: file.size,
            actualSizeMB: fileSizeMB.toFixed(2),
            maxSize: maxSizeBytes,
            maxSizeMB: maxSizeMB
          });
          validationErrors.push(`${file.name} is too large (${fileSizeMB.toFixed(2)}MB). Maximum size is ${maxSizeMB}MB.`);
          return false;
        }
        
        // Temporary: Allow larger files for debugging
        if (file.size > 50 * 1024 * 1024) { // 50MB limit for debugging
          console.warn('File is very large, but allowing for debugging:', fileSizeMB.toFixed(2), 'MB');
        }
        
        console.log('File is valid:', file.name);
        return true;
      });
      
      console.log('Valid files after filtering:', validFiles.length);
      
      // Show validation errors if any
      if (validationErrors.length > 0) {
        const errorMessage = `Please fix the following issues:\n\n${validationErrors.join('\n')}\n\nNote: File sizes are shown in MB (1MB = 1,048,576 bytes)`;
        alert(errorMessage);
        errorCount += validationErrors.length;
      }
      
      // Set initial progress with valid files only
      setUploadProgress({current: 0, total: validFiles.length});
      
      if (validFiles.length === 0) {
        console.log('No valid files to upload');
        setUploadingPhoto(false);
        setShowPhotoUpload(false);
        setUploadProgress({current: 0, total: 0});
        return;
      }
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        // Update progress
        setUploadProgress({current: i, total: validFiles.length});
        
        try {
          // Create unique filename
          const timestamp = Date.now();
          const fileName = `${timestamp}_${file.name}`;
          const photoRef = ref(storage, `projects/${id}/photos/${fileName}`);
          console.log('Uploading to:', photoRef.fullPath);
          console.log('File details for upload:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          });
          
          // Add individual file timeout
          const uploadPromise = uploadBytes(photoRef, file, {
            customMetadata: {
              uploadedBy: currentUser.uid,
              uploadedAt: new Date().toISOString()
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Upload timeout for ${file.name}`)), 120000) // 2 minutes
          );
          
          console.log('Starting upload for:', file.name, `(${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
          
          // Add upload progress monitoring
          const startTime = Date.now();
          const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            console.log(`Upload in progress for ${file.name}: ${Math.round(elapsed / 1000)}s elapsed`);
          }, 10000); // Log every 10 seconds
          
          try {
            // Race between upload and timeout
            const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
            clearInterval(progressInterval);
            const uploadTime = Date.now() - startTime;
            console.log('Upload successful for:', file.name, `in ${Math.round(uploadTime / 1000)}s`, 'Snapshot:', snapshot);
            successCount++;
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        } catch (uploadError: any) {
          console.error('Upload failed for', file.name, ':', uploadError);
          console.error('Upload error details:', {
            message: uploadError.message,
            code: uploadError.code,
            stack: uploadError.stack
          });
          if (uploadError.message.includes('timeout')) {
            alert(`Upload timed out for ${file.name}. Please try again with a smaller file.`);
          } else {
            alert(`Upload failed for ${file.name}: ${uploadError.message}`);
          }
          errorCount++;
        }
        
        // Update progress after each file
        setUploadProgress({current: i + 1, total: validFiles.length});
      }
      
      console.log('Upload complete. Success:', successCount, 'Errors:', errorCount);
      
      // Reload photos
      await loadPhotos();
      
      if (successCount > 0) {
        showProjectNotification(`${successCount} photo(s) uploaded successfully`, projectName);
      }
      if (errorCount > 0) {
        alert(`${errorCount} file(s) failed to upload. Please check the console for details.`);
      }
    } catch (error: any) {
      console.error('Error uploading photos:', error);
      alert(`Failed to upload photos: ${error.message || 'Unknown error'}`);
    } finally {
      clearTimeout(uploadTimeout);
      setUploadingPhoto(false);
      setShowPhotoUpload(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!id || !currentUser) return;
    
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
      const photoRef = ref(storage, `projects/${id}/photos/${photoId}`);
      await deleteObject(photoRef);
      
      // Reload photos
      await loadPhotos();
      showProjectNotification('Photo deleted successfully', projectName);
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Test Firebase Storage connection
  const testStorageConnection = async () => {
    try {
      console.log('Testing Firebase Storage connection...');
      const testRef = ref(storage, 'test/connection-test.txt');
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      
      // Add timeout to connection test
      const uploadPromise = uploadBytes(testRef, testBlob);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 10000)
      );
      
      await Promise.race([uploadPromise, timeoutPromise]);
      console.log('Firebase Storage connection test successful');
      // Clean up test file
      await deleteObject(testRef);
      return true;
    } catch (error) {
      console.error('Firebase Storage connection test failed:', error);
      return false;
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
    <Layout title={projectName} currentRole={undefined}>
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

        {/* Financial Tracking Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
            <h3 className="text-lg font-semibold text-gray-900">Financial Tracking</h3>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <button
                onClick={() => setShowExpenseForm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Expense</span>
              </button>
              <button
                onClick={() => setShowFinancialForm(true)}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Update Budget</span>
              </button>
              <button
                onClick={generateFinancialReport}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Financial Report</span>
              </button>
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600">${budget.toLocaleString()}</div>
              <div className="text-sm text-blue-800">Total Budget</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-orange-600">${actualCost.toLocaleString()}</div>
              <div className="text-sm text-orange-800">Actual Cost</div>
            </div>
            <div className={`rounded-xl p-4 ${(budget - actualCost) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${(budget - actualCost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(budget - actualCost).toLocaleString()}
              </div>
              <div className={`text-sm ${(budget - actualCost) >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {budget >= actualCost ? 'Remaining' : 'Over Budget'}
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-600">
                {budget > 0 ? Math.round((actualCost / budget) * 100) : 0}%
              </div>
              <div className="text-sm text-purple-800">Budget Used</div>
            </div>
          </div>

          {/* Budget vs Actual Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
              <span className="text-sm font-bold text-gray-900">
                {budget > 0 ? Math.round((actualCost / budget) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  actualCost > budget 
                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                    : 'bg-gradient-to-r from-blue-500 to-green-500'
                }`}
                style={{ 
                  width: `${budget > 0 ? Math.min((actualCost / budget) * 100, 100) : 0}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>$0</span>
              <span>${budget.toLocaleString()}</span>
            </div>
          </div>

          {/* Project Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Project Timeline</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Start Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {startDate ? new Date(startDate).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">End Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {endDate ? new Date(endDate).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Financial Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`text-sm font-medium ${budget >= actualCost ? 'text-green-600' : 'text-red-600'}`}>
                    {budget >= actualCost ? 'Within Budget' : 'Over Budget'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Variance:</span>
                  <span className={`text-sm font-medium ${budget >= actualCost ? 'text-green-600' : 'text-red-600'}`}>
                    {budget >= actualCost ? '+' : '-'}${Math.abs(budget - actualCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Expenses ({expenses.length})</h4>
              {expenses.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Filter by category:</span>
                  <select
                    value={expenseFilter}
                    onChange={(e) => setExpenseFilter(e.target.value as any)}
                    className="px-3 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    <option value="materials">Materials</option>
                    <option value="labor">Labor</option>
                    <option value="equipment">Equipment</option>
                    <option value="permits">Permits</option>
                    <option value="utilities">Utilities</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
            </div>

            {expensesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <p className="text-gray-500 mb-4">No expenses recorded yet</p>
                <button
                  onClick={() => setShowExpenseForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add First Expense
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {getFilteredExpenses().map((expense) => (
                  <div key={expense.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getExpenseCategoryIcon(expense.category)}</div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="text-sm font-medium text-gray-900">{expense.description}</h5>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getExpenseCategoryColor(expense.category)}`}>
                              {expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>${expense.amount.toLocaleString()}</span>
                            <span>{expense.date ? new Date(expense.date.toDate ? expense.date.toDate() : expense.date).toLocaleDateString() : 'No date'}</span>
                            <span>by {expense.userName || 'Unknown User'}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete expense"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expense Categories Breakdown */}
            {expenses.length > 0 && (
              <div className="mt-6">
                <h5 className="text-sm font-semibold text-gray-900 mb-3">Expenses by Category</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {getExpensesByCategory().map((category) => (
                    <div key={category.category} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getExpenseCategoryIcon(category.category)}</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">{category.category}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">${category.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{category.count} expense{category.count !== 1 ? 's' : ''}</span>
                        <span>{category.percentage.toFixed(1)}% of total</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${category.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
            {['Photos','Staff','Feedback','Tasks'].map(t => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t as any)} 
                className={`px-3 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation min-h-[48px] flex items-center justify-center ${activeTab===t?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t}
              </button>
            ))}
            {permissions?.canViewDailyReports && (
              <button 
                onClick={() => setActiveTab('Daily Reports')} 
                className={`px-3 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation min-h-[48px] flex items-center justify-center col-span-2 sm:col-span-1 ${activeTab==='Daily Reports'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Daily Reports
              </button>
            )}
          </div>

          {activeTab === 'Photos' && (
            <div>
              {/* Photo Upload Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Project Photos</h3>
                  <button
                    onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 min-h-[44px] touch-manipulation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Upload Photos</span>
                  </button>
                </div>

                {showPhotoUpload && (
                  <div className="bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      {PHOTO_UPLOAD_ENABLED ? (
                        <>
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="mt-4">
                            <label htmlFor="photo-upload" className="cursor-pointer">
                              <span className="mt-2 block text-sm font-medium text-gray-900">
                                {uploadingPhoto ? 'Uploading...' : 'Click to upload photos'}
                              </span>
                              <span className="mt-1 block text-xs text-gray-500">
                                PNG, JPG, GIF up to 10MB each
                              </span>
                            </label>
                            <input
                              id="photo-upload"
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              disabled={uploadingPhoto}
                              className="hidden"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 mx-auto mb-3 bg-yellow-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-900 mb-2">
                              Photo upload temporarily disabled
                            </p>
                            <p className="text-xs text-gray-500 mb-4">
                              We're working with Firebase support to resolve storage issues. This feature will be available soon!
                            </p>
                            <button
                              onClick={() => setShowPhotoUpload(false)}
                              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                      {uploadingPhoto && (
                        <div className="mt-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          {uploadProgress.total > 0 ? (
                            <>
                              <p className="text-sm text-gray-600">
                                Uploading {uploadProgress.current} of {uploadProgress.total} files...
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Large files may take several minutes to upload
                              </p>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                ></div>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-600">
                              Preparing upload...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                )}
              </div>

              {/* Photos Grid */}
              {photosLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 text-sm">Loading photos...</p>
                  <p className="text-gray-400 text-xs mt-2">This may take a moment for the first time</p>
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📸</div>
                  <p className="text-gray-500 text-sm">No photos uploaded yet</p>
                  <p className="text-gray-400 text-xs">Upload photos to document your project progress</p>
                  <button
                    onClick={() => setShowPhotoUpload(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload Your First Photo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      
                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                          <button
                            onClick={() => window.open(photo.url, '_blank')}
                            className="p-2 bg-white bg-opacity-90 rounded-full hover:bg-opacity-100 transition-colors"
                            title="View full size"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-2 bg-red-500 bg-opacity-90 rounded-full hover:bg-opacity-100 transition-colors"
                            title="Delete photo"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Photo info */}
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-900 truncate" title={photo.name}>
                          {photo.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">
                            {formatFileSize(photo.size)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(photo.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                        <div>
                          <label className="block text-sm font-medium text-blue-900 mb-2">Recurrence</label>
                          <select
                            value={newTaskRecurrence}
                            onChange={(e) => setNewTaskRecurrence(e.target.value as any)}
                            className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="none">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
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
                            setNewTaskRecurrence('none');
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
                      <button
                        onClick={generateTaskReport}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Report</span>
                      </button>
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
                                {task.recurrence && task.recurrence !== 'none' && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                    🔄 {task.recurrence === 'daily' ? 'Daily' : task.recurrence === 'weekly' ? 'Weekly' : 'Monthly'}
                                  </span>
                                )}
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

                          {/* Comments Section */}
                          <div className="mt-4 border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-medium text-gray-700">
                                Comments ({getTaskComments(task.id).length})
                              </h5>
                              <button
                                onClick={() => setCommentingTaskId(commentingTaskId === task.id ? null : task.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                {commentingTaskId === task.id ? 'Cancel' : 'Add Comment'}
                              </button>
                            </div>

                            {/* Comments List */}
                            {getTaskComments(task.id).length > 0 && (
                              <div className="space-y-4 mb-4">
                                {getTaskComments(task.id).map((comment) => (
                                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                                    {/* Main Comment */}
                                    <div className="flex items-start justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {comment.userName || 'Unknown User'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {comment.timestamp?.toDate ? 
                                          comment.timestamp.toDate().toLocaleDateString() + ' ' + 
                                          comment.timestamp.toDate().toLocaleTimeString() :
                                          'Unknown time'
                                        }
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                      {comment.comment}
                                    </p>
                                    
                                    {/* Reply Button */}
                                    <button
                                      onClick={() => setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id)}
                                      className="text-xs text-blue-600 hover:text-blue-700 font-medium mb-3"
                                    >
                                      {replyingToCommentId === comment.id ? 'Cancel Reply' : `Reply (${comment.replies?.length || 0})`}
                                    </button>

                                    {/* Replies */}
                                    {comment.replies && comment.replies.length > 0 && (
                                      <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                                        {comment.replies.map((reply) => (
                                          <div key={reply.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="flex items-start justify-between mb-1">
                                              <span className="text-xs font-medium text-gray-800">
                                                {reply.userName || 'Unknown User'}
                                              </span>
                                              <span className="text-xs text-gray-400">
                                                {reply.timestamp?.toDate ? 
                                                  reply.timestamp.toDate().toLocaleDateString() + ' ' + 
                                                  reply.timestamp.toDate().toLocaleTimeString() :
                                                  'Unknown time'
                                                }
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                              {reply.comment}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Reply Form */}
                                    {replyingToCommentId === comment.id && (
                                      <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                                        <textarea
                                          value={newReply}
                                          onChange={(e) => setNewReply(e.target.value)}
                                          placeholder="Write a reply..."
                                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none mb-2"
                                          rows={2}
                                        />
                                        <div className="flex items-center justify-end space-x-2">
                                          <button
                                            onClick={() => {
                                              setReplyingToCommentId(null);
                                              setNewReply('');
                                            }}
                                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 font-medium"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleSubmitReply(comment.id, task.id)}
                                            disabled={submittingReply || !newReply.trim()}
                                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                          >
                                            {submittingReply ? 'Posting...' : 'Post Reply'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add Comment Form */}
                            {commentingTaskId === task.id && (
                              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <textarea
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="Write a comment..."
                                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none mb-3"
                                  rows={3}
                                />
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => {
                                      setCommentingTaskId(null);
                                      setNewComment('');
                                    }}
                                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 font-medium"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSubmitComment(task.id)}
                                    disabled={submittingComment || !newComment.trim()}
                                    className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {submittingComment ? 'Posting...' : 'Post Comment'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Daily Reports' && permissions?.canViewDailyReports && (
            <div>
              {showDailyReportForm ? (
                <DailyReportForm
                  projectId={id!}
                  existingReport={editingDailyReport || undefined}
                  projectTasks={tasks.map(task => ({
                    id: task.id,
                    title: task.title,
                    status: task.status
                  }))}
                  onSave={(report) => {
                    console.log('Daily report saved:', report);
                    setShowDailyReportForm(false);
                    setEditingDailyReport(null);
                  }}
                  onCancel={() => {
                    setShowDailyReportForm(false);
                    setEditingDailyReport(null);
                  }}
                />
              ) : (
                <DailyReportList
                  projectId={id!}
                  onEditReport={(report) => {
                    setEditingDailyReport(report);
                    setShowDailyReportForm(true);
                  }}
                  onCreateReport={() => {
                    setEditingDailyReport(null);
                    setShowDailyReportForm(true);
                  }}
                  canCreate={permissions?.canCreateDailyReports || false}
                  canEdit={permissions?.canManageDailyReports || false}
                  canDelete={permissions?.canManageDailyReports || false}
                  canApprove={permissions?.canApproveDailyReports || false}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      {activeTab === 'Staff' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-3 sm:p-4 pb-safe shadow-lg">
          <div className="flex flex-col sm:flex-row gap-3">
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

      {/* Task Completion Report Modal */}
      {showReport && reportData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Task Completion Report</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={exportToPDF}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Project Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{reportData.projectName}</h3>
                <p className="text-sm text-gray-500">
                  Generated on {new Date(reportData.generatedAt).toLocaleString()}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-600">{reportData.summary.totalTasks}</div>
                  <div className="text-sm text-blue-800">Total Tasks</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-600">{reportData.summary.completedTasks}</div>
                  <div className="text-sm text-green-800">Completed</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-orange-600">{reportData.summary.incompleteTasks}</div>
                  <div className="text-sm text-orange-800">In Progress</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-red-600">{reportData.summary.overdueTasks}</div>
                  <div className="text-sm text-red-800">Overdue</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Completion Progress</span>
                  <span className="text-sm font-bold text-gray-900">{reportData.summary.completionPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${reportData.summary.completionPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Breakdown Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Priority Breakdown */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Priority Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Low</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(reportData.priorityBreakdown.low / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.priorityBreakdown.low}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Medium</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full"
                            style={{ width: `${(reportData.priorityBreakdown.medium / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.priorityBreakdown.medium}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">High</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${(reportData.priorityBreakdown.high / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.priorityBreakdown.high}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Urgent</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${(reportData.priorityBreakdown.urgent / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.priorityBreakdown.urgent}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recurrence Breakdown */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Recurrence Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">None</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gray-500 h-2 rounded-full"
                            style={{ width: `${(reportData.recurrenceBreakdown.none / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.recurrenceBreakdown.none}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Daily</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${(reportData.recurrenceBreakdown.daily / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.recurrenceBreakdown.daily}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Weekly</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(reportData.recurrenceBreakdown.weekly / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.recurrenceBreakdown.weekly}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Monthly</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${(reportData.recurrenceBreakdown.monthly / reportData.summary.totalTasks) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reportData.recurrenceBreakdown.monthly}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Completed Tasks */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Completed Tasks ({reportData.completedTasks.length})</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {reportData.completedTasks.map((task: any, index: number) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-green-900">{task.title}</span>
                          <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">{task.priority}</span>
                        </div>
                        <div className="text-xs text-green-700">
                          {task.assignedTo && <span>Assigned to: {task.assignedTo}</span>}
                          {task.dueDate && <span> • Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Incomplete Tasks */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Incomplete Tasks ({reportData.incompleteTasks.length})</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {reportData.incompleteTasks.map((task: any, index: number) => (
                      <div key={index} className={`border rounded-lg p-3 ${task.isOverdue ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${task.isOverdue ? 'text-red-900' : 'text-orange-900'}`}>{task.title}</span>
                          <div className="flex items-center space-x-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${task.isOverdue ? 'text-red-700 bg-red-100' : 'text-orange-700 bg-orange-100'}`}>{task.priority}</span>
                            {task.isOverdue && <span className="text-xs text-red-600 font-medium">OVERDUE</span>}
                          </div>
                        </div>
                        <div className={`text-xs ${task.isOverdue ? 'text-red-700' : 'text-orange-700'}`}>
                          {task.assignedTo && <span>Assigned to: {task.assignedTo}</span>}
                          {task.dueDate && <span> • Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Form Modal */}
      {showFinancialForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Update Budget & Timeline</h2>
              <button
                onClick={() => setShowFinancialForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Budget ($)</label>
                  <input
                    type="number"
                    value={budget || ''}
                    onChange={(e) => setBudget(Number(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Enter project budget"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-blue-800">
                      Actual costs are automatically calculated from your expenses. Add expenses using the "Add Expense" button.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowFinancialForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateFinancials}
                  disabled={submittingFinancial}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submittingFinancial && (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span>{submittingFinancial ? 'Updating...' : 'Update Financials'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add Expense</h2>
              <button
                onClick={() => setShowExpenseForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="materials">🔨 Materials</option>
                    <option value="labor">👷 Labor</option>
                    <option value="equipment">🚜 Equipment</option>
                    <option value="permits">📋 Permits</option>
                    <option value="utilities">⚡ Utilities</option>
                    <option value="other">💰 Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={newExpenseDescription}
                    onChange={(e) => setNewExpenseDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Enter expense description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount ($)</label>
                  <input
                    type="number"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Enter expense amount"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={newExpenseDate}
                    onChange={(e) => setNewExpenseDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowExpenseForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddExpense}
                  disabled={submittingExpense || !newExpenseDescription.trim() || newExpenseAmount <= 0}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submittingExpense && (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span>{submittingExpense ? 'Adding...' : 'Add Expense'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Report Modal */}
      {showFinancialReport && reportData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Financial Report</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportFinancialToCSV}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={exportFinancialToPDF}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setShowFinancialReport(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Project Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{reportData.projectName}</h3>
                <p className="text-sm text-gray-500">
                  Generated on {new Date(reportData.generatedAt).toLocaleString()}
                </p>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-600">${reportData.budget.toLocaleString()}</div>
                  <div className="text-sm text-blue-800">Total Budget</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-orange-600">${reportData.actualCost.toLocaleString()}</div>
                  <div className="text-sm text-orange-800">Actual Cost</div>
                </div>
                <div className={`rounded-xl p-4 ${reportData.isOverBudget ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-2xl font-bold ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(reportData.variance).toLocaleString()}
                  </div>
                  <div className={`text-sm ${reportData.isOverBudget ? 'text-red-800' : 'text-green-800'}`}>
                    {reportData.isOverBudget ? 'Over Budget' : 'Remaining'}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-600">{reportData.budgetUtilization}%</div>
                  <div className="text-sm text-purple-800">Budget Used</div>
                </div>
              </div>

              {/* Budget vs Actual Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
                  <span className="text-sm font-bold text-gray-900">{reportData.budgetUtilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      reportData.isOverBudget 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-blue-500 to-green-500'
                    }`}
                    style={{ width: `${Math.min(reportData.budgetUtilization, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$0</span>
                  <span>${reportData.budget.toLocaleString()}</span>
                </div>
              </div>

              {/* Financial Analysis */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Financial Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Budget Performance</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variance:</span>
                        <span className={`text-sm font-medium ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                          ${reportData.variance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variance %:</span>
                        <span className={`text-sm font-medium ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                          {reportData.variancePercentage}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className={`text-sm font-medium ${reportData.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                          {reportData.isOverBudget ? 'Over Budget' : 'Within Budget'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Project Timeline</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Start Date:</span>
                        <span className="text-sm font-medium text-gray-900">{reportData.startDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">End Date:</span>
                        <span className="text-sm font-medium text-gray-900">{reportData.endDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h5 className="text-sm font-semibold text-yellow-800 mb-2">Recommendations</h5>
                <p className="text-sm text-yellow-700">
                  {reportData.isOverBudget 
                    ? `⚠️ This project is over budget by $${Math.abs(reportData.variance).toLocaleString()}. Consider reviewing expenses and identifying cost-saving opportunities.`
                    : `✅ This project is within budget with $${reportData.remainingBudget.toLocaleString()} remaining. Continue monitoring costs to maintain budget compliance.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProjectPage;


