import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Project, Task, Activity, TeamMember } from './types';

// Projects Collection
export const projectsCollection = collection(db, 'projects');

export const createProject = async (project: Omit<Project, 'id'>) => {
  const docRef = await addDoc(projectsCollection, {
    ...project,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateProject = async (projectId: string, updates: Partial<Project>) => {
  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteProject = async (projectId: string) => {
  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);
};

export const getProject = async (projectId: string) => {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (projectSnap.exists()) {
    return { id: projectSnap.id, ...projectSnap.data() } as Project;
  }
  return null;
};

export const getProjects = async (userId?: string) => {
  let q = query(projectsCollection, orderBy('createdAt', 'desc'));
  
  if (userId) {
    q = query(projectsCollection, where('team', 'array-contains', userId), orderBy('createdAt', 'desc'));
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

// Create or update user doc helper
export const setUserCompany = async (userId: string, companyId: string) => {
  await setDoc(doc(db, 'users', userId), { companyId, updatedAt: serverTimestamp() }, { merge: true });
};

// Tasks Collection
export const tasksCollection = collection(db, 'tasks');

export const createTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(tasksCollection, {
    ...task,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateTask = async (taskId: string, updates: Partial<Task>) => {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTask = async (taskId: string) => {
  const taskRef = doc(db, 'tasks', taskId);
  await deleteDoc(taskRef);
};

export const getTasksByProject = async (projectId: string) => {
  const q = query(
    tasksCollection, 
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

// Activities Collection
export const activitiesCollection = collection(db, 'activities');

export const createActivity = async (activity: Omit<Activity, 'id' | 'timestamp'>) => {
  const docRef = await addDoc(activitiesCollection, {
    ...activity,
    timestamp: serverTimestamp(),
  });
  return docRef.id;
};

export const getRecentActivities = async (limitCount: number = 10) => {
  const q = query(
    activitiesCollection,
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
};

// Real-time subscriptions
export const subscribeToProjects = (userId: string, callback: (projects: Project[]) => void) => {
  const q = query(
    projectsCollection, 
    where('team', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    callback(projects);
  });
};

export const subscribeToTasks = (projectId: string, callback: (tasks: Task[]) => void) => {
  const q = query(
    tasksCollection,
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    callback(tasks);
  });
};

// Helper function to convert Firestore timestamps
export const convertTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

