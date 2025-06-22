/**
 * VS Code 扩展特定的类型定义
 * 继承和扩展 @connai/shared 中的共享类型
 */

// 重新导出共享类型
export * from '@connai/shared';

// VS Code 特定的类型扩展
import { WorkspaceInfo as BaseWorkspaceInfo } from '@connai/shared';
import * as vscode from 'vscode';

// 扩展工作区信息以包含 VS Code 特定属性
export interface VSCodeWorkspaceInfo extends Omit<BaseWorkspaceInfo, 'folders'> {
  folders: readonly vscode.WorkspaceFolder[];
}

// VS Code 特定的上下文
export interface VSCodeContext {
  workspaceState: vscode.Memento;
  globalState: vscode.Memento;
  subscriptions: vscode.Disposable[];
  extensionUri: vscode.Uri;
  extensionPath: string;
}

// 扩展状态
export interface ExtensionState {
  isActive: boolean;
  serverRunning: boolean;
  authenticated: boolean;
  connectedClients: number;
  workspaceInfo?: VSCodeWorkspaceInfo;
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
