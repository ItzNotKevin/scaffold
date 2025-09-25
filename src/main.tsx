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
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available, refresh the page
                console.log('New content available, refreshing...');
                window.location.reload();
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
