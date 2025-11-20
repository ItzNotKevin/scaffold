import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './lib/useAuth';
import { PushNotificationProvider } from './lib/usePushNotifications';
// import { TaskReminderProvider } from './lib/useTaskReminders';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './lib/LanguageContext';
import Home from './pages/Home';
import AuthPage from './pages/AuthPage.tsx';
import ProjectPage from './pages/ProjectPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import DebugPage from './pages/DebugPage';
import PayrollPage from './pages/PayrollPage.tsx';
import StaffAssignmentsPage from './pages/StaffAssignmentsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import ReimbursementPage from './pages/ReimbursementPage';
import TaskTemplatesPage from './pages/TaskTemplatesPage';
import ActivityLogsPage from './pages/ActivityLogsPage';

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
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
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
                <Route
                  path="/payroll"
                  element={
                    <ProtectedRoute>
                      <PayrollPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff-assignments"
                  element={
                    <ProtectedRoute>
                      <StaffAssignmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff-management"
                  element={
                    <ProtectedRoute>
                      <StaffManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reimbursement"
                  element={
                    <ProtectedRoute>
                      <ReimbursementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/task-templates"
                  element={
                    <ProtectedRoute>
                      <TaskTemplatesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/activity-logs"
                  element={
                    <ProtectedRoute>
                      <ActivityLogsPage />
                    </ProtectedRoute>
                  }
                />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Analytics />
                <SpeedInsights />
              </div>
            </LanguageProvider>
          </PushNotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;