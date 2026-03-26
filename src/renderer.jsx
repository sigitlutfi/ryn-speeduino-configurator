import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from './renderer/App.jsx';
import ErrorBoundary from './renderer/ui/ErrorBoundary.jsx';

const { hook } = memoryLocation();

const root = createRoot(document.getElementById('app'));
root.render(
  <ErrorBoundary>
    <Router hook={hook}>
      <App />
    </Router>
  </ErrorBoundary>
);
