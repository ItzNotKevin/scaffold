import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/useAuth';
import { PushNotificationProvider } from './lib/usePushNotifications';
// import { TaskReminderProvider } from './lib/useTaskReminders';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './lib/LanguageContext';
import Home from './pages/Home';
import AuthPage from './pages/AuthPage.tsx';
import ProjectPage from './pages/ProjectPage.tsx';
import DebugPage from './pages/DebugPage';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PushNotificationProvider>
            <LanguageProvider>
              <div className="min-h-screen bg-gray-50">
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/debug" element={<DebugPage />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Home />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/project/:id"
                    element={
                      <ProtectedRoute>
                        <ProjectPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </LanguageProvider>
          </PushNotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;