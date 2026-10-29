import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Automatically sync theme with OS/device dark mode preference
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

applyTheme(mediaQuery.matches);
mediaQuery.addEventListener('change', (e) => applyTheme(e.matches));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
