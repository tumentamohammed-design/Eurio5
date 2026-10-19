import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { initThemeOnLoad } from './lib/themePrefs.js';
import './index.css';

// Apply any saved color/font-size preferences before the first paint, so a
// returning visitor never sees a flash of the default theme.
initThemeOnLoad();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
