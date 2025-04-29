import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

/**
 * Initialize and render the React application
 */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);