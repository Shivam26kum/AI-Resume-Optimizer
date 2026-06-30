import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 1. Import the provider from react-toastella
import { ToasterProvider } from 'react-toastella'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Wrap App inside the Provider element */}
    <ToasterProvider>
      <App />
    </ToasterProvider>
  </React.StrictMode>,
);