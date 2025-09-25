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
import { doc, setDoc, getDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
// Define types directly here to avoid module resolution issues
interface AppUser {
  uid: string;
  name: string;
  email: string;
  profilePicture?: string;
  preferences: UserPreferences;
  companyId?: string; // Optional - only set when user belongs to a company
  createdAt?: any;
  updatedAt?: any;
}

// Company membership with role
interface CompanyMembership {
  userId: string;
  companyId: string;
  role: 'admin' | 'staff' | 'client';
  joinedAt: any;
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

export type UserRole = 'admin' | 'staff' | 'client';

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

// Role-based permission utility
export const getRolePermissions = (role: UserRole): RolePermissions => {
  switch (role) {
    case 'admin':
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
    case 'staff':
      return {
        canManageUsers: false,
        canManageProjects: true,
        canCreateProjects: true,
        canDeleteProjects: false,
        canManageCheckIns: true,
        canCreateCheckIns: true,
        canViewAllProjects: true,
        canViewProjectDetails: true,
        canManageFeedback: true,
        canCreateFeedback: true,
        canViewFeedback: true,
        canManageCompany: false,
        canManageDailyReports: true,
        canCreateDailyReports: true,
        canViewDailyReports: true,
        canApproveDailyReports: false,
      };
    case 'client':
      return {
        canManageUsers: false,
        canManageProjects: false,
        canCreateProjects: false,
        canDeleteProjects: false,
        canManageCheckIns: false,
        canCreateCheckIns: false,
        canViewAllProjects: false,
        canViewProjectDetails: true,
        canManageFeedback: false,
        canCreateFeedback: true,
        canViewFeedback: true,
        canManageCompany: false,
        canManageDailyReports: false,
        canCreateDailyReports: false,
        canViewDailyReports: true,
        canApproveDailyReports: false,
      };
    default:
      return {
        canManageUsers: false,
        canManageProjects: false,
        canCreateProjects: false,
        canDeleteProjects: false,
        canManageCheckIns: false,
        canCreateCheckIns: false,
        canViewAllProjects: false,
        canViewProjectDetails: false,
        canManageFeedback: false,
        canCreateFeedback: false,
        canViewFeedback: false,
        canManageCompany: false,
        canManageDailyReports: false,
        canCreateDailyReports: false,
        canViewDailyReports: false,
        canApproveDailyReports: false,
      };
  }
};

interface AuthContextType {
  currentUser: User | null;
  userProfile: AppUser | null;
  permissions: RolePermissions | null;
  loading: boolean;
  signup: (email: string, password: string, displayName?: string, role?: UserRole, companyId?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  createCompany: (companyName: string, companyDescription?: string) => Promise<string>;
  joinCompany: (companyId: string) => Promise<void>;
  updateUserProfile: (updatedProfile: Partial<AppUser>) => Promise<void>;
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

  const signup = async (email: string, password: string, displayName?: string, role: UserRole = 'client', companyId?: string) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      
      // Check if this is the first user in the system (becomes super admin)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnapshot.empty;
      
      // Prepare user data (no role - roles are company-specific)
      const userData: any = {
        uid: user.uid,
        name: user.displayName || displayName || '',
        email: user.email,
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
      
      // Only add companyId if it has a value
      if (isFirstUser) {
        userData.companyId = 'super-admin';
      } else if (companyId) {
        userData.companyId = companyId;
      }
      
      await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
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

  const updateUserRole = async (userId: string, role: UserRole, companyId?: string) => {
    try {
      if (!companyId) {
        throw new Error('Company ID is required to update user role');
      }
      
      // Update role in companyMemberships collection
      await setDoc(
        doc(db, 'companyMemberships', `${userId}_${companyId}`),
        { 
          userId,
          companyId,
          role: role,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Refresh current user profile if it's the same user
      if (currentUser && currentUser.uid === userId) {
        await refreshUserProfile();
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  };

  const createCompany = async (companyName: string, companyDescription?: string) => {
    if (!currentUser) throw new Error('User must be logged in to create a company');
    
    try {
      // Create company document
      const companyId = `company-${Date.now()}`;
      const companyData = {
        id: companyId,
        name: companyName,
        description: companyDescription || '',
        ownerId: currentUser.uid,
        members: [currentUser.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'companies', companyId), companyData);
      
      // Update user to belong to this company
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          companyId: companyId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Create company membership record for admin
      await setDoc(
        doc(db, 'companyMemberships', `${currentUser.uid}_${companyId}`),
        {
          userId: currentUser.uid,
          companyId: companyId,
          role: 'admin',
          joinedAt: serverTimestamp(),
        }
      );
      
      // Refresh user profile
      await refreshUserProfile();
      
      return companyId;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  };

  const joinCompany = async (companyId: string) => {
    if (!currentUser) throw new Error('User must be logged in to join a company');
    
    try {
      // Add user to company members
      await setDoc(
        doc(db, 'companies', companyId),
        {
          members: [currentUser.uid],
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Update user to belong to this company
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          companyId: companyId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Create company membership record
      await setDoc(
        doc(db, 'companyMemberships', `${currentUser.uid}_${companyId}`),
        {
          userId: currentUser.uid,
          companyId: companyId,
          role: 'staff',
          joinedAt: serverTimestamp(),
        }
      );
      
      // Refresh user profile
      await refreshUserProfile();
      
    } catch (error) {
      console.error('Error joining company:', error);
      throw error;
    }
  };

  const getUserRoleInCompany = async (userId: string, companyId: string): Promise<UserRole> => {
    try {
      
      // Check company membership record
      const membershipDoc = await getDoc(doc(db, 'companyMemberships', `${userId}_${companyId}`));
      
      if (membershipDoc.exists()) {
        const membership = membershipDoc.data() as CompanyMembership;
        return membership.role;
      }
      
      // Check if user is company owner
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      
      if (companyDoc.exists()) {
        const companyData = companyDoc.data();
        if (companyData.ownerId === userId) {
          // Create admin membership record for company owner
          await setDoc(doc(db, 'companyMemberships', `${userId}_${companyId}`), {
            userId,
            companyId,
            role: 'admin',
            joinedAt: serverTimestamp()
          });
          return 'admin';
        }
      }
      
      // If no membership and not owner, check if company exists before creating membership
      if (companyDoc.exists()) {
        await setDoc(doc(db, 'companyMemberships', `${userId}_${companyId}`), {
          userId,
          companyId,
          role: 'staff',
          joinedAt: serverTimestamp()
        });
        return 'staff';
      } else {
        return 'client';
      }
    } catch (error) {
      console.error('Error getting user role in company:', error);
      return 'client';
    }
  };

  const refreshUserProfile = useCallback(async () => {
    console.log('refreshUserProfile: Starting, currentUser:', !!currentUser);
    if (!currentUser) {
      console.log('refreshUserProfile: No currentUser, clearing profile');
      setUserProfile(null);
      setPermissions(null);
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
        
        // Get role from company membership if user belongs to a company
        if (userData.companyId) {
          const role = await getUserRoleInCompany(currentUser.uid, userData.companyId);
          
          // Check if company actually exists, regardless of role
          const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
          if (!companyDoc.exists()) {
            // Company doesn't exist, clear the companyId and set permissions to null
            await updateDoc(doc(db, 'users', currentUser.uid), {
              companyId: null,
              updatedAt: serverTimestamp()
            });
            setUserProfile({ ...userData, companyId: undefined });
            setPermissions(null);
            return;
          }
          
          const permissions = getRolePermissions(role);
          setPermissions(permissions);
        } else {
          // User without company has no permissions
          setPermissions(null);
        }
      } else {
        // User document doesn't exist, create a default profile
        console.log('refreshUserProfile: User doc not found, creating default profile');
        // Check if this is the first user in the system
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const isFirstUser = usersSnapshot.empty;
        
        // Create a default user profile (no role - roles are company-specific)
        const defaultProfile: any = {
          uid: currentUser.uid,
          name: currentUser.displayName || '',
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
        };
        
        // Only add companyId if it has a value
        if (isFirstUser) {
          defaultProfile.companyId = 'super-admin';
        }
        
        console.log('refreshUserProfile: Creating user document with data:', {
          ...defaultProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'users', currentUser.uid), {
          ...defaultProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('refreshUserProfile: User document created successfully');
        
        console.log('refreshUserProfile: Setting default profile:', defaultProfile);
        setUserProfile(defaultProfile);
        console.log('refreshUserProfile: Profile state updated');
        
        // Set permissions based on company membership
        if (defaultProfile.companyId) {
          const role = await getUserRoleInCompany(currentUser.uid, defaultProfile.companyId);
          setPermissions(getRolePermissions(role));
        } else {
          setPermissions(null);
        }
      }
    } catch (error) {
      console.error('refreshUserProfile: Error fetching user profile:', error);
      setUserProfile(null);
      setPermissions(null);
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Load user profile and permissions
        await refreshUserProfile();
      } else {
        setUserProfile(null);
        setPermissions(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []); // Remove refreshUserProfile dependency to prevent infinite loop

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
    updateUserRole,
    refreshUserProfile,
    createCompany,
    joinCompany,
    updateUserProfile,
  };


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

