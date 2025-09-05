import React from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../lib/useAuth';

const Home: React.FC = () => {
  const { currentUser, logout } = useAuth();

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <Layout title="Construction PM" onMenuClick={handleMenuClick}>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to Construction PM
          </h2>
          <p className="text-gray-600 mb-4">
            Manage your construction projects efficiently with our mobile-first app.
          </p>
          {currentUser && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="font-medium text-gray-900">
                  {currentUser.displayName || currentUser.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-blue-600 text-white p-4 rounded-xl shadow-sm hover:bg-blue-700 transition-colors">
            <div className="text-center">
              <div className="text-2xl mb-2">📋</div>
              <div className="font-medium">Projects</div>
            </div>
          </button>
          <button className="bg-green-600 text-white p-4 rounded-xl shadow-sm hover:bg-green-700 transition-colors">
            <div className="text-center">
              <div className="text-2xl mb-2">👷</div>
              <div className="font-medium">Team</div>
            </div>
          </button>
          <button className="bg-orange-600 text-white p-4 rounded-xl shadow-sm hover:bg-orange-700 transition-colors">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium">Reports</div>
            </div>
          </button>
          <button className="bg-purple-600 text-white p-4 rounded-xl shadow-sm hover:bg-purple-700 transition-colors">
            <div className="text-center">
              <div className="text-2xl mb-2">⚙️</div>
              <div className="font-medium">Settings</div>
            </div>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Project Alpha</p>
                <p className="text-xs text-gray-500">Updated 2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Site Inspection</p>
                <p className="text-xs text-gray-500">Completed yesterday</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Material Delivery</p>
                <p className="text-xs text-gray-500">Scheduled for tomorrow</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
