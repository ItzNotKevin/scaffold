import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n' // Initialize i18n
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA and Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register main service worker
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered: ', registration);
        
        // Check for updates but don't auto-reload
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available but don't auto-reload
                console.log('New content available. Reload page to update.');
                // Optionally show a toast notification to user instead
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}
