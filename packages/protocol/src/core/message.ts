/**
 * ConnAI Protocol Message System
 * 
 * Defines the standardized message format for communication between browsers and editors.
 */

import { MessageType, MessagePriority, ProtocolErrorCode } from './protocol.js';

// Base message interface - all messages must extend this
export interface BaseMessage {
  id: string;                    // Unique message identifier
  type: MessageType;             // Message type
  timestamp: number;             // Unix timestamp in milliseconds
  priority: MessagePriority;     // Message priority
  version: string;               // Protocol version
}

// Request message interface
export interface RequestMessage<T = any> extends BaseMessage {
  type: MessageType.REQUEST;
  operation: string;             // Operation name (e.g., 'get_context', 'read_file')
  payload: T;                   // Request payload
  timeout?: number;             // Request timeout in milliseconds
  metadata?: MessageMetadata;   // Additional metadata
}

// Response message interface
export interface ResponseMessage<T = any> extends BaseMessage {
  type: MessageType.RESPONSE;
  requestId: string;            // ID of the original request
  success: boolean;             // Operation success status
  payload?: T;                  // Response data (only present if success = true)
  error?: ProtocolErrorDetail;  // Error details (only present if success = false)
  metadata?: MessageMetadata;   // Additional metadata
}

// Event message interface
export interface EventMessage<T = any> extends BaseMessage {
  type: MessageType.EVENT;
  event: string;                // Event name
  payload: T;                   // Event data
  metadata?: MessageMetadata;   // Additional metadata
}

// Control message interfaces
export interface HandshakeMessage extends BaseMessage {
  type: MessageType.HANDSHAKE;
  clientInfo: ClientInfo;
  serverInfo?: ServerInfo;
  capabilities: string[];
}

export interface HeartbeatMessage extends BaseMessage {
  type: MessageType.HEARTBEAT;
  status: 'ping' | 'pong';
}

export interface DisconnectMessage extends BaseMessage {
  type: MessageType.DISCONNECT;
  reason: string;
  code?: number;
}

// Union type for all message types
export type ProtocolMessage = 
  | RequestMessage
  | ResponseMessage
  | EventMessage
  | HandshakeMessage
  | HeartbeatMessage
  | DisconnectMessage;

// Message metadata interface
export interface MessageMetadata {
  workspaceId?: string;         // Target workspace ID
  editorId?: string;            // Target editor instance ID
  userId?: string;              // User identifier
  sessionId?: string;           // Session identifier
  traceId?: string;             // Distributed tracing ID
  tags?: Record<string, string>; // Custom tags
}

// Error detail interface
export interface ProtocolErrorDetail {
  code: ProtocolErrorCode;
  message: string;
  details?: any;
  stack?: string;
  timestamp: number;
}

// Client information interface
export interface ClientInfo {
  name: string;                 // Client name (e.g., 'chrome-extension')
  version: string;              // Client version
  platform: string;            // Platform (e.g., 'browser', 'desktop')
  capabilities: string[];       // Supported capabilities
  userAgent?: string;           // User agent string
}

// Server information interface
export interface ServerInfo {
  name: string;                 // Server name (e.g., 'vscode-extension')
  version: string;              // Server version
  editorName: string;           // Editor name (e.g., 'vscode')
  editorVersion: string;        // Editor version
  capabilities: string[];       // Supported capabilities
}

// Message validation schema
export interface MessageSchema {
  type: MessageType;
  requiredFields: string[];
  optionalFields: string[];
  payloadSchema?: any;          // JSON schema for payload validation
}

// Message factory class
export class MessageFactory {
  private static messageCounter = 0;
  
  /**
   * Generate a unique message ID
   */
  static generateId(): string {
    const timestamp = Date.now();
    const counter = ++this.messageCounter;
    return `msg_${timestamp}_${counter}`;
  }
  
  /**
   * Create a request message
   */
  static createRequest<T>(
    operation: string,
    payload: T,
    options: {
      timeout?: number;
      priority?: MessagePriority;
      metadata?: MessageMetadata;
      version?: string;
    } = {}
  ): RequestMessage<T> {
    return {
      id: this.generateId(),
      type: MessageType.REQUEST,
      operation,
      payload,
      timestamp: Date.now(),
      priority: options.priority || MessagePriority.NORMAL,
      version: options.version || '1.0.0',
      timeout: options.timeout,
      metadata: options.metadata
    };
  }
  
  /**
   * Create a response message
   */
  static createResponse<T>(
    requestId: string,
    result: { success: true; data: T } | { success: false; error: ProtocolErrorDetail },
    options: {
      priority?: MessagePriority;
      metadata?: MessageMetadata;
      version?: string;
    } = {}
  ): ResponseMessage<T> {
    const base = {
      id: this.generateId(),
      type: MessageType.RESPONSE as MessageType.RESPONSE,
      requestId,
      timestamp: Date.now(),
      priority: options.priority || MessagePriority.NORMAL,
      version: options.version || '1.0.0',
      metadata: options.metadata
    };
    
    if (result.success) {
      return {
        ...base,
        success: true,
        payload: result.data
      } as ResponseMessage<T>;
    } else {
      return {
        ...base,
        success: false,
        error: result.error
      } as ResponseMessage<T>;
    }
  }
  
  /**
   * Create an event message
   */
  static createEvent<T>(
    event: string,
    payload: T,
    options: {
      priority?: MessagePriority;
      metadata?: MessageMetadata;
      version?: string;
    } = {}
  ): EventMessage<T> {
    return {
      id: this.generateId(),
      type: MessageType.EVENT,
      event,
      payload,
      timestamp: Date.now(),
      priority: options.priority || MessagePriority.NORMAL,
      version: options.version || '1.0.0',
      metadata: options.metadata
    };
  }
  
  /**
   * Create a handshake message
   */
  static createHandshake(
    clientInfo: ClientInfo,
    serverInfo?: ServerInfo,
    capabilities: string[] = []
  ): HandshakeMessage {
    return {
      id: this.generateId(),
      type: MessageType.HANDSHAKE,
      timestamp: Date.now(),
      priority: MessagePriority.HIGH,
      version: '1.0.0',
      clientInfo,
      serverInfo,
      capabilities
    };
  }
  
  /**
   * Create a heartbeat message
   */
  static createHeartbeat(status: 'ping' | 'pong' = 'ping'): HeartbeatMessage {
    return {
      id: this.generateId(),
      type: MessageType.HEARTBEAT,
      timestamp: Date.now(),
      priority: MessagePriority.LOW,
      version: '1.0.0',
      status
    };
  }
  
  /**
   * Create a disconnect message
   */
  static createDisconnect(reason: string, code?: number): DisconnectMessage {
    return {
      id: this.generateId(),
      type: MessageType.DISCONNECT,
      timestamp: Date.now(),
      priority: MessagePriority.HIGH,
      version: '1.0.0',
      reason,
      code
    };
  }
}

// Message validator class
export class MessageValidator {
  /**
   * Validate a protocol message
   */
  static validate(message: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required base fields
    if (!message.id) errors.push('Message ID is required');
    if (!message.type) errors.push('Message type is required');
    if (!message.timestamp) errors.push('Message timestamp is required');
    if (message.priority === undefined) errors.push('Message priority is required');
    if (!message.version) errors.push('Message version is required');
    
    // Validate message type
    if (message.type && !Object.values(MessageType).includes(message.type)) {
      errors.push('Invalid message type');
    }
    
    // Validate priority
    if (message.priority !== undefined && !Object.values(MessagePriority).includes(message.priority)) {
      errors.push('Invalid message priority');
    }
    
    // Type-specific validation
    switch (message.type) {
      case MessageType.REQUEST:
        if (!message.operation) errors.push('Request operation is required');
        if (message.payload === undefined) errors.push('Request payload is required');
        break;
        
      case MessageType.RESPONSE:
        if (!message.requestId) errors.push('Response requestId is required');
        if (message.success === undefined) errors.push('Response success status is required');
        break;
        
      case MessageType.EVENT:
        if (!message.event) errors.push('Event name is required');
        if (message.payload === undefined) errors.push('Event payload is required');
        break;
        
      case MessageType.HANDSHAKE:
        if (!message.clientInfo) errors.push('Handshake clientInfo is required');
        if (!message.capabilities) errors.push('Handshake capabilities are required');
        break;
        
      case MessageType.HEARTBEAT:
        if (!message.status) errors.push('Heartbeat status is required');
        if (!['ping', 'pong'].includes(message.status)) {
          errors.push('Heartbeat status must be "ping" or "pong"');
        }
        break;
        
      case MessageType.DISCONNECT:
        if (!message.reason) errors.push('Disconnect reason is required');
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
