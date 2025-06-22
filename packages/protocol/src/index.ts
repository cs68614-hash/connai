/**
 * ConnAI Protocol Package
 * 
 * Main entry point for the ConnAI communication protocol
 */

// Core protocol
export * from './core/index.js';

// Contracts
export * from './contracts/index.js';

// Adapters
export * from './adapters/index.js';

// Re-export commonly used types and utilities
export {
  PROTOCOL_VERSION,
  DEFAULT_PROTOCOL_CONFIG,
  ProtocolUtils,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolCapability,
  MessagePriority,
  MessageType
} from './core/protocol.js';

export {
  MessageFactory,
  MessageValidator
} from './core/message.js';

export {
  createTransport,
  TransportState,
  TransportEvent
} from './core/transport-simple.js';

export {
  ContextType,
  ContextUtils
} from './contracts/context.js';

export {
  FileOperation,
  FileUtils
} from './contracts/file.js';

export {
  WorkspaceOperation,
  WorkspaceUtils
} from './contracts/workspace.js';

export {
  AuthMethod,
  AuthStatus,
  AuthUtils
} from './contracts/auth.js';

export {
  adapterRegistry,
  AdapterEvent
} from './adapters/base.js';

export {
  createVSCodeAdapter
} from './adapters/vscode.js';
