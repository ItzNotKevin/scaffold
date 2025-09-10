import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string, displayName?: string) => {
    try {
      console.log('Signup: Starting signup process for', email);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Signup: User created successfully', user.uid);
      
      if (displayName) {
        console.log('Signup: Updating profile with display name');
        await updateProfile(user, { displayName });
      }
      
      console.log('Signup: Creating user document in Firestore');
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email,
          displayName: user.displayName || displayName || '',
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('Signup: User document created successfully');
    } catch (error) {
      console.error('Signup: Error during signup process', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Login: Starting login process for', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login: Login successful');
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

  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('AuthProvider: Auth state changed', { user: user ? 'logged in' : 'logged out', loading: false });
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

