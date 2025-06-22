import * as vscode from 'vscode';
import { WebSocketMessage, MessageType, AuthState, ERROR_MESSAGES } from '@connai/shared';
import { getWorkspaceManager } from '../utils/workspaceManager';

// 导入 context providers (暂时注释，等待创建)
// import { VSCProvider } from '../context/vscProvider';
// import { FileProvider } from '../context/fileProvider';
// import { FolderProvider } from '../context/folderProvider';
// import { FileTreeProvider } from '../context/fileTreeProvider';
// import { CursorProvider } from '../context/cursorProvider';
// import { DiagnosticsProvider } from '../context/diagnosticsProvider';
// import { RecentChangesProvider } from '../context/recentChangesProvider';

/**
 * 处理来自 Web 客户端的消息和事件
 */

export class MessageHandler {
  private authState: AuthState = { isAuthenticated: false };

  constructor() {
    // 初始化 providers
  }

  /**
   * 处理客户端认证
   */
  async handleAuthentication(data: any): Promise<boolean> {
    try {
      // 简化的认证逻辑，用于测试目的
      // 在生产环境中，这里应该验证来自 whop.com 的 token
      
      console.log('Authentication attempt:', data);
      
      // 对于测试，任何包含 token 的请求都认为是有效的
      if (data && (data.token || data.accessToken)) {
        this.authState = {
          isAuthenticated: true,
          accessToken: data.token || data.accessToken,
          user: data.user || { id: 'test-user', name: 'Test User' },
        };
        console.log('Authentication successful for test user');
        return true;
      }
      
      console.log('Authentication failed: no token provided');
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  /**
   * 处理 WebSocket 消息
   */
  async handleMessage(message: WebSocketMessage): Promise<WebSocketMessage | null> {
    try {
      // 检查认证状态
      if (!this.authState.isAuthenticated) {
        return this.createErrorResponse(message, ERROR_MESSAGES.UNAUTHORIZED);
      }

      // 根据消息类型处理
      switch (message.type) {
        case MessageType.GET_WORKSPACE_SNAPSHOT:
          return await this.handleGetWorkspaceSnapshot(message);
          
        case MessageType.GET_FILE_CONTENT:
          return await this.handleGetFileContent(message);
          
        case MessageType.GET_FOLDER_CONTENT:
          return await this.handleGetFolderContent(message);
          
        case MessageType.GET_FILE_TREE:
          return await this.handleGetFileTree(message);
          
        case MessageType.GET_CURSOR_CONTEXT:
          return await this.handleGetCursorContext(message);
          
        case MessageType.GET_DIAGNOSTICS:
          return await this.handleGetDiagnostics(message);
          
        case MessageType.GET_RECENT_CHANGES:
          return await this.handleGetRecentChanges(message);
          
        case MessageType.WRITE_FILE:
          return await this.handleWriteFile(message);
          
        case MessageType.EDIT_FILE:
          return await this.handleEditFile(message);
          
        case MessageType.DELETE_FILE:
          return await this.handleDeleteFile(message);
          
        case MessageType.CREATE_FILE:
          return await this.handleCreateFile(message);
          
        case MessageType.GREP_SEARCH:
          return await this.handleGrepSearch(message);
          
        case MessageType.FILE_SEARCH:
          return await this.handleFileSearch(message);
          
        default:
          return this.createErrorResponse(message, ERROR_MESSAGES.INVALID_REQUEST);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取工作区快照
   */
  private async handleGetWorkspaceSnapshot(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      // 获取工作区管理器信息
      const workspaceManager = getWorkspaceManager();
      const workspaceInfo = workspaceManager.getWorkspaceApiInfo();
      
      // TODO: 实现获取工作区快照
      // const snapshot = await VSCProvider.getWorkspaceSnapshot();
      
      return {
        type: MessageType.GET_WORKSPACE_SNAPSHOT,
        id: message.id,
        data: {
          workspace: workspaceInfo,
          workspaceFolders: vscode.workspace.workspaceFolders?.map(f => ({
            name: f.name,
            path: f.uri.fsPath,
            index: f.index
          })) || [],
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取文件内容
   */
  private async handleGetFileContent(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { filePath } = message.data || {};
      
      if (!filePath) {
        return this.createErrorResponse(message, 'File path is required');
      }

      // TODO: 使用 FileProvider 获取文件内容
      // const fileContent = await FileProvider.getFileContent(filePath);
      
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      
      return {
        type: MessageType.GET_FILE_CONTENT,
        id: message.id,
        data: {
          uri: uri.toString(),
          path: filePath,
          content: Buffer.from(content).toString('utf8'),
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取文件夹内容
   */
  private async handleGetFolderContent(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { folderPath } = message.data || {};
      
      if (!folderPath) {
        return this.createErrorResponse(message, 'Folder path is required');
      }

      // TODO: 使用 FolderProvider 获取文件夹内容
      const uri = vscode.Uri.file(folderPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      
      return {
        type: MessageType.GET_FOLDER_CONTENT,
        id: message.id,
        data: {
          uri: uri.toString(),
          path: folderPath,
          entries: entries.map(([name, type]) => ({
            name,
            type: type === vscode.FileType.File ? 'file' : 'directory',
            path: `${folderPath}/${name}`,
          })),
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取文件树
   */
  private async handleGetFileTree(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      // TODO: 使用 FileTreeProvider 获取文件树
      
      return {
        type: MessageType.GET_FILE_TREE,
        id: message.id,
        data: {
          tree: [], // 临时返回空数组
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取光标上下文
   */
  private async handleGetCursorContext(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      // TODO: 使用 CursorProvider 获取光标上下文
      const activeEditor = vscode.window.activeTextEditor;
      
      return {
        type: MessageType.GET_CURSOR_CONTEXT,
        id: message.id,
        data: {
          activeEditor: activeEditor ? {
            uri: activeEditor.document.uri.toString(),
            fileName: activeEditor.document.fileName,
            language: activeEditor.document.languageId,
            selection: {
              start: {
                line: activeEditor.selection.start.line,
                character: activeEditor.selection.start.character,
              },
              end: {
                line: activeEditor.selection.end.line,
                character: activeEditor.selection.end.character,
              },
            },
          } : undefined,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取诊断信息
   */
  private async handleGetDiagnostics(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      // TODO: 使用 DiagnosticsProvider 获取诊断信息
      
      return {
        type: MessageType.GET_DIAGNOSTICS,
        id: message.id,
        data: {
          diagnostics: [], // 临时返回空数组
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理获取最近变更
   */
  private async handleGetRecentChanges(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      // TODO: 使用 RecentChangesProvider 获取最近变更
      
      return {
        type: MessageType.GET_RECENT_CHANGES,
        id: message.id,
        data: {
          changes: [], // 临时返回空数组
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理写入文件
   */
  private async handleWriteFile(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { filePath, content } = message.data || {};
      
      if (!filePath || content === undefined) {
        return this.createErrorResponse(message, 'File path and content are required');
      }

      const uri = vscode.Uri.file(filePath);
      const contentBuffer = Buffer.from(content, 'utf8');
      
      await vscode.workspace.fs.writeFile(uri, contentBuffer);
      
      return {
        type: MessageType.WRITE_FILE,
        id: message.id,
        data: { success: true, filePath },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理编辑文件
   */
  private async handleEditFile(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { filePath, edits } = message.data || {};
      
      if (!filePath || !edits) {
        return this.createErrorResponse(message, 'File path and edits are required');
      }

      // TODO: 实现文件编辑逻辑
      
      return {
        type: MessageType.EDIT_FILE,
        id: message.id,
        data: { success: true, filePath },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理删除文件
   */
  private async handleDeleteFile(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { filePath } = message.data || {};
      
      if (!filePath) {
        return this.createErrorResponse(message, 'File path is required');
      }

      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.delete(uri);
      
      return {
        type: MessageType.DELETE_FILE,
        id: message.id,
        data: { success: true, filePath },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理创建文件
   */
  private async handleCreateFile(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { filePath, content = '' } = message.data || {};
      
      if (!filePath) {
        return this.createErrorResponse(message, 'File path is required');
      }

      const uri = vscode.Uri.file(filePath);
      const contentBuffer = Buffer.from(content, 'utf8');
      
      await vscode.workspace.fs.writeFile(uri, contentBuffer);
      
      return {
        type: MessageType.CREATE_FILE,
        id: message.id,
        data: { success: true, filePath },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理 Grep 搜索
   */
  private async handleGrepSearch(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { query, options } = message.data || {};
      
      if (!query) {
        return this.createErrorResponse(message, 'Search query is required');
      }

      // TODO: 实现 Grep 搜索逻辑
      
      return {
        type: MessageType.GREP_SEARCH,
        id: message.id,
        data: {
          results: [], // 临时返回空数组
          query,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 处理文件搜索
   */
  private async handleFileSearch(message: WebSocketMessage): Promise<WebSocketMessage> {
    try {
      const { pattern, options } = message.data || {};
      
      if (!pattern) {
        return this.createErrorResponse(message, 'Search pattern is required');
      }

      // TODO: 实现文件搜索逻辑
      
      return {
        type: MessageType.FILE_SEARCH,
        id: message.id,
        data: {
          files: [], // 临时返回空数组
          pattern,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createErrorResponse(message, String(error));
    }
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(originalMessage: WebSocketMessage, error: string): WebSocketMessage {
    return {
      type: MessageType.ERROR,
      id: originalMessage.id,
      error,
      timestamp: Date.now(),
    };
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * 获取认证状态
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * 设置认证状态
   */
  setAuthState(authState: AuthState): void {
    this.authState = { ...authState };
  }
}
