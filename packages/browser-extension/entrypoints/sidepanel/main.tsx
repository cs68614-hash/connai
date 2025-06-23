import React from 'react';
import ReactDOM from 'react-dom/client';
import CopilotSidebar from './CopilotSidebar';
import './sidepanel.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <CopilotSidebar />
  </React.StrictMode>
);
