import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/* The canvas is a fixed-size simulation surface; block iOS double-tap zoom
   and rubber-band scrolling at the document level. */
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
