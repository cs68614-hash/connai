/**
 * 全局 TypeScript 类型定义
 */

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

export interface AuthState {
  isAuthenticated: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  user?: {
    id: string;
    email: string;
    plan: string;
  };
}

export interface MachineInfo {
  machineId: string;
  platform: string;
  hostname: string;
  lastSeen: number;
}

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

// 消息类型枚举
export enum MessageType {
  // 认证相关
  AUTH_REQUEST = 'auth_request',
  AUTH_RESPONSE = 'auth_response',
  
  // 上下文请求
  GET_WORKSPACE_SNAPSHOT = 'get_workspace_snapshot',
  GET_FILE_CONTENT = 'get_file_content',
  GET_FOLDER_CONTENT = 'get_folder_content',
  GET_FILE_TREE = 'get_file_tree',
  GET_CURSOR_CONTEXT = 'get_cursor_context',
  GET_DIAGNOSTICS = 'get_diagnostics',
  GET_RECENT_CHANGES = 'get_recent_changes',
  
  // 文件操作
  WRITE_FILE = 'write_file',
  EDIT_FILE = 'edit_file',
  DELETE_FILE = 'delete_file',
  CREATE_FILE = 'create_file',
  
  // 搜索相关
  GREP_SEARCH = 'grep_search',
  FILE_SEARCH = 'file_search',
  
  // 实时更新
  FILE_CHANGED = 'file_changed',
  EDITOR_CHANGED = 'editor_changed',
  DIAGNOSTICS_CHANGED = 'diagnostics_changed',
  
  // 错误处理
  ERROR = 'error',
  SUCCESS = 'success',
}

export enum ContextType {
  WORKSPACE = 'workspace',
  FILE = 'file',
  FOLDER = 'folder',
  SELECTION = 'selection',
  DIAGNOSTICS = 'diagnostics',
  RECENT_CHANGES = 'recent_changes',
}

export interface WebSocketMessage {
  type: MessageType;
  id?: string;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface GrepResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface FileSearchResult {
  files: string[];
  totalCount: number;
  searchTime: number;
}

export interface TokenCount {
  count: number;
  model: string;
  text: string;
}
