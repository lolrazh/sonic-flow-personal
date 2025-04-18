import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './index.css';

// Create root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  
  const reactRoot = createRoot(root);
  reactRoot.render(<App />);
} else {
  const reactRoot = createRoot(rootElement);
  reactRoot.render(<App />);
}

console.log('🎤 Sonic Flow is running'); 