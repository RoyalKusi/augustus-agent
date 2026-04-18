import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Guard: if the server returned JSON instead of HTML (SPA routing misconfiguration),
// the root element won't exist. Detect this and redirect to the correct URL.
const rootEl = document.getElementById('root');
if (!rootEl) {
  // Page is likely raw JSON — redirect to the app root
  window.location.replace('/');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
