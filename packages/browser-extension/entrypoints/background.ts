import { getWebSocketClient } from '../src/utils/websocket';
import type { BrowserToVSCodeMessage, VSCodeToBrowserMessage, MessageResponse } from '../src/types/messages';
import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('ConnAI Background Script loaded');

  const webSocketClient = getWebSocketClient();
  
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
        data: { connected: true },
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

      await webSocketClient.connect({
        serverUrl: fullServerUrl,
        timeout: config.timeout,
        retryAttempts: config.retryAttempts
      });

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
          transport: webSocketClient.transport,
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
      port: result.port || 3000,
      timeout: result.timeout || 10000,
      retryAttempts: result.retryAttempts || 3
    };
  };

  /**
   * Handle disconnection request
   */
  const handleDisconnectMessage = async (): Promise<MessageResponse> => {
    try {
      webSocketClient.disconnect();
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
   * Forward message to VS Code server
   */
  const handleForwardMessage = async (message: BrowserToVSCodeMessage): Promise<MessageResponse> => {
    if (!connectionState.isConnected) {
      return {
        success: false,
        error: 'Not connected to VS Code server',
        timestamp: Date.now()
      };
    }

    try {
      // Forward message to VS Code
      webSocketClient.emit(message);

      return {
        success: true,
        data: { forwarded: true },
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

  /**
   * Handle messages from VS Code server
   */
  const handleVSCodeMessage = async (message: VSCodeToBrowserMessage) => {
    console.log('ConnAI Background: Received message from VS Code:', message.type);

    try {
      switch (message.type) {
        case 'UpdatedFile':
          // Broadcast to all tabs
          await broadcastToAllTabs(message);
          break;

        case 'SentFileTree':
          // Broadcast to all tabs
          await broadcastToAllTabs(message);
          break;

        case 'ContextResponse':
          // Broadcast to all tabs
          await broadcastToAllTabs(message);
          break;

        case 'ConnectionStatus':
          // Update connection state and broadcast
          connectionState.isConnected = message.payload.connected;
          await browser.storage.local.set({ 
            vscIsConnected: message.payload.connected,
            lastStatusUpdate: Date.now()
          });
          await broadcastToAllTabs(message);
          break;

        default:
          console.warn('ConnAI Background: Unknown VS Code message type:', (message as any).type);
      }
    } catch (error) {
      console.error('ConnAI Background: Error handling VS Code message:', error);
    }
  };

  // Set up WebSocket event handlers
  webSocketClient.on('message', handleVSCodeMessage);
  webSocketClient.on('UpdatedFile', handleVSCodeMessage);
  webSocketClient.on('SentFileTree', handleVSCodeMessage);
  webSocketClient.on('ContextResponse', handleVSCodeMessage);
  webSocketClient.on('connectionStatus', ({ connected }: { connected: boolean }) => {
    handleVSCodeMessage({
      id: Date.now().toString(),
      type: 'ConnectionStatus',
      timestamp: Date.now(),
      payload: { connected }
    });
  });

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

  // Handle extension startup
  browser.runtime.onStartup.addListener(() => {
    console.log('ConnAI Background: Extension startup');
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
