import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for navigation errors in web containers
window.addEventListener('error', (event) => {
  // Check if it's a navigation error in web container
  if (event.message && event.message.includes('Cannot navigate to URL')) {
    console.warn('Navigation error detected in web container environment:', event.message);
    
    // Prevent the error from showing in console
    event.preventDefault();
    
    // If needed, you could dispatch a custom event to notify components
    window.dispatchEvent(new CustomEvent('webcontainer-navigation-error'));
  }
});

// Use a self-invoking function to handle any errors during initialization
(function() {
  try {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error('Error initializing application:', error);
    // Render a fallback error UI if the main app fails to initialize
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif;">
          <div style="background: #FEF2F2; border: 1px solid #F87171; border-radius: 8px; padding: 16px; max-width: 500px; text-align: center;">
            <h2 style="color: #B91C1C; margin-top: 0;">Application Error</h2>
            <p style="color: #7F1D1D;">There was a problem initializing the application. This may be due to browser compatibility issues or network connectivity problems.</p>
            <button 
              onclick="window.location.reload()" 
              style="background: #B91C1C; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;"
            >
              Reload Application
            </button>
          </div>
        </div>
      `;
    }
  }
})();