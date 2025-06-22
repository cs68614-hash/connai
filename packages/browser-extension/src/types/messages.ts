// Message types for communication between content scripts, background, and VS Code
export interface BaseMessage {
  id: string;
  timestamp: number;
}

// Browser -> VS Code messages
export interface GetFileMessage extends BaseMessage {
  type: 'GetFile';
  payload: {
    filePath: string;
    workspaceId?: string;
  };
}

export interface GrepMessage extends BaseMessage {
  type: 'Grep';
  payload: {
    pattern: string;
    options?: {
      caseSensitive?: boolean;
      regex?: boolean;
      includePattern?: string;
      excludePattern?: string;
    };
    workspaceId?: string;
  };
}

export interface GetContextMessage extends BaseMessage {
  type: 'GetContext';
  payload: {
    contextType: 'focused-file' | 'selected-text' | 'all-open-tabs' | 'problems' | 'user-rules' | 'file-tree' | 'full-codebase';
    options?: any;
    workspaceId?: string;
  };
}

export interface ConnectMessage extends BaseMessage {
  type: 'Connect';
  payload: {
    force?: boolean;
    serverUrl?: string;
    port?: number;
  };
}

export interface DisconnectMessage extends BaseMessage {
  type: 'Disconnect';
  payload: {};
}

// VS Code -> Browser messages
export interface UpdatedFileMessage extends BaseMessage {
  type: 'UpdatedFile';
  payload: {
    filePath: string;
    content: string;
    workspaceId: string;
  };
}

export interface SentFileTreeMessage extends BaseMessage {
  type: 'SentFileTree';
  payload: {
    tree: FileTreeNode[];
    workspaceId: string;
  };
}

export interface ContextResponseMessage extends BaseMessage {
  type: 'ContextResponse';
  payload: {
    contextType: string;
    data: any;
    metadata: {
      tokenCount: number;
      timestamp: number;
      workspaceId: string;
      source: string;
    };
    error?: string;
  };
}

export interface ConnectionStatusMessage extends BaseMessage {
  type: 'ConnectionStatus';
  payload: {
    connected: boolean;
    workspaceId?: string;
    error?: string;
  };
}

// Union types
export type BrowserToVSCodeMessage = 
  | GetFileMessage 
  | GrepMessage 
  | GetContextMessage 
  | ConnectMessage 
  | DisconnectMessage;

export type VSCodeToBrowserMessage = 
  | UpdatedFileMessage 
  | SentFileTreeMessage 
  | ContextResponseMessage 
  | ConnectionStatusMessage;

export type Message = BrowserToVSCodeMessage | VSCodeToBrowserMessage;

// Helper interfaces
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  lastModified?: number;
}

export interface AuthInfo {
  clientType: 'web';
  sessionId: string;
  membershipId?: string;
}

export interface ConnectionOptions {
  serverUrl?: string;
  auth?: AuthInfo;
  timeout?: number;
  retryAttempts?: number;
}

// Response wrapper for content script responses
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
