import React from 'react';
import { AuthProvider } from './lib/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';

function App() {
  console.log('App: Rendering App component');
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
