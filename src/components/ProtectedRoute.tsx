import React from 'react';
import { useAuth } from '../lib/useAuth';
import LoginPage from '../pages/LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  console.log('ProtectedRoute: Render', { loading, currentUser: currentUser ? 'logged in' : 'logged out' });

  if (loading) {
    console.log('ProtectedRoute: Showing loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    console.log('ProtectedRoute: No user, showing login page');
    return <LoginPage />;
  }

  console.log('ProtectedRoute: User authenticated, showing children');
  return <>{children}</>;
};

export default ProtectedRoute;

