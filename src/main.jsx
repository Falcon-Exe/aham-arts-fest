import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with update callback
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Called when a new SW is waiting to activate
    if (confirm("New version available! Update now?")) {
      updateSW(); // triggers skipWaiting()
    }
  },
  onOfflineReady() {
    console.log("App ready to work offline!");
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
