import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import type { BrowserToVSCodeMessage, MessageResponse } from '../../src/types/messages';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [transport, setTransport] = useState<string>('');
  const [serverUrl, setServerUrl] = useState('http://localhost');
  const [port, setPort] = useState(3000);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check initial connection status from storage and load settings
    checkConnectionStatus();
    loadSettings();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const result = await browser.storage.local.get(['vscIsConnected']);
      setIsConnected(result.vscIsConnected || false);
    } catch (error) {
      console.error('Failed to check connection status:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const result = await browser.storage.local.get(['serverUrl', 'port']);
      if (result.serverUrl) setServerUrl(result.serverUrl);
      if (result.port) setPort(result.port);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await browser.storage.local.set({
        serverUrl,
        port
      });
      console.log('Settings saved:', { serverUrl, port });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const sendMessage = async (message: BrowserToVSCodeMessage): Promise<MessageResponse> => {
    try {
      const response = await browser.runtime.sendMessage(message);
      return response as MessageResponse;
    } catch (error) {
      console.error('Failed to send message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Communication error',
        timestamp: Date.now()
      };
    }
  };

  const generateMessageId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    // Save settings before connecting
    await saveSettings();

    try {
      const response = await sendMessage({
        id: generateMessageId(),
        type: 'Connect',
        timestamp: Date.now(),
        payload: { 
          force: false,
          serverUrl,
          port
        }
      });

      if (response.success) {
        setIsConnected(true);
        setTransport(response.data?.transport || '');
        console.log('Connected successfully:', response.data);
      } else {
        setConnectionError(response.error || 'Connection failed');
        setIsConnected(false);
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await sendMessage({
        id: generateMessageId(),
        type: 'Disconnect',
        timestamp: Date.now(),
        payload: {}
      });

      if (response.success) {
        setIsConnected(false);
        setTransport('');
        setConnectionError(null);
        console.log('Disconnected successfully');
      } else {
        setConnectionError(response.error || 'Disconnection failed');
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testContextRequest = async (contextType: string) => {
    if (!isConnected) {
      alert('Please connect to VS Code first');
      return;
    }

    try {
      const response = await sendMessage({
        id: generateMessageId(),
        type: 'GetContext',
        timestamp: Date.now(),
        payload: {
          contextType: contextType as any,
          options: {},
          workspaceId: undefined
        }
      });

      if (response.success) {
        console.log(`Context request sent for ${contextType}`);
        alert(`Context request sent for ${contextType}. Check console for details.`);
      } else {
        alert(`Failed to request ${contextType}: ${response.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="popup-container">
      <div className="header">
        <div className="header-top">
          <h1>🤖 ConnAI</h1>
          <button 
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
        <p>Browser Extension</p>
      </div>

      {showSettings && (
        <div className="settings-section">
          <h3>Connection Settings</h3>
          <div className="setting-group">
            <label htmlFor="serverUrl">Server URL:</label>
            <input
              id="serverUrl"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost"
              disabled={isConnected}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="port">Port:</label>
            <input
              id="port"
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 3000)}
              placeholder="3000"
              min="1"
              max="65535"
              disabled={isConnected}
            />
          </div>
          <div className="settings-info">
            <small>Full URL: {serverUrl}:{port}</small>
          </div>
          {!isConnected && (
            <button 
              className="save-settings-button"
              onClick={saveSettings}
            >
              Save Settings
            </button>
          )}
        </div>
      )}

      <div className="connection-section">
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span className="status-text">
            {isConnected ? `Connected to ${serverUrl}:${port}` : 'Disconnected'}
          </span>
        </div>

        {transport && (
          <div className="transport-info">
            <small>Transport: {transport}</small>
          </div>
        )}

        {connectionError && (
          <div className="error-message">
            <small>Error: {connectionError}</small>
          </div>
        )}

        <div className="connection-buttons">
          {!isConnected ? (
            <button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="connect-button"
            >
              {isConnecting ? 'Connecting...' : `Connect to ${serverUrl}:${port}`}
            </button>
          ) : (
            <button 
              onClick={handleDisconnect}
              className="disconnect-button"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="test-section">
          <h3>Test Context Requests</h3>
          <div className="test-buttons">
            <button onClick={() => testContextRequest('focused-file')}>
              📄 Focused File
            </button>
            <button onClick={() => testContextRequest('selected-text')}>
              🎯 Selected Text
            </button>
            <button onClick={() => testContextRequest('all-open-tabs')}>
              📑 All Open Tabs
            </button>
            <button onClick={() => testContextRequest('problems')}>
              ⚠️ Problems
            </button>
            <button onClick={() => testContextRequest('file-tree')}>
              🌲 File Tree
            </button>
          </div>
        </div>
      )}

      <div className="usage-section">
        <h3>Usage</h3>
        <ol>
          <li>Connect to VS Code using the button above</li>
          <li>Go to any webpage with text input</li>
          <li>Type <code>#</code> in any input field</li>
          <li>Select a context option from the menu</li>
          <li>VS Code data will be inserted automatically</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
