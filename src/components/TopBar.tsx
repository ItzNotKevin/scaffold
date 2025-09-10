import React from 'react';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  title: string;
  onMenuClick?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ title, onMenuClick }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/auth');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 sticky top-0 z-50 pt-safe">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center space-x-2">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors touch-manipulation"
              aria-label="Menu"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-blue-50 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900 truncate max-w-32">
                  {currentUser.displayName || currentUser.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors touch-manipulation"
                aria-label="Logout"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors touch-manipulation"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;

