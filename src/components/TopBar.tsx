import React, { useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher';
// import TaskReminderSettings from './TaskReminderSettings';

interface TopBarProps {
  title: string;
  onMenuClick?: () => void;
  currentRole?: string;
}

const TopBar: React.FC<TopBarProps> = ({ title, onMenuClick, currentRole }) => {
  const { currentUser, userProfile, logout, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);

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

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/projects', label: 'Projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { path: '/staff-assignments', label: 'Staff Assignments', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    ...(permissions?.canManageUsers ? [{ path: '/staff-management', label: 'Staff Management', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }] : []),
    { path: '/expenses', label: 'Expenses', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { path: '/income', label: 'Income', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/photos', label: 'Photos', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
    { path: '/activity-logs', label: 'Activity Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    ...(permissions?.canManageUsers ? [
      { path: '/task-templates', label: 'Categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
      { path: '/payroll', label: 'Payroll', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
    ] : []),
  ];

  const handleMenuClick = (path: string) => {
    navigate(path);
    setShowMenu(false);
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 sticky top-0 z-50 pt-safe">
      <div className="flex items-center justify-between px-4 py-3 px-safe">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Hamburger Menu */}
          {currentUser && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
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
              
              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-200 py-2 z-50">
                    {menuItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleMenuClick(item.path)}
                          className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <svg
                            className="w-5 h-5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={item.icon}
                            />
                          </svg>
                          <span className="font-medium">{item.label}</span>
                          {isActive && (
                            <svg
                              className="w-4 h-4 ml-auto text-blue-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          
          {onMenuClick && !currentUser && (
            <button
              onClick={onMenuClick}
              className="p-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation flex-shrink-0"
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
                  <span className="text-sm font-medium text-blue-900 truncate max-w-32">
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
                {/* Mobile user indicator */}
                <button
                  onClick={() => navigate('/profile')}
                  className="sm:hidden w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors touch-manipulation"
                >
                  <span className="text-xs font-medium text-blue-700">
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
                  className="px-2 sm:px-3 py-2 text-sm text-red-600 hover:text-red-700 active:text-red-800 hover:bg-red-50 active:bg-red-100 rounded-xl transition-colors touch-manipulation"
                  aria-label="Logout"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <svg className="sm:hidden w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
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

