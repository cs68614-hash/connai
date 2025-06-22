/**
 * ConnAI Protocol Editor Adapter
 * 
 * Base interface and implementation for editor adapters
 */

import { EventEmitter } from 'events';
import { 
  ContextContract, 
  FileContract, 
  WorkspaceContract, 
  AuthContract,
  ContextType,
  FileOperation,
  WorkspaceOperation,
  AuthMethod
} from '../contracts/index.js';
import { ProtocolCapability, ProtocolConfig } from '../core/protocol.js';
import { TransportLayer } from '../core/transport-simple.js';

// Editor adapter information
export interface EditorAdapterInfo {
  name: string;
  version: string;
  editorName: string;
  editorVersion: string;
  platform: string;
  capabilities: ProtocolCapability[];
}

// Editor adapter configuration
export interface EditorAdapterConfig {
  info: EditorAdapterInfo;
  protocol: ProtocolConfig;
  transport?: TransportLayer;
  features?: {
    context?: boolean;
    files?: boolean;
    workspace?: boolean;
    auth?: boolean;
  };
}

// Editor adapter event types
export enum AdapterEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  CONTEXT_CHANGED = 'context_changed',
  FILE_CHANGED = 'file_changed',
  WORKSPACE_CHANGED = 'workspace_changed',
  AUTH_CHANGED = 'auth_changed'
}

// Base editor adapter interface
export interface EditorAdapter extends EventEmitter {
  /**
   * Get adapter information
   */
  getInfo(): EditorAdapterInfo;
  
  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;
  
  /**
   * Cleanup and dispose resources
   */
  dispose(): Promise<void>;
  
  /**
   * Check if adapter is ready
   */
  isReady(): boolean;
  
  /**
   * Get supported capabilities
   */
  getCapabilities(): ProtocolCapability[];
  
  /**
   * Check if capability is supported
   */
  hasCapability(capability: ProtocolCapability): boolean;
  
  /**
   * Get context contract (if supported)
   */
  getContextContract(): ContextContract | null;
  
  /**
   * Get file contract (if supported)
   */
  getFileContract(): FileContract | null;
  
  /**
   * Get workspace contract (if supported)
   */
  getWorkspaceContract(): WorkspaceContract | null;
  
  /**
   * Get authentication contract (if supported)
   */
  getAuthContract(): AuthContract | null;
  
  /**
   * Get transport layer
   */
  getTransport(): TransportLayer | null;
  
  /**
   * Set transport layer
   */
  setTransport(transport: TransportLayer): void;
  
  /**
   * Health check
   */
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
}

// Abstract base editor adapter
export abstract class BaseEditorAdapter extends EventEmitter implements EditorAdapter {
  protected config: EditorAdapterConfig;
  protected transport: TransportLayer | null = null;
  protected isInitialized = false;
  protected contextContract: ContextContract | null = null;
  protected fileContract: FileContract | null = null;
  protected workspaceContract: WorkspaceContract | null = null;
  protected authContract: AuthContract | null = null;

  constructor(config: EditorAdapterConfig) {
    super();
    this.config = config;
    this.transport = config.transport || null;
  }

  getInfo(): EditorAdapterInfo {
    return this.config.info;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize contracts based on features
      if (this.config.features?.context) {
        this.contextContract = this.createContextContract();
      }
      
      if (this.config.features?.files) {
        this.fileContract = this.createFileContract();
      }
      
      if (this.config.features?.workspace) {
        this.workspaceContract = this.createWorkspaceContract();
      }
      
      if (this.config.features?.auth) {
        this.authContract = this.createAuthContract();
      }

      // Initialize transport if available
      if (this.transport) {
        await this.transport.connect();
      }

      await this.onInitialize();
      this.isInitialized = true;
      this.emit(AdapterEvent.CONNECTED);
      
    } catch (error) {
      this.emit(AdapterEvent.ERROR, error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.onDispose();
      
      // Cleanup transport
      if (this.transport) {
        await this.transport.disconnect();
        this.transport.cleanup();
      }

      // Clear contracts
      this.contextContract = null;
      this.fileContract = null;
      this.workspaceContract = null;
      this.authContract = null;

      this.isInitialized = false;
      this.emit(AdapterEvent.DISCONNECTED);
      this.removeAllListeners();
      
    } catch (error) {
      this.emit(AdapterEvent.ERROR, error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getCapabilities(): ProtocolCapability[] {
    return this.config.info.capabilities;
  }

  hasCapability(capability: ProtocolCapability): boolean {
    return this.config.info.capabilities.includes(capability);
  }

  getContextContract(): ContextContract | null {
    return this.contextContract;
  }

  getFileContract(): FileContract | null {
    return this.fileContract;
  }

  getWorkspaceContract(): WorkspaceContract | null {
    return this.workspaceContract;
  }

  getAuthContract(): AuthContract | null {
    return this.authContract;
  }

  getTransport(): TransportLayer | null {
    return this.transport;
  }

  setTransport(transport: TransportLayer): void {
    this.transport = transport;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    const details: any = {
      initialized: this.isInitialized,
      capabilities: this.getCapabilities().length,
      contracts: {
        context: !!this.contextContract,
        file: !!this.fileContract,
        workspace: !!this.workspaceContract,
        auth: !!this.authContract
      },
      transport: !!this.transport
    };

    if (this.transport) {
      details.transportConnected = this.transport.isConnected();
      details.transportInfo = this.transport.getConnectionInfo();
    }

    const healthy = this.isInitialized && 
      (this.transport ? this.transport.isConnected() : true);

    return { healthy, details };
  }

  // Abstract methods to be implemented by concrete adapters
  protected abstract onInitialize(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
  protected abstract createContextContract(): ContextContract | null;
  protected abstract createFileContract(): FileContract | null;
  protected abstract createWorkspaceContract(): WorkspaceContract | null;
  protected abstract createAuthContract(): AuthContract | null;
}

// Adapter registry for managing multiple adapters
export class AdapterRegistry {
  private adapters: Map<string, EditorAdapter> = new Map();
  private activeAdapter: string | null = null;

  /**
   * Register an adapter
   */
  register(id: string, adapter: EditorAdapter): void {
    if (this.adapters.has(id)) {
      throw new Error(`Adapter with ID '${id}' is already registered`);
    }
    
    this.adapters.set(id, adapter);
    
    // Set as active if it's the first adapter
    if (!this.activeAdapter) {
      this.activeAdapter = id;
    }
  }

  /**
   * Unregister an adapter
   */
  async unregister(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (adapter) {
      await adapter.dispose();
      this.adapters.delete(id);
      
      if (this.activeAdapter === id) {
        const firstKey = this.adapters.keys().next().value;
        this.activeAdapter = this.adapters.size > 0 ? firstKey || null : null;
      }
    }
  }

  /**
   * Get adapter by ID
   */
  get(id: string): EditorAdapter | null {
    return this.adapters.get(id) || null;
  }

  /**
   * Get active adapter
   */
  getActive(): EditorAdapter | null {
    return this.activeAdapter ? this.get(this.activeAdapter) : null;
  }

  /**
   * Set active adapter
   */
  setActive(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Adapter with ID '${id}' is not registered`);
    }
    
    this.activeAdapter = id;
  }

  /**
   * List all registered adapters
   */
  list(): Array<{ id: string; adapter: EditorAdapter }> {
    return Array.from(this.adapters.entries()).map(([id, adapter]) => ({ id, adapter }));
  }

  /**
   * Get adapters by capability
   */
  getByCapability(capability: ProtocolCapability): Array<{ id: string; adapter: EditorAdapter }> {
    return this.list().filter(({ adapter }) => adapter.hasCapability(capability));
  }

  /**
   * Initialize all adapters
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.adapters.values()).map(adapter => adapter.initialize());
    await Promise.all(initPromises);
  }

  /**
   * Dispose all adapters
   */
  async disposeAll(): Promise<void> {
    const disposePromises = Array.from(this.adapters.values()).map(adapter => adapter.dispose());
    await Promise.all(disposePromises);
    this.adapters.clear();
    this.activeAdapter = null;
  }

  /**
   * Health check for all adapters
   */
  async healthCheckAll(): Promise<Record<string, { healthy: boolean; details?: any }>> {
    const results: Record<string, { healthy: boolean; details?: any }> = {};
    
    for (const [id, adapter] of this.adapters) {
      try {
        results[id] = await adapter.healthCheck();
      } catch (error) {
        results[id] = { 
          healthy: false, 
          details: { error: error instanceof Error ? error.message : 'Unknown error' } 
        };
      }
    }
    
    return results;
  }
}

// Default adapter registry instance
export const adapterRegistry = new AdapterRegistry();
