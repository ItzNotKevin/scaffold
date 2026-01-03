import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PhotoManager from '../components/PhotoManager';

const PhotoPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, permissions } = useAuth();
  const navigate = useNavigate();

  if (!currentUser || !userProfile) {
    return (
      <Layout title="Photos" currentRole="admin">
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
    <Layout title="Photos" currentRole="admin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Photos</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage project photos</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation min-h-[44px]"
          >
            Back to Dashboard
          </button>
        </div>

        <PhotoManager />
      </div>
    </Layout>
  );
};

export default PhotoPage;




