import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  type User
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
// Define types directly here to avoid module resolution issues
interface AppUser {
  uid: string;
  name: string;
  email: string;
  profilePicture?: string;
  preferences: UserPreferences;
  createdAt?: any;
  updatedAt?: any;
}

// Pending user awaiting approval
interface PendingUser {
  id: string;
  email: string;
  name: string;
  requestedAt: any;
  approvedBy?: string;
  approvedAt?: any;
  status: 'pending' | 'approved' | 'rejected';
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  language: string;
}

export type UserRole = 'admin';

interface RolePermissions {
  canManageUsers: boolean;
  canManageProjects: boolean;
  canCreateProjects: boolean;
  canDeleteProjects: boolean;
  canManageCheckIns: boolean;
  canCreateCheckIns: boolean;
  canViewAllProjects: boolean;
  canViewProjectDetails: boolean;
  canManageFeedback: boolean;
  canCreateFeedback: boolean;
  canViewFeedback: boolean;
  canManageCompany: boolean;
  canManageDailyReports: boolean;
  canCreateDailyReports: boolean;
  canViewDailyReports: boolean;
  canApproveDailyReports: boolean;
}

// All users are admins with full permissions
export const getRolePermissions = (): RolePermissions => {
  return {
    canManageUsers: true,
    canManageProjects: true,
    canCreateProjects: true,
    canDeleteProjects: true,
    canManageCheckIns: true,
    canCreateCheckIns: true,
    canViewAllProjects: true,
    canViewProjectDetails: true,
    canManageFeedback: true,
    canCreateFeedback: true,
    canViewFeedback: true,
    canManageCompany: true,
    canManageDailyReports: true,
    canCreateDailyReports: true,
    canViewDailyReports: true,
    canApproveDailyReports: true,
  };
};

interface AuthContextType {
  currentUser: User | null;
  userProfile: AppUser | null;
  permissions: RolePermissions | null;
  loading: boolean;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateUserProfile: (updatedProfile: Partial<AppUser>) => Promise<void>;
  approvePendingUser: (pendingUserId: string) => Promise<void>;
  rejectPendingUser: (pendingUserId: string) => Promise<void>;
  getPendingUsers: () => Promise<PendingUser[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string, displayName?: string) => {
    try {
      // Check if this is the first user in the system (becomes admin immediately)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnapshot.empty;
      
      if (isFirstUser) {
        // First user becomes admin immediately
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        
        if (displayName) {
          await updateProfile(user, { displayName });
        }
        
        const userData: AppUser = {
          uid: user.uid,
          name: user.displayName || displayName || user.email?.split('@')[0] || 'User',
          email: user.email!,
          preferences: {
            theme: 'system',
            notifications: {
              email: true,
              push: true,
              sms: false,
            },
            language: 'en',
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
      } else {
        // Subsequent users go to pending approval
        const pendingUserData: PendingUser = {
          id: email, // Use email as ID for simplicity
          email,
          name: displayName || email.split('@')[0],
          requestedAt: serverTimestamp(),
          status: 'pending',
        };
        
        await setDoc(doc(db, 'pendingUsers', email), pendingUserData);
        
        // Sign out the user since they're not approved yet
        await signOut(auth);
        
        throw new Error('PENDING_APPROVAL');
      }
    } catch (error) {
      console.error('Signup: Error during signup process', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login: Error during login process', error);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };




  // Pending user management functions
  const getPendingUsers = async (): Promise<PendingUser[]> => {
    try {
      const pendingUsersSnapshot = await getDocs(collection(db, 'pendingUsers'));
      return pendingUsersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingUser));
    } catch (error) {
      console.error('Error getting pending users:', error);
      throw error;
    }
  };

  const approvePendingUser = async (pendingUserId: string) => {
    try {
      if (!currentUser) throw new Error('User must be logged in to approve users');
      
      // Get pending user data
      const pendingUserDoc = await getDoc(doc(db, 'pendingUsers', pendingUserId));
      if (!pendingUserDoc.exists()) {
        throw new Error('Pending user not found');
      }
      
      const pendingUserData = pendingUserDoc.data() as PendingUser;
      
      // Create user account
      const { user } = await createUserWithEmailAndPassword(auth, pendingUserData.email, 'tempPassword123!');
      
      // Update user profile
      await updateProfile(user, { displayName: pendingUserData.name });
      
      // Create user document
      const userData: AppUser = {
        uid: user.uid,
        name: pendingUserData.name,
        email: pendingUserData.email,
        preferences: {
          theme: 'system',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
          language: 'en',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
      
      // Update pending user status
      await updateDoc(doc(db, 'pendingUsers', pendingUserId), {
        status: 'approved',
        approvedBy: currentUser.uid,
        approvedAt: serverTimestamp(),
      });
      
      // Sign out the temporary user
      await signOut(auth);
      
    } catch (error) {
      console.error('Error approving pending user:', error);
      throw error;
    }
  };

  const rejectPendingUser = async (pendingUserId: string) => {
    try {
      if (!currentUser) throw new Error('User must be logged in to reject users');
      
      // Update pending user status
      await updateDoc(doc(db, 'pendingUsers', pendingUserId), {
        status: 'rejected',
        approvedBy: currentUser.uid,
        approvedAt: serverTimestamp(),
      });
      
    } catch (error) {
      console.error('Error rejecting pending user:', error);
      throw error;
    }
  };

  const refreshUserProfile = useCallback(async () => {
    console.log('refreshUserProfile: Starting, currentUser:', !!currentUser);
    if (!currentUser) {
      console.log('refreshUserProfile: No currentUser, clearing profile');
      setUserProfile(null);
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      console.log('refreshUserProfile: Fetching user doc for uid:', currentUser.uid);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as AppUser;
        console.log('refreshUserProfile: User doc found, data:', userData);
        setUserProfile(userData);
        console.log('refreshUserProfile: Existing profile state updated');
        
        // All users are admins with full permissions
        setPermissions(getRolePermissions());
      } else {
        // User document doesn't exist, create a default profile
        const defaultProfile: AppUser = {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          email: currentUser.email || '',
          preferences: {
            theme: 'system',
            notifications: {
              email: true,
              push: true,
              sms: false,
            },
            language: 'en',
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(doc(db, 'users', currentUser.uid), defaultProfile);
        setUserProfile(defaultProfile);
        setPermissions(getRolePermissions());
      }
    } catch (error) {
      console.error('refreshUserProfile: Error fetching user profile:', error);
      setUserProfile(null);
      setPermissions(null);
    }
  }, [currentUser]);

  useEffect(() => {
    let mounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      
      setCurrentUser(user);
      
      if (user) {
        // Load user profile and permissions
        try {
          await refreshUserProfile();
        } catch (error) {
          console.error('Error refreshing profile:', error);
        }
      } else {
        setUserProfile(null);
        setPermissions(null);
      }
      
      if (mounted) {
        setLoading(false);
      }
    });

    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted) {
        console.log('Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 10000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [refreshUserProfile]);

  const updateUserProfile = async (updatedProfile: Partial<AppUser>) => {
    try {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...updatedProfile,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    permissions,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    refreshUserProfile,
    updateUserProfile,
    approvePendingUser,
    rejectPendingUser,
    getPendingUsers,
  };


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

