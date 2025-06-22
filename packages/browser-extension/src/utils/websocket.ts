import { io, Socket } from 'socket.io-client';
import type { AuthInfo, ConnectionOptions, BrowserToVSCodeMessage, VSCodeToBrowserMessage } from '../types/messages';

/**
 * WebSocket client for connecting to VS Code server
 * Implements singleton pattern and transport upgrade
 */
export class WebSocketClient {
  private static instance: WebSocketClient | null = null;
  private socket: Socket | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  /**
   * Connect to VS Code server with transport upgrade support
   */
  async connect(options: ConnectionOptions = {}): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnected && this.socket?.connected) {
      return Promise.resolve();
    }

    this.connectionPromise = this._establishConnection(options);
    
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _establishConnection(options: ConnectionOptions): Promise<void> {
    const {
      serverUrl = 'http://localhost:3000',
      auth,
      timeout = 10000,
      retryAttempts = 3
    } = options;

    // Disconnect existing connection
    if (this.socket) {
      this.socket.disconnect();
    }

    // Create socket with transport upgrade configuration
    this.socket = io(serverUrl, {
      auth: auth || this._getDefaultAuth(),
      timeout,
      transports: ['websocket', 'polling'], // Start with WebSocket, fallback to polling
      upgrade: true, // Enable transport upgrade
      rememberUpgrade: true, // Remember successful upgrade
      forceNew: true,
      // Advanced transport upgrade configuration
      transportOptions: {
        websocket: {
          upgrade: true,
        },
        webtransport: {
          upgrade: true,
        }
      }
    });

    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      let timeoutId: NodeJS.Timeout | null = null;
      let attempts = 0;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const attemptConnection = () => {
        attempts++;
        
        timeoutId = setTimeout(() => {
          if (attempts < retryAttempts) {
            console.log(`ConnAI: Connection attempt ${attempts} failed, retrying...`);
            attemptConnection();
          } else {
            cleanup();
            reject(new Error(`Connection failed after ${retryAttempts} attempts`));
          }
        }, timeout);
      };

      // Handle successful connection
      this.socket.on('connect', () => {
        cleanup();
        this.isConnected = true;
        console.log('ConnAI: Connected to VS Code server');
        console.log('ConnAI: Transport:', this.socket?.io.engine.transport.name);
        
        // Log transport upgrades
        this.socket?.io.engine.on('upgrade', (transport) => {
          console.log('ConnAI: Transport upgraded to:', transport.name);
        });

        this._setupEventHandlers();
        resolve();
      });

      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        console.error('ConnAI: Connection error:', error);
        if (attempts >= retryAttempts) {
          cleanup();
          reject(error);
        }
      });

      // Handle disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('ConnAI: Disconnected from VS Code server:', reason);
        this.isConnected = false;
        this._notifyConnectionStatus(false);
      });

      // Start connection attempt
      attemptConnection();
    });
  }

  private _getDefaultAuth(): AuthInfo {
    return {
      clientType: 'web',
      sessionId: this._generateSessionId(),
      membershipId: undefined // Will be populated by auth system
    };
  }

  private _generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private _setupEventHandlers(): void {
    if (!this.socket) return;

    // Listen for VS Code messages
    this.socket.on('message', (message: VSCodeToBrowserMessage) => {
      console.log('ConnAI: Received message from VS Code:', message.type);
      this._handleVSCodeMessage(message);
    });

    // Handle VS Code-specific events
    this.socket.on('UpdatedFile', (message: VSCodeToBrowserMessage) => {
      this._handleVSCodeMessage(message);
    });

    this.socket.on('SentFileTree', (message: VSCodeToBrowserMessage) => {
      this._handleVSCodeMessage(message);
    });

    this.socket.on('ContextResponse', (message: VSCodeToBrowserMessage) => {
      this._handleVSCodeMessage(message);
    });
  }

  private _handleVSCodeMessage(message: VSCodeToBrowserMessage): void {
    // Notify all registered handlers
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('ConnAI: Error in message handler:', error);
      }
    });

    // Also trigger generic 'message' handlers  
    const genericHandlers = this.eventHandlers.get('message') || [];
    genericHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('ConnAI: Error in generic message handler:', error);
      }
    });
  }

  private _notifyConnectionStatus(connected: boolean): void {
    const handlers = this.eventHandlers.get('connectionStatus') || [];
    handlers.forEach(handler => {
      try {
        handler({ connected });
      } catch (error) {
        console.error('ConnAI: Error in connection status handler:', error);
      }
    });
  }

  /**
   * Send message to VS Code server
   */
  emit(message: BrowserToVSCodeMessage): void {
    if (!this.socket || !this.isConnected) {
      console.error('ConnAI: Cannot send message - not connected to VS Code server');
      return;
    }

    console.log('ConnAI: Sending message to VS Code:', message.type);
    this.socket.emit('message', message);
    
    // Also emit specific event type for server-side routing
    this.socket.emit(message.type, message);
  }

  /**
   * Register event handler
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get transport name
   */
  get transport(): string | undefined {
    return this.socket?.io.engine.transport.name;
  }
}

/**
 * Get WebSocket client singleton instance
 */
export function getWebSocketClient(): WebSocketClient {
  return WebSocketClient.getInstance();
}
