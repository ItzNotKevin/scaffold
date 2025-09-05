import React from 'react';
import { useAuth } from '../lib/useAuth';
import LoginPage from '../pages/LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  console.log('ProtectedRoute: loading =', loading, 'currentUser =', currentUser ? 'Present' : 'None');

  if (loading) {
    console.log('ProtectedRoute: Showing loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    console.log('ProtectedRoute: Showing login page');
    return <LoginPage />;
  }

  console.log('ProtectedRoute: Showing protected content');
  return <>{children}</>;
};

export default ProtectedRoute;

