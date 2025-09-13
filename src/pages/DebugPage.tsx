import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import RoleTest from '../components/RoleTest';
import { migrateExistingUsers, checkMigrationNeeded } from '../lib/migration';

const DebugPage: React.FC = () => {
  const { currentUser, loading, refreshUserProfile, userProfile } = useAuth();
  const [testResult, setTestResult] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string>('');
  const [migrating, setMigrating] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState<boolean | null>(null);
  const [profileTestResult, setProfileTestResult] = useState<string>('');

  const testFirestore = async () => {
    setTesting(true);
    setTestResult('Testing Firestore access...');
    
    try {
      // Test reading from a collection
      const testCollection = collection(db, 'test');
      const snapshot = await getDocs(testCollection);
      setTestResult(`✅ Firestore read successful. Found ${snapshot.docs.length} documents.`);
      
      // Test writing to a collection
      const docRef = await addDoc(testCollection, {
        message: 'Test document',
        timestamp: new Date(),
        userId: currentUser?.uid || 'anonymous'
      });
      setTestResult(prev => prev + `\n✅ Firestore write successful. Document ID: ${docRef.id}`);
      
    } catch (error: any) {
      setTestResult(`❌ Firestore error: ${error.message}`);
      console.error('Firestore test error:', error);
    } finally {
      setTesting(false);
    }
  };

  const checkMigration = async () => {
    try {
      const result = await checkMigrationNeeded();
      setMigrationNeeded(result.needed);
      setMigrationResult(result.message);
    } catch (error: any) {
      setMigrationResult(`Error checking migration: ${error.message}`);
    }
  };

  const runMigration = async () => {
    setMigrating(true);
    setMigrationResult('Starting migration...');
    
    try {
      const result = await migrateExistingUsers();
      setMigrationResult(result.message);
      if (result.success) {
        setMigrationNeeded(false);
        // Refresh the page to see updated user data
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error: any) {
      setMigrationResult(`Migration failed: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const testProfileCreation = async () => {
    setProfileTestResult('Testing profile creation...');
    
    try {
      console.log('Debug: Testing profile creation for user:', currentUser?.uid);
      await refreshUserProfile();
      setProfileTestResult(`Profile creation test completed. User profile: ${userProfile ? 'exists' : 'null'}`);
    } catch (error: any) {
      setProfileTestResult(`Profile creation failed: ${error.message}`);
    }
  };

  useEffect(() => {
    if (currentUser) {
      testFirestore();
      checkMigration();
    }
  }, [currentUser]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      
      {/* Role Test Component */}
      <RoleTest />
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
        <p><strong>User:</strong> {currentUser ? currentUser.email : 'Not logged in'}</p>
        <p><strong>UID:</strong> {currentUser?.uid || 'N/A'}</p>
        <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <h2 className="text-lg font-semibold mb-2">Firestore Test</h2>
        <button 
          onClick={testFirestore}
          disabled={testing || !currentUser}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Firestore Access'}
        </button>
        
        {testResult && (
          <pre className="mt-2 p-2 bg-white rounded text-sm whitespace-pre-wrap">
            {testResult}
          </pre>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Environment Variables</h2>
        <p><strong>Firebase API Key:</strong> {import.meta.env.VITE_FIREBASE_API_KEY ? 'Set' : 'Missing'}</p>
        <p><strong>Firebase Project ID:</strong> {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Missing'}</p>
        <p><strong>Firebase Auth Domain:</strong> {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'Missing'}</p>
      </div>

      {/* Profile Creation Test */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-blue-800">Profile Creation Test</h2>
        <p className="text-sm text-blue-700 mb-4">
          Test profile creation and loading for the current user.
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <button 
              onClick={testProfileCreation}
              disabled={!currentUser}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-600"
            >
              Test Profile Creation
            </button>
          </div>
          
          {profileTestResult && (
            <div className="p-3 bg-white text-blue-800 rounded text-sm">
              {profileTestResult}
            </div>
          )}
        </div>
      </div>

      {/* User Migration Section */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-yellow-800">User Migration</h2>
        <p className="text-sm text-yellow-700 mb-4">
          Migrate existing users to include companyId and proper roles for the new company-scoped system.
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <button 
              onClick={checkMigration}
              disabled={!currentUser}
              className="bg-yellow-500 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-yellow-600"
            >
              Check Migration Status
            </button>
            
            {migrationNeeded && (
              <button 
                onClick={runMigration}
                disabled={migrating || !currentUser}
                className="bg-red-500 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-red-600"
              >
                {migrating ? 'Migrating...' : 'Run Migration'}
              </button>
            )}
          </div>
          
          {migrationResult && (
            <div className={`p-3 rounded text-sm ${
              migrationResult.includes('successful') || migrationResult.includes('No users') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {migrationResult}
            </div>
          )}
          
          {migrationNeeded === false && (
            <div className="p-3 bg-green-100 text-green-800 rounded text-sm">
              ✅ All users are up to date! No migration needed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugPage;
