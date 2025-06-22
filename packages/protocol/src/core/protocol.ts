/**
 * ConnAI Protocol Core
 * 
 * This module defines the core protocol for communication between browsers and editors.
 * It provides a standardized, editor-agnostic interface for context sharing and collaboration.
 */

// Protocol version following semantic versioning
export const PROTOCOL_VERSION = '1.0.0';

// Protocol capabilities
export enum ProtocolCapability {
  // File operations
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_file',
  WATCH_FILE = 'watch_file',
  
  // Context operations
  GET_CONTEXT = 'get_context',
  STREAM_CONTEXT = 'stream_context',
  
  // Search operations
  SEARCH_FILES = 'search_files',
  GREP_SEARCH = 'grep_search',
  SEMANTIC_SEARCH = 'semantic_search',
  
  // Workspace operations
  GET_WORKSPACE_INFO = 'get_workspace_info',
  LIST_WORKSPACES = 'list_workspaces',
  SWITCH_WORKSPACE = 'switch_workspace',
  
  // Editor operations
  GET_EDITOR_STATE = 'get_editor_state',
  SET_CURSOR_POSITION = 'set_cursor_position',
  INSERT_TEXT = 'insert_text',
  
  // Diagnostic operations
  GET_DIAGNOSTICS = 'get_diagnostics',
  GET_PROBLEMS = 'get_problems',
  
  // Authentication
  AUTHENTICATE = 'authenticate',
  REFRESH_TOKEN = 'refresh_token'
}

// Protocol error codes
export enum ProtocolErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  PROTOCOL_VERSION_MISMATCH = 'PROTOCOL_VERSION_MISMATCH',
  
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  
  // Authentication errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // File operation errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  
  // Workspace errors
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED = 'WORKSPACE_ACCESS_DENIED',
  INVALID_WORKSPACE = 'INVALID_WORKSPACE',
  
  // Context errors
  CONTEXT_NOT_AVAILABLE = 'CONTEXT_NOT_AVAILABLE',
  CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',
  INVALID_CONTEXT_TYPE = 'INVALID_CONTEXT_TYPE'
}

// Protocol message priority levels
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3
}

// Protocol message types
export enum MessageType {
  // Request/Response pattern
  REQUEST = 'request',
  RESPONSE = 'response',
  
  // Event pattern
  EVENT = 'event',
  
  // Control messages
  HANDSHAKE = 'handshake',
  HEARTBEAT = 'heartbeat',
  DISCONNECT = 'disconnect'
}

// Protocol configuration interface
export interface ProtocolConfig {
  version: string;
  capabilities: ProtocolCapability[];
  transport: {
    type: 'websocket' | 'http' | 'ipc';
    endpoint: string;
    timeout: number;
    retryAttempts: number;
  };
  authentication?: {
    required: boolean;
    method: 'token' | 'oauth' | 'certificate';
    endpoint?: string;
  };
  limits: {
    maxMessageSize: number; // bytes
    maxConcurrentRequests: number;
    rateLimitPerSecond: number;
  };
  features: {
    compression: boolean;
    encryption: boolean;
    batchRequests: boolean;
  };
}

// Default protocol configuration
export const DEFAULT_PROTOCOL_CONFIG: ProtocolConfig = {
  version: PROTOCOL_VERSION,
  capabilities: [
    ProtocolCapability.READ_FILE,
    ProtocolCapability.GET_CONTEXT,
    ProtocolCapability.SEARCH_FILES,
    ProtocolCapability.GET_WORKSPACE_INFO,
    ProtocolCapability.GET_EDITOR_STATE,
    ProtocolCapability.GET_DIAGNOSTICS
  ],
  transport: {
    type: 'websocket',
    endpoint: 'ws://localhost:3000',
    timeout: 10000,
    retryAttempts: 3
  },
  limits: {
    maxMessageSize: 10 * 1024 * 1024, // 10MB
    maxConcurrentRequests: 10,
    rateLimitPerSecond: 100
  },
  features: {
    compression: true,
    encryption: false,
    batchRequests: true
  }
};

// Protocol validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Protocol error class
export class ProtocolError extends Error {
  constructor(
    public code: ProtocolErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

// Protocol utility functions
export class ProtocolUtils {
  /**
   * Check if a capability is supported
   */
  static hasCapability(config: ProtocolConfig, capability: ProtocolCapability): boolean {
    return config.capabilities.includes(capability);
  }
  
  /**
   * Validate protocol version compatibility
   */
  static isVersionCompatible(clientVersion: string, serverVersion: string): boolean {
    const [clientMajor] = clientVersion.split('.').map(Number);
    const [serverMajor] = serverVersion.split('.').map(Number);
    
    // Major versions must match for compatibility
    return clientMajor === serverMajor;
  }
  
  /**
   * Create a protocol error
   */
  static createError(code: ProtocolErrorCode, message: string, details?: any): ProtocolError {
    return new ProtocolError(code, message, details);
  }
  
  /**
   * Validate protocol configuration
   */
  static validateConfig(config: Partial<ProtocolConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate version
    if (!config.version) {
      errors.push('Protocol version is required');
    } else if (!config.version.match(/^\d+\.\d+\.\d+$/)) {
      errors.push('Protocol version must follow semantic versioning (x.y.z)');
    }
    
    // Validate capabilities
    if (!config.capabilities || config.capabilities.length === 0) {
      warnings.push('No capabilities specified');
    }
    
    // Validate transport
    if (!config.transport) {
      errors.push('Transport configuration is required');
    } else {
      if (!config.transport.endpoint) {
        errors.push('Transport endpoint is required');
      }
      if (config.transport.timeout <= 0) {
        errors.push('Transport timeout must be positive');
      }
    }
    
    // Validate limits
    if (config.limits) {
      if (config.limits.maxMessageSize <= 0) {
        errors.push('Maximum message size must be positive');
      }
      if (config.limits.maxConcurrentRequests <= 0) {
        errors.push('Maximum concurrent requests must be positive');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
