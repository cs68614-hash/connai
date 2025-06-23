import { createProtocolClient, ProtocolClient } from '../src/utils/protocol-client';
import type { BrowserToVSCodeMessage, VSCodeToBrowserMessage, MessageResponse } from '../src/types/messages';
import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('ConnAI Background Script loaded');

  let protocolClient: ProtocolClient | null = null;
  
  // Store for managing connection state
  let connectionState = {
    isConnected: false,
    isConnecting: false,
    lastError: null as string | null
  };

  /**
   * Handle messages from content scripts and popup
   */
  const handleMessage = async (
    message: BrowserToVSCodeMessage,
    sender: Browser.runtime.MessageSender
  ): Promise<MessageResponse> => {
    console.log('ConnAI Background: Received message:', message.type, 'from tab:', sender.tab?.id);

    try {
      switch (message.type) {
        case 'Connect':
          return await handleConnectMessage(message);
        
        case 'Disconnect':
          return await handleDisconnectMessage();
        
        case 'OpenSidePanel':
          return await handleOpenSidePanelMessage(sender);
        
        case 'GetFile':
        case 'Grep':
        case 'GetContext':
          return await handleForwardMessage(message);
        
        default:
          throw new Error(`Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      console.error('ConnAI Background: Error handling message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  };

  /**
   * Handle connection request
   */
  const handleConnectMessage = async (message: { type: 'Connect'; payload: { force?: boolean; serverUrl?: string; port?: number } }): Promise<MessageResponse> => {
    if (connectionState.isConnecting) {
      return {
        success: false,
        error: 'Connection already in progress',
        timestamp: Date.now()
      };
    }

    if (connectionState.isConnected && !message.payload.force) {
      return {
        success: true,
        data: { connected: true, transport: 'http' },
        timestamp: Date.now()
      };
    }

    try {
      connectionState.isConnecting = true;
      connectionState.lastError = null;

      // Get configuration from storage or use provided values
      const config = await getConnectionConfig();
      const serverUrl = message.payload.serverUrl || config.serverUrl;
      const port = message.payload.port || config.port;
      const fullServerUrl = `${serverUrl}:${port}`;

      // Create and connect protocol client
      protocolClient = createProtocolClient({
        serverUrl: fullServerUrl,
        timeout: config.timeout,
        maxReconnectAttempts: config.retryAttempts
      });

      // Set up event handlers
      protocolClient.on('connected', () => {
        console.log('Protocol client connected');
        connectionState.isConnected = true;
        broadcastToAllTabs({
          id: Date.now().toString(),
          type: 'ConnectionStatus',
          timestamp: Date.now(),
          payload: { connected: true }
        });
      });

      protocolClient.on('disconnected', () => {
        console.log('Protocol client disconnected');
        connectionState.isConnected = false;
        broadcastToAllTabs({
          id: Date.now().toString(),
          type: 'ConnectionStatus',
          timestamp: Date.now(),
          payload: { connected: false }
        });
      });

      protocolClient.on('error', (error: Error) => {
        console.error('Protocol client error:', error);
        connectionState.lastError = error.message;
      });

      await protocolClient.connect();

      connectionState.isConnected = true;
      connectionState.isConnecting = false;

      // Save successful connection config
      await browser.storage.local.set({ 
        vscIsConnected: true,
        lastConnected: Date.now(),
        lastServerUrl: serverUrl,
        lastPort: port
      });

      // Broadcast connection status to all tabs
      broadcastToAllTabs({
        id: Date.now().toString(),
        type: 'ConnectionStatus',
        timestamp: Date.now(),
        payload: {
          connected: true
        }
      });

      return {
        success: true,
        data: { 
          connected: true, 
          transport: 'http',
          serverUrl: fullServerUrl
        },
        timestamp: Date.now()
      };

    } catch (error) {
      connectionState.isConnecting = false;
      connectionState.lastError = error instanceof Error ? error.message : 'Connection failed';
      
      await browser.storage.local.set({ 
        vscIsConnected: false,
        lastError: connectionState.lastError
      });

      return {
        success: false,
        error: connectionState.lastError,
        timestamp: Date.now()
      };
    }
  };

  /**
   * Get connection configuration from storage
   */
  const getConnectionConfig = async () => {
    const result = await browser.storage.local.get([
      'serverUrl', 
      'port', 
      'timeout', 
      'retryAttempts'
    ]);

    return {
      serverUrl: result.serverUrl || 'http://localhost',
      port: result.port || 6797, // 使用VS Code工作区管理器的典型端口
      timeout: result.timeout || 10000,
      retryAttempts: result.retryAttempts || 3
    };
  };

  /**
   * Handle disconnection request
   */
  const handleDisconnectMessage = async (): Promise<MessageResponse> => {
    try {
      if (protocolClient) {
        protocolClient.disconnect();
        protocolClient = null;
      }
      
      connectionState.isConnected = false;
      connectionState.lastError = null;

      await browser.storage.local.set({ 
        vscIsConnected: false,
        lastDisconnected: Date.now()
      });

      // Broadcast disconnection status to all tabs
      broadcastToAllTabs({
        id: Date.now().toString(),
        type: 'ConnectionStatus',
        timestamp: Date.now(),
        payload: {
          connected: false
        }
      });

      return {
        success: true,
        data: { connected: false },
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnection failed',
        timestamp: Date.now()
      };
    }
  };

  /**
   * Handle opening the side panel
   */
  const handleOpenSidePanelMessage = async (sender: Browser.runtime.MessageSender): Promise<MessageResponse> => {
    try {
      // Get the window ID from the sender
      const windowId = sender.tab?.windowId;
      
      if (windowId) {
        // Open the side panel for the specific window
        await browser.sidePanel.open({ windowId });
      } else {
        // Try to get the current window if we can't get it from sender
        const windows = await browser.windows.getAll({ populate: false });
        if (windows.length > 0 && windows[0].id) {
          await browser.sidePanel.open({ windowId: windows[0].id });
        } else {
          throw new Error('Unable to determine window ID');
        }
      }

      return {
        success: true,
        data: { opened: true },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to open side panel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open side panel',
        timestamp: Date.now()
      };
    }
  };

  /**
   * Forward message to VS Code server
   */
  const handleForwardMessage = async (message: BrowserToVSCodeMessage): Promise<MessageResponse> => {
    if (!connectionState.isConnected || !protocolClient) {
      return {
        success: false,
        error: 'Not connected to VS Code server',
        timestamp: Date.now()
      };
    }

    try {
      let operation: string;
      let payload: any = {};

      // Map message types to protocol operations
      switch (message.type) {
        case 'GetContext':
          operation = 'get_context';
          payload = {
            type: message.payload.contextType,
            workspaceId: message.payload.workspaceId,
            options: message.payload.options
          };
          break;
        
        case 'GetFile':
          operation = 'read_file';
          payload = {
            path: message.payload.filePath
          };
          break;
        
        case 'Grep':
          operation = 'grep_search';
          payload = {
            pattern: message.payload.pattern,
            includePattern: message.payload.options?.includePattern,
            excludePattern: message.payload.options?.excludePattern
          };
          break;
        
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      // Send request through protocol client
      const result = await protocolClient.sendRequest(operation, payload);

      // Broadcast result to all tabs
      broadcastToAllTabs({
        id: message.id,
        type: 'ContextResponse',
        timestamp: Date.now(),
        payload: result
      });

      return {
        success: true,
        data: result,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to forward message',
        timestamp: Date.now()
      };
    }
  };

  /**
   * Broadcast message to all tabs or specific tab
   */
  const broadcastToAllTabs = async (message: VSCodeToBrowserMessage, tabId?: number) => {
    try {
      if (tabId) {
        // Send to specific tab
        await browser.tabs.sendMessage(tabId, message);
      } else {
        // Send to all tabs
        const tabs = await browser.tabs.query({});
        const promises = tabs.map(tab => {
          if (tab.id) {
            return browser.tabs.sendMessage(tab.id, message).catch(error => {
              // Ignore errors for tabs that don't have content scripts
              console.log(`ConnAI: Could not send message to tab ${tab.id}:`, error.message);
            });
          }
        });
        await Promise.allSettled(promises);
      }
    } catch (error) {
      console.error('ConnAI Background: Error broadcasting message:', error);
    }
  };

  // Register message listener
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle async responses
    handleMessage(message, sender)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error('ConnAI Background: Unhandled error:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  });

  // Initialize connection state from storage
  browser.storage.local.get(['vscIsConnected']).then(result => {
    if (result.vscIsConnected) {
      connectionState.isConnected = true;
      console.log('ConnAI Background: Restored connection state from storage');
    }
  });

  /**
   * Auto-connect on startup
   */
  const autoConnect = async () => {
    try {
      console.log('ConnAI Background: Attempting auto-connect...');
      
      // Try to restore previous connection settings
      const config = await getConnectionConfig();
      
      // Import port scanner for auto-detection
      const { findConnAIServer } = await import('../src/utils/port-scanner');
      
      // First try the saved configuration
      let serverFound = false;
      const fullServerUrl = `${config.serverUrl}:${config.port}`;
      
      try {
        const testResponse = await fetch(`${fullServerUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        
        if (testResponse.ok) {
          console.log(`ConnAI Background: Found server at saved location: ${fullServerUrl}`);
          serverFound = true;
        }
      } catch (error) {
        console.log(`ConnAI Background: Saved server not available: ${fullServerUrl}`);
      }
      
      // If saved server not available, try auto-detection
      if (!serverFound) {
        console.log('ConnAI Background: Auto-detecting ConnAI servers...');
        const detectedServer = await findConnAIServer(config.serverUrl);
        
        if (detectedServer) {
          console.log(`ConnAI Background: Auto-detected server on port ${detectedServer.port}`);
          
          // Update configuration with detected server
          await browser.storage.local.set({
            port: detectedServer.port,
            serverUrl: config.serverUrl
          });
          
          config.port = detectedServer.port;
          serverFound = true;
        }
      }
      
      // Try to connect if server found
      if (serverFound) {
        const connectResult = await handleConnectMessage({
          type: 'Connect',
          payload: {
            serverUrl: config.serverUrl,
            port: config.port,
            force: false
          }
        } as any);
        
        if (connectResult.success) {
          console.log('ConnAI Background: Auto-connect successful');
          
          // Broadcast connection status to all tabs
          broadcastToAllTabs({
            id: Date.now().toString(),
            type: 'ConnectionStatus',
            timestamp: Date.now(),
            payload: { connected: true }
          });
        } else {
          console.log('ConnAI Background: Auto-connect failed:', connectResult.error);
        }
      } else {
        console.log('ConnAI Background: No ConnAI servers found for auto-connect');
      }
    } catch (error) {
      console.error('ConnAI Background: Auto-connect error:', error);
    }
  };

  // Start auto-connect after a short delay to ensure everything is initialized
  setTimeout(autoConnect, 2000);

  /**
   * Periodic connection check and auto-reconnect
   */
  const startPeriodicCheck = () => {
    setInterval(async () => {
      // Only check if we think we're connected but haven't verified recently
      if (connectionState.isConnected && protocolClient) {
        try {
          // Quick health check
          const response = await fetch(`${protocolClient.getServerUrl()}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(3000)
          });
          
          if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
          }
        } catch (error) {
          console.log('ConnAI Background: Connection lost, attempting reconnect...');
          connectionState.isConnected = false;
          
          // Try to reconnect
          setTimeout(autoConnect, 1000);
        }
      } else if (!connectionState.isConnected && !connectionState.isConnecting) {
        // If not connected and not currently trying to connect, attempt auto-connect
        console.log('ConnAI Background: Periodic auto-connect attempt...');
        setTimeout(autoConnect, 500);
      }
    }, 30000); // Check every 30 seconds
  };

  // Start periodic checking after initial connection attempt
  setTimeout(startPeriodicCheck, 10000);

  // Handle extension startup
  browser.runtime.onStartup.addListener(() => {
    console.log('ConnAI Background: Extension startup');
    setTimeout(autoConnect, 1000);
  });

  // Handle extension installation
  browser.runtime.onInstalled.addListener((details) => {
    console.log('ConnAI Background: Extension installed/updated:', details.reason);
    
    // Clear storage on fresh install
    if (details.reason === 'install') {
      browser.storage.local.clear();
    }
  });

  console.log('ConnAI Background Script initialized successfully');
});
