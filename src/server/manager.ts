import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import * as vscode from 'vscode';
import { SERVER_CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';
import { ServerConfig, WebSocketMessage, AuthState } from '../types';
import { MessageHandler } from './handlers';
import { getWorkspaceManager } from '../utils/workspaceManager';

/**
 * WebSocket 服务器的启动、停止和管理
 */

export class WebSocketManager {
  private static instance: WebSocketManager;
  private httpServer: HttpServer | null = null;
  private io: SocketIOServer | null = null;
  private isRunning: boolean = false;
  private config: ServerConfig;
  private messageHandler: MessageHandler;
  private connectedClients: Map<string, any> = new Map();

  constructor() {
    this.config = {
      port: SERVER_CONFIG.DEFAULT_PORT,
      host: SERVER_CONFIG.DEFAULT_HOST,
      cors: {
        origin: true, // 在开发模式下允许所有来源
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    };
    
    this.messageHandler = new MessageHandler();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * 启动 WebSocket 服务器
   */
  async startServer(port?: number): Promise<boolean> {
    if (this.isRunning) {
      console.warn('WebSocket server is already running');
      return true;
    }

    try {
      // 获取工作区信息
      const workspaceManager = getWorkspaceManager();
      const workspaceInfo = workspaceManager.getCurrentWorkspace();
      
      // 使用工作区指定的端口，或者传入的端口，或者默认端口
      const serverPort = port || workspaceInfo?.port || this.config.port;
      
      // 创建 HTTP 服务器
      this.httpServer = createServer();
      
      // 创建 Socket.IO 服务器
      this.io = new SocketIOServer(this.httpServer, {
        cors: this.config.cors,
        pingInterval: SERVER_CONFIG.HEARTBEAT_INTERVAL,
        pingTimeout: SERVER_CONFIG.HEARTBEAT_INTERVAL * 2,
      });

      // 设置事件监听器
      this.setupEventListeners();

      // 启动服务器
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(serverPort, this.config.host, () => {
          resolve();
        });
        
        this.httpServer!.on('error', (error) => {
          reject(error);
        });
      });

      this.isRunning = true;
      this.config.port = serverPort;
      
      console.log(`WebSocket server started on ${this.config.host}:${serverPort}`);
      vscode.window.showInformationMessage(SUCCESS_MESSAGES.SERVER_STARTED);
      
      return true;
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      vscode.window.showErrorMessage(`${ERROR_MESSAGES.SERVER_START_FAILED}: ${error}`);
      
      await this.cleanup();
      return false;
    }
  }

  /**
   * 停止 WebSocket 服务器
   */
  async stopServer(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // 断开所有客户端连接
      if (this.io) {
        this.io.disconnectSockets(true);
      }

      // 关闭服务器
      await new Promise<void>((resolve) => {
        if (this.httpServer) {
          this.httpServer.close(() => {
            resolve();
          });
        } else {
          resolve();
        }
      });

      await this.cleanup();
      
      console.log('WebSocket server stopped');
      vscode.window.showInformationMessage('WebSocket server stopped');
    } catch (error) {
      console.error('Error stopping WebSocket server:', error);
    }
  }

  /**
   * 重启 WebSocket 服务器
   */
  async restartServer(): Promise<boolean> {
    await this.stopServer();
    return await this.startServer();
  }

  /**
   * 检查服务器是否正在运行
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取服务器配置
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * 更新服务器配置
   */
  updateConfig(newConfig: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 广播消息给所有连接的客户端
   */
  broadcast(message: WebSocketMessage): void {
    if (this.io) {
      this.io.emit('message', message);
    }
  }

  /**
   * 发送消息给特定客户端
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    const socket = this.connectedClients.get(clientId);
    if (socket) {
      socket.emit('message', message);
    }
  }

  /**
   * 获取连接的客户端数量
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * 获取连接的客户端信息
   */
  getConnectedClients(): Array<{ id: string; address: string; userAgent?: string }> {
    return Array.from(this.connectedClients.entries()).map(([id, socket]) => ({
      id,
      address: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    }));
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.io) {
      return;
    }

    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // 处理认证
      socket.on('auth', async (data) => {
        try {
          const isValid = await this.messageHandler.handleAuthentication(data);
          if (isValid) {
            socket.emit('auth-result', { success: true });
          } else {
            socket.emit('auth-result', { success: false, error: ERROR_MESSAGES.AUTHENTICATION_FAILED });
            socket.disconnect();
          }
        } catch (error) {
          socket.emit('auth-result', { success: false, error: String(error) });
          socket.disconnect();
        }
      });

      // 处理简单的消息事件（用于 demo.html）
      socket.on('get-context', async (data) => {
        try {
          if (!this.messageHandler.isAuthenticated()) {
            socket.emit('context-response', { error: 'Not authenticated' });
            return;
          }

          let response;
          switch (data.type) {
            case 'workspace':
              response = { 
                name: vscode.workspace.name || 'Unknown',
                folders: vscode.workspace.workspaceFolders?.map(f => ({
                  name: f.name,
                  uri: f.uri.toString()
                })) || [],
                files: [],
                stats: { totalFiles: 0, totalLines: 0 }
              };
              break;
            case 'cursor':
              const editor = vscode.window.activeTextEditor;
              response = {
                line: editor?.selection.active.line || 0,
                character: editor?.selection.active.character || 0,
                fileName: editor?.document.fileName || '',
                selection: editor?.selection ? {
                  start: { line: editor.selection.start.line, character: editor.selection.start.character },
                  end: { line: editor.selection.end.line, character: editor.selection.end.character }
                } : null
              };
              break;
            case 'diagnostics':
              response = { 
                errors: [],
                warnings: [],
                info: [],
                total: 0
              };
              break;
            default:
              response = { error: 'Unknown context type' };
          }
          
          socket.emit('context-response', response);
        } catch (error) {
          socket.emit('context-response', { error: String(error) });
        }
      });

      socket.on('get-file', async (data) => {
        try {
          if (!this.messageHandler.isAuthenticated()) {
            socket.emit('file-response', { error: 'Not authenticated' });
            return;
          }

          socket.emit('file-response', { 
            path: data.path,
            content: 'File content simulation',
            size: 1024,
            lastModified: Date.now()
          });
        } catch (error) {
          socket.emit('file-response', { error: String(error) });
        }
      });

      socket.on('search-files', async (data) => {
        try {
          if (!this.messageHandler.isAuthenticated()) {
            socket.emit('search-response', { error: 'Not authenticated' });
            return;
          }

          socket.emit('search-response', { 
            query: data.query,
            results: [
              { path: '/src/extension.ts', matches: 1 },
              { path: '/src/server/manager.ts', matches: 2 }
            ],
            total: 2
          });
        } catch (error) {
          socket.emit('search-response', { error: String(error) });
        }
      });

      socket.on('execute-command', async (data) => {
        try {
          if (!this.messageHandler.isAuthenticated()) {
            socket.emit('command-response', { error: 'Not authenticated' });
            return;
          }

          await vscode.commands.executeCommand(data.command, ...(data.args || []));
          socket.emit('command-response', { 
            command: data.command,
            success: true,
            result: 'Command executed successfully'
          });
        } catch (error) {
          socket.emit('command-response', { 
            command: data.command,
            success: false,
            error: String(error) 
          });
        }
      });

      // 处理消息
      socket.on('message', async (message: WebSocketMessage) => {
        try {
          const response = await this.messageHandler.handleMessage(message);
          if (response) {
            socket.emit('message', response);
          }
        } catch (error) {
          socket.emit('message', {
            type: message.type,
            id: message.id,
            error: String(error),
            timestamp: Date.now(),
          });
        }
      });

      // 处理断开连接
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.connectedClients.delete(socket.id);
      });

      // 处理错误
      socket.on('error', (error) => {
        console.error(`Socket error for client ${socket.id}:`, error);
      });

      // 发送欢迎消息
      socket.emit('welcome', {
        message: 'Connected to ConnAI WebSocket server',
        timestamp: Date.now(),
      });
    });

    // 处理服务器错误
    this.io.on('error', (error) => {
      console.error('Socket.IO server error:', error);
    });
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.isRunning = false;
    this.connectedClients.clear();
    
    if (this.io) {
      this.io.removeAllListeners();
      this.io = null;
    }
    
    if (this.httpServer) {
      this.httpServer.removeAllListeners();
      this.httpServer = null;
    }
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(): {
    isRunning: boolean;
    port: number;
    host: string;
    connectedClients: number;
    uptime?: number;
  } {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      connectedClients: this.connectedClients.size,
      uptime: this.isRunning ? Date.now() : undefined,
    };
  }
}

// 导出便捷函数
export const getWebSocketManager = (): WebSocketManager => WebSocketManager.getInstance();
export const startServer = (port?: number): Promise<boolean> => getWebSocketManager().startServer(port);
export const stopServer = (): Promise<void> => getWebSocketManager().stopServer();
export const restartServer = (): Promise<boolean> => getWebSocketManager().restartServer();
