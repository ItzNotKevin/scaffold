import React from 'react';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher';
// import TaskReminderSettings from './TaskReminderSettings';

interface TopBarProps {
  title: string;
  onMenuClick?: () => void;
  currentRole?: string;
}

const TopBar: React.FC<TopBarProps> = ({ title, onMenuClick, currentRole }) => {
  const { currentUser, userProfile, logout } = useAuth();
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
      <div className="flex items-center justify-between px-4 py-3 px-safe">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation flex-shrink-0 min-h-[44px] min-w-[44px]"
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
          {/* Logo and Title */}
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity touch-manipulation"
            >
              <div className="w-8 h-8 flex-shrink-0 bg-gray-100 rounded-lg p-0.5">
                <img 
                  src="/scaffold-logo.png" 
                  alt="Scaffold" 
                  className="w-full h-full border-0 outline-none rounded-md"
                  style={{ border: 'none', outline: 'none' }}
                />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 truncate min-w-0">
                {title}
              </h1>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {currentUser ? (
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* <TaskReminderSettings /> */}
              <LanguageSwitcher />
              {/* Mobile: Show only user avatar, Desktop: Show full info */}
              <div className="flex items-center space-x-2">
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-blue-50 rounded-xl">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-blue-900 truncate max-w-32">
                      {currentUser.displayName || currentUser.email}
                    </span>
                    {currentRole && (
                      <span className="text-xs text-blue-700 capitalize">
                        {currentRole}
                      </span>
                    )}
                  </div>
                </div>
                {/* Mobile user indicator */}
                <button
                  onClick={() => navigate('/profile')}
                  className="sm:hidden w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors touch-manipulation min-h-[44px] min-w-[44px]"
                >
                  <span className="text-sm font-medium text-blue-700">
                    {(currentUser.displayName || currentUser.email).charAt(0).toUpperCase()}
                  </span>
                </button>
                {/* Desktop profile link */}
                <button
                  onClick={() => navigate('/profile')}
                  className="hidden sm:flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Profile</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 sm:px-3 py-2 text-sm text-red-600 hover:text-red-700 active:text-red-800 hover:bg-red-50 active:bg-red-100 rounded-xl transition-colors touch-manipulation min-h-[44px]"
                  aria-label="Logout"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-4 sm:px-4 py-2.5 sm:py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation min-h-[44px]"
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

