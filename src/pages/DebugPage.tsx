import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

const DebugPage: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const [testResult, setTestResult] = useState<string>('');
  const [testing, setTesting] = useState(false);

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

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-4">
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
    </div>
  );
};

export default DebugPage;
