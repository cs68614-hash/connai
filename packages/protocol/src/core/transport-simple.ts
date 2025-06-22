/**
 * ConnAI Protocol Transport Layer
 * 
 * Provides a simplified abstraction layer for different transport mechanisms
 */

import { EventEmitter } from 'events';
import { ProtocolMessage, ResponseMessage, RequestMessage } from './message.js';
import { ProtocolError, ProtocolErrorCode } from './protocol.js';

// Transport connection states
export enum TransportState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

// Transport configuration interface
export interface TransportConfig {
  endpoint: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  keepAlive?: boolean;
  keepAliveInterval?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  headers?: Record<string, string>;
  protocols?: string[];
}

// Transport connection info
export interface ConnectionInfo {
  id: string;
  endpoint: string;
  state: TransportState;
  connectedAt?: number;
  lastActivity?: number;
  reconnectAttempts?: number;
  latency?: number;
}

// Transport statistics
export interface TransportStats {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  reconnectCount: number;
  lastError?: string;
  uptime: number;
}

// Transport event names
export enum TransportEvent {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  MESSAGE = 'message',
  ERROR = 'error',
  STATS_UPDATE = 'stats_update'
}

// Message handler type
export type MessageHandler = (message: ProtocolMessage) => void | Promise<void>;

// Abstract transport layer interface
export abstract class TransportLayer extends EventEmitter {
  protected config: TransportConfig;
  protected connectionInfo: ConnectionInfo;
  protected stats: TransportStats;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private pendingRequests: Map<string, {
    resolve: (response: ResponseMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: TransportConfig) {
    super();
    this.config = config;
    this.connectionInfo = {
      id: this.generateConnectionId(),
      endpoint: config.endpoint,
      state: TransportState.DISCONNECTED
    };
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      reconnectCount: 0,
      uptime: 0
    };
  }

  // Abstract methods to be implemented by concrete transport classes
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendRaw(data: string | Buffer): Promise<void>;
  abstract isConnected(): boolean;

  /**
   * Send a message and wait for response
   */
  async send<T = any>(message: RequestMessage): Promise<ResponseMessage<T>> {
    if (!this.isConnected()) {
      throw new ProtocolError(
        ProtocolErrorCode.CONNECTION_FAILED,
        'Transport is not connected'
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new ProtocolError(
          ProtocolErrorCode.CONNECTION_TIMEOUT,
          `Request ${message.id} timed out after ${message.timeout || this.config.timeout}ms`
        ));
      }, message.timeout || this.config.timeout);

      this.pendingRequests.set(message.id, {
        resolve: resolve as any,
        reject,
        timeout
      });

      this.sendMessage(message).catch(reject);
    });
  }

  /**
   * Send a message without waiting for response
   */
  async sendMessage(message: ProtocolMessage): Promise<void> {
    const data = JSON.stringify(message);
    await this.sendRaw(data);
    
    this.stats.messagesSent++;
    this.stats.bytesSent += data.length;
    this.emit(TransportEvent.STATS_UPDATE, this.stats);
  }

  /**
   * Subscribe to messages of a specific type
   */
  subscribe(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Handle incoming raw data
   */
  protected handleRawMessage(data: string | Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as ProtocolMessage;
      this.handleMessage(message);
      
      this.stats.messagesReceived++;
      this.stats.bytesReceived += data.length;
      this.connectionInfo.lastActivity = Date.now();
      
    } catch (error) {
      this.emit(TransportEvent.ERROR, new ProtocolError(
        ProtocolErrorCode.INVALID_REQUEST,
        'Failed to parse message',
        error
      ));
    }
  }

  /**
   * Handle parsed protocol message
   */
  private handleMessage(message: ProtocolMessage): void {
    // Handle response messages for pending requests
    if (message.type === 'response') {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.requestId);
        pending.resolve(message as ResponseMessage);
        return;
      }
    }

    // Emit message event
    this.emit(TransportEvent.MESSAGE, message);

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          const result = handler(message);
          if (result instanceof Promise) {
            result.catch(error => {
              this.emit(TransportEvent.ERROR, error);
            });
          }
        } catch (error) {
          this.emit(TransportEvent.ERROR, error);
        }
      });
    }
  }

  /**
   * Update connection state
   */
  protected updateState(state: TransportState): void {
    const previousState = this.connectionInfo.state;
    this.connectionInfo.state = state;

    if (state === TransportState.CONNECTED && previousState !== TransportState.CONNECTED) {
      this.connectionInfo.connectedAt = Date.now();
      this.emit(TransportEvent.CONNECTED, this.connectionInfo);
    } else if (state === TransportState.DISCONNECTED && previousState !== TransportState.DISCONNECTED) {
      this.emit(TransportEvent.DISCONNECTED, this.connectionInfo);
    } else if (state === TransportState.RECONNECTING) {
      this.connectionInfo.reconnectAttempts = (this.connectionInfo.reconnectAttempts || 0) + 1;
      this.stats.reconnectCount++;
      this.emit(TransportEvent.RECONNECTING, this.connectionInfo);
    }
  }

  /**
   * Get current connection info
   */
  getConnectionInfo(): ConnectionInfo {
    return { ...this.connectionInfo };
  }

  /**
   * Get transport statistics
   */
  getStats(): TransportStats {
    return {
      ...this.stats,
      uptime: this.connectionInfo.connectedAt 
        ? Date.now() - this.connectionInfo.connectedAt 
        : 0
    };
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all pending requests
    this.pendingRequests.forEach(({ timeout, reject }) => {
      clearTimeout(timeout);
      reject(new ProtocolError(
        ProtocolErrorCode.CONNECTION_LOST,
        'Transport is being cleaned up'
      ));
    });
    this.pendingRequests.clear();

    // Clear all message handlers
    this.messageHandlers.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }
}

// HTTP transport implementation
export class HttpTransport extends TransportLayer {
  async connect(): Promise<void> {
    this.updateState(TransportState.CONNECTED);
  }

  async disconnect(): Promise<void> {
    this.updateState(TransportState.DISCONNECTED);
  }

  async sendRaw(data: string | Buffer): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: data.toString()
    });

    if (!response.ok) {
      throw new ProtocolError(
        ProtocolErrorCode.CONNECTION_FAILED,
        `HTTP request failed: ${response.status} ${response.statusText}`
      );
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      const responseData = await response.text();
      this.handleRawMessage(responseData);
    }
  }

  isConnected(): boolean {
    return this.connectionInfo.state === TransportState.CONNECTED;
  }
}

// Factory function to create transport instances
export function createTransport(
  type: 'websocket' | 'http',
  config: TransportConfig,
  options?: { WebSocketConstructor?: any }
): TransportLayer {
  switch (type) {
    case 'websocket':
      return createWebSocketTransport(config, options?.WebSocketConstructor);
    case 'http':
      return new HttpTransport(config);
    default:
      throw new ProtocolError(
        ProtocolErrorCode.UNSUPPORTED_OPERATION,
        `Unsupported transport type: ${type}`
      );
  }
}

// WebSocket transport factory
function createWebSocketTransport(config: TransportConfig, WebSocketConstructor?: any): TransportLayer {
  class WebSocketTransport extends TransportLayer {
    private ws: any = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private WebSocketClass: any;

    constructor(config: TransportConfig) {
      super(config);
      this.WebSocketClass = WebSocketConstructor || 
        (typeof globalThis !== 'undefined' && (globalThis as any).WebSocket) ||
        null;
      
      if (!this.WebSocketClass) {
        throw new ProtocolError(
          ProtocolErrorCode.UNSUPPORTED_OPERATION,
          'WebSocket is not available in this environment'
        );
      }
    }

    async connect(): Promise<void> {
      if (this.connectionInfo.state === TransportState.CONNECTED) {
        return;
      }

      this.updateState(TransportState.CONNECTING);

      return new Promise((resolve, reject) => {
        try {
          this.ws = new this.WebSocketClass(this.config.endpoint, this.config.protocols);
          
          this.ws.onopen = () => {
            this.updateState(TransportState.CONNECTED);
            resolve();
          };

          this.ws.onmessage = (event: any) => {
            this.handleRawMessage(event.data);
          };

          this.ws.onclose = () => {
            this.updateState(TransportState.DISCONNECTED);
            this.scheduleReconnect();
          };

          this.ws.onerror = (error: any) => {
            this.updateState(TransportState.FAILED);
            this.emit(TransportEvent.ERROR, new ProtocolError(
              ProtocolErrorCode.CONNECTION_FAILED,
              'WebSocket connection failed',
              error
            ));
            reject(error);
          };

          setTimeout(() => {
            if (this.connectionInfo.state === TransportState.CONNECTING) {
              this.ws?.close();
              reject(new ProtocolError(
                ProtocolErrorCode.CONNECTION_TIMEOUT,
                'Connection timeout'
              ));
            }
          }, this.config.timeout);

        } catch (error) {
          this.updateState(TransportState.FAILED);
          reject(error);
        }
      });
    }

    async disconnect(): Promise<void> {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.updateState(TransportState.DISCONNECTED);
    }

    async sendRaw(data: string | Buffer): Promise<void> {
      if (!this.ws || this.ws.readyState !== 1) {
        throw new ProtocolError(
          ProtocolErrorCode.CONNECTION_FAILED,
          'WebSocket is not connected'
        );
      }

      this.ws.send(data.toString());
    }

    isConnected(): boolean {
      return this.ws?.readyState === 1;
    }

    private scheduleReconnect(): void {
      if (this.config.maxReconnectAttempts && 
          (this.connectionInfo.reconnectAttempts || 0) >= this.config.maxReconnectAttempts) {
        return;
      }

      const delay = this.config.reconnectDelay || 5000;
      this.reconnectTimer = setTimeout(() => {
        this.updateState(TransportState.RECONNECTING);
        this.connect().catch(error => {
          this.emit(TransportEvent.ERROR, error);
        });
      }, delay);
    }
  }

  return new WebSocketTransport(config);
}
