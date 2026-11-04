import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { InstallApp } from '@/components/install-app';
import { registerAppWorker } from '@/lib/app-service-worker';

import './index.css';
import './dark-theme.css';
import './visual-refresh.css';
import './typography.css';
import './palette.css';

// Keep the development preview free of service-worker interception.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerAppWorker().catch((error) => console.warn('تعذر تجهيز التثبيت على الجهاز:', error));
  });
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ThemeProvider attribute="class" defaultTheme="system" storageKey="athar-theme" enableSystem disableTransitionOnChange>
    <ErrorBoundary>
      <App />
      <InstallApp />
    </ErrorBoundary>
  </ThemeProvider>,
);
