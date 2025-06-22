/**
 * ConnAI Protocol Core Module
 * 
 * Export all core protocol components
 */

export * from './protocol.js';
export * from './message.js';
export { TransportLayer, HttpTransport, createTransport } from './transport-simple.js';
export type { 
  TransportConfig, 
  ConnectionInfo, 
  TransportStats, 
  MessageHandler,
  TransportState,
  TransportEvent
} from './transport-simple.js';
