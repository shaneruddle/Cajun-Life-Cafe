import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Workbox } from 'workbox-window';
import App from './App.tsx';
import { LanguageProvider } from './i18n';
import './index.css';

// Register Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  const wb = new Workbox('/sw.js');
  wb.register().catch(err => console.error('Service Worker registration failed:', err));
} else if ('serviceWorker' in navigator) {
  // In dev mode, we still want to test it if needed, but normally we might exclude it.
  // For this environment, let's allow it to run to satisfy the requirement.
  const wb = new Workbox('/sw.js');
  wb.register().catch(err => console.error('Service Worker registration failed:', err));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
<LanguageProvider>
    <App />
</LanguageProvider>
  </StrictMode>,
);
