import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { usePWAInstall } from '../lib/usePWAInstall';
import { useLanguage } from '../lib/LanguageContext';
import Layout from '../components/Layout';
import AdminDashboard from '../components/AdminDashboard';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const { languageKey } = useLanguage();

  if (!currentUser || !userProfile) {
    return (
      <Layout title="Loading..." currentRole="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-4">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard" currentRole="admin">
      <div className="space-y-6">
        {/* PWA Install Prompt */}
        {isInstallable && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Install App</h3>
                  <p className="text-xs text-blue-700">Install this app on your device for a better experience</p>
                </div>
              </div>
              <button
                onClick={installApp}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        )}

        {/* Admin Dashboard */}
        <AdminDashboard
          permissions={permissions}
        />
      </div>
    </Layout>
  );
};

export default Home;