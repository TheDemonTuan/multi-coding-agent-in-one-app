import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Check if root element exists
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[Renderer] Root element not found!');
  document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Error: Root element not found</h1><p>Check index.html</p></div>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);

    root.render(
      <>
        <App />
      </>
    );

    // Global error boundary
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('[Renderer] Global error:', message, error);
      document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;">
        <h1>Runtime Error</h1>
        <p><strong>${message}</strong></p>
        <p>Line: ${lineno}:${colno}</p>
        <p>Check DevTools Console (F12) for details</p>
      </div>`;
    };
  } catch (error: any) {
    console.error('[Renderer] Failed to render App:', error);
    document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Error: ${error.message}</h1><p>Check console for details</p></div>`;
  }
}
