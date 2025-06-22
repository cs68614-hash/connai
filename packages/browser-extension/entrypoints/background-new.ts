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
