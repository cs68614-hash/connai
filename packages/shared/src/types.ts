/**
 * 共享类型定义 - 用于 VS Code 扩展和浏览器扩展之间的通信
 */

// VS Code 相关类型
export interface VSCEntry {
  uri: string;
  type: 'file' | 'directory';
  name: string;
  path: string;
  size?: number;
  lastModified?: number;
}

export interface FileContext {
  uri: string;
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: number;
  encoding?: string;
}

export interface FolderContext {
  uri: string;
  name: string;
  path: string;
  entries: VSCEntry[];
  totalFiles: number;
  totalSize: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  lastModified?: number;
}

export interface CursorContext {
  activeEditor?: {
    uri: string;
    fileName: string;
    language: string;
    selection: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    selectedText?: string;
    visibleRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
  openEditors: string[];
}

export interface DiagnosticInfo {
  uri: string;
  fileName: string;
  diagnostics: {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    severity: number;
    message: string;
    source?: string;
    code?: string | number;
  }[];
}

export interface RecentChange {
  uri: string;
  fileName: string;
  timestamp: number;
  changes: {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    rangeOffset: number;
    rangeLength: number;
    text: string;
  }[];
}

export interface WorkspaceSnapshot {
  workspaceFolders: string[];
  openFiles: string[];
  activeFile?: string;
  cursor: CursorContext;
  diagnostics: DiagnosticInfo[];
  recentChanges: RecentChange[];
  timestamp: number;
}

// 工作区信息类型
export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  folders: readonly {
    name: string;
    path: string;
    index: number;
  }[];
  port: number;
  isActive: boolean;
  lastActivity: Date;
}

// 通信协议类型
export interface Message {
  type: MessageType;
  id?: string;
  data?: any;
  timestamp: number;
  workspaceId?: string;
  error?: string;
}

export interface WebSocketMessage extends Message {
  sessionId?: string;
}

// 消息类型枚举
export enum MessageType {
  // 认证相关
  AUTH_REQUEST = 'auth_request',
  AUTH_RESPONSE = 'auth_response',
  AUTHENTICATE = 'authenticate',
  AUTH_STATUS = 'auth_status',
  
  // 上下文请求
  GET_WORKSPACE_SNAPSHOT = 'get_workspace_snapshot',
  GET_FILE_CONTENT = 'get_file_content',
  GET_FOLDER_CONTENT = 'get_folder_content',
  GET_FILE_TREE = 'get_file_tree',
  GET_CURSOR_CONTEXT = 'get_cursor_context',
  GET_DIAGNOSTICS = 'get_diagnostics',
  GET_RECENT_CHANGES = 'get_recent_changes',
  
  // 上下文响应
  CONTEXT_RESPONSE = 'context_response',
  FILE_RESPONSE = 'file_response',
  SEARCH_RESPONSE = 'search_response',
  
  // 文件操作
  WRITE_FILE = 'write_file',
  EDIT_FILE = 'edit_file',
  DELETE_FILE = 'delete_file',
  CREATE_FILE = 'create_file',
  
  // 搜索相关
  GREP_SEARCH = 'grep_search',
  FILE_SEARCH = 'file_search',
  
  // 命令执行
  EXECUTE_COMMAND = 'execute_command',
  COMMAND_RESPONSE = 'command_response',
  
  // 状态管理
  STATUS_UPDATE = 'status_update',
  CONNECTION_STATUS = 'connection_status',
  
  // 实时更新
  WORKSPACE_CHANGED = 'workspace_changed',
  FILE_CHANGED = 'file_changed',
  CURSOR_CHANGED = 'cursor_changed',
  
  // 错误处理
  ERROR = 'error',
  
  // 心跳检测
  PING = 'ping',
  PONG = 'pong'
}

// 认证状态类型
export interface AuthState {
  isAuthenticated: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
  expiresAt?: number;
}

// 服务器配置类型
export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[] | boolean | string;
    credentials: boolean;
    methods?: string[];
    allowedHeaders?: string[];
  };
}

// 上下文数据类型（用于浏览器扩展）
export interface ContextData {
  id: string;
  type: ContextType;
  metadata: {
    source: string;
    timestamp: number;
    tokenCount?: number;
    workspaceId?: string;
  };
  content: string | FileContext | FolderContext | WorkspaceSnapshot;
  preview?: string;
}

export enum ContextType {
  FILE = 'file',
  FOLDER = 'folder',
  WORKSPACE = 'workspace',
  CURSOR = 'cursor',
  DIAGNOSTICS = 'diagnostics',
  RECENT_CHANGES = 'recent_changes',
  GITHUB_REPO = 'github_repo',
  BROWSER_TAB = 'browser_tab'
}

// 错误类型
export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  AUTH_ERROR = 'auth_error',
  PERMISSION_ERROR = 'permission_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  CONTEXT_TOO_LARGE = 'context_too_large',
  INVALID_REQUEST = 'invalid_request',
  FILE_NOT_FOUND = 'file_not_found',
  WORKSPACE_NOT_FOUND = 'workspace_not_found'
}

export interface ErrorResponse {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: number;
}

// 通信协议版本
export interface CommunicationProtocol {
  version: string;
  supportedFeatures: string[];
  maxPayloadSize: number;
  supportedMessageTypes: MessageType[];
}

export interface MachineInfo {
  machineId: string;
  platform: string;
  hostname: string;
  lastSeen: number;
}

export interface TokenCount {
  count: number;
  model: string;
  text: string;
}
