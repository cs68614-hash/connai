import * as vscode from 'vscode';
import * as http from 'http';
import { getWorkspaceManager } from '../utils/workspaceManager';
import { getCopilotChatManager } from '../extension';

/**
 * 基于协议层的 ConnAI 服务器
 * 集成协议抽象层，支持标准化的消息处理和多端通信
 */
export class ProtocolServer {
    private static instance: ProtocolServer;
    private adapter: any | null = null;
    private httpServer: http.Server | null = null;
    private isRunning = false;
    private connectedClients = new Map<string, any>();
    private protocolModule: any = null;
    private serverPort = 8080;

    private constructor() {}

    static getInstance(): ProtocolServer {
        if (!ProtocolServer.instance) {
            ProtocolServer.instance = new ProtocolServer();
        }
        return ProtocolServer.instance;
    }

    /**
     * 启动协议服务器
     */
    async startServer(port?: number): Promise<boolean> {
        if (this.isRunning) {
            console.log('Protocol server is already running');
            return true;
        }

        try {
            // 动态导入协议模块
            this.protocolModule = await import('@connai/protocol');
            
            const workspaceManager = getWorkspaceManager();
            const workspaceInfo = await workspaceManager.initializeWorkspace();
            this.serverPort = port || workspaceInfo.port;

            // 初始化 VS Code 适配器
            this.adapter = new this.protocolModule.VSCodeAdapter({
                info: {
                    name: 'VS Code Adapter',
                    version: '1.0.0',
                    editorName: 'Visual Studio Code',
                    editorVersion: vscode.version || '1.0.0',
                    platform: process.platform,
                    capabilities: [
                        this.protocolModule.ProtocolCapability.GET_CONTEXT,
                        this.protocolModule.ProtocolCapability.READ_FILE,
                        this.protocolModule.ProtocolCapability.GREP_SEARCH,
                        this.protocolModule.ProtocolCapability.GET_WORKSPACE_INFO,
                        this.protocolModule.ProtocolCapability.GET_EDITOR_STATE,
                        this.protocolModule.ProtocolCapability.GET_DIAGNOSTICS,
                        this.protocolModule.ProtocolCapability.AUTHENTICATE
                    ]
                },
                protocol: {
                    version: '1.0.0',
                    capabilities: [
                        this.protocolModule.ProtocolCapability.GET_CONTEXT,
                        this.protocolModule.ProtocolCapability.READ_FILE,
                        this.protocolModule.ProtocolCapability.GREP_SEARCH,
                        this.protocolModule.ProtocolCapability.GET_WORKSPACE_INFO,
                        this.protocolModule.ProtocolCapability.AUTHENTICATE
                    ],
                    transport: {
                        type: 'http',
                        endpoint: `http://127.0.0.1:${this.serverPort}`,
                        timeout: 10000,
                        retryAttempts: 3
                    },
                    limits: {
                        maxMessageSize: 10 * 1024 * 1024,
                        maxConcurrentRequests: 10,
                        rateLimitPerSecond: 100
                    },
                    features: {
                        compression: false,
                        encryption: false,
                        batchRequests: false
                    }
                },
                features: {
                    context: true,
                    files: true,
                    workspace: true,
                    auth: true
                }
            }, vscode);
            
            await this.adapter.initialize();

            // 创建 HTTP 服务器
            this.httpServer = http.createServer((req, res) => {
                this.handleHttpRequest(req, res);
            });

            // 启动服务器
            await new Promise<void>((resolve, reject) => {
                this.httpServer!.listen(this.serverPort, '127.0.0.1', (error?: Error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            this.isRunning = true;

            console.log(`ConnAI Protocol Server started on port ${this.serverPort}`);
            console.log(`Workspace: ${workspaceInfo.name} (${workspaceInfo.id})`);
            
            // 显示启动成功消息
            vscode.window.showInformationMessage(
                `ConnAI server started on port ${this.serverPort} (Protocol Mode)`
            );
            
            return true;
        } catch (error) {
            console.error('Failed to start protocol server:', error);
            vscode.window.showErrorMessage(
                `Failed to start ConnAI server: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }

    /**
     * 停止协议服务器
     */
    async stopServer(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            if (this.httpServer) {
                await new Promise<void>((resolve) => {
                    this.httpServer!.close(() => {
                        resolve();
                    });
                });
            }
            
            if (this.adapter && this.adapter.dispose) {
                await this.adapter.dispose();
            }

            this.httpServer = null;
            this.adapter = null;
            this.isRunning = false;
            this.connectedClients.clear();

            console.log('ConnAI Protocol Server stopped');
        } catch (error) {
            console.error('Error stopping protocol server:', error);
        }
    }

    /**
     * 处理 HTTP 请求
     */
    private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // 处理 OPTIONS 预检请求
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        
        try {
            switch (url.pathname) {
                case '/health':
                    await this.handleHealthCheck(req, res);
                    break;
                
                case '/api/request':
                    await this.handleApiRequest(req, res);
                    break;
                
                case '/api/event':
                    await this.handleApiEvent(req, res);
                    break;
                
                case '/api/copilot/chat':
                    await this.handleCopilotChat(req, res);
                    break;
                
                case '/api/copilot/stream':
                    await this.handleCopilotStream(req, res);
                    break;
                
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            console.error('Error handling HTTP request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }

    /**
     * 处理健康检查
     */
    private async handleHealthCheck(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            server: 'ConnAI Protocol Server',
            version: '1.0.0',
            timestamp: Date.now()
        }));
    }

    /**
     * 处理 API 请求
     */
    private async handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const message = JSON.parse(body);
        const clientId = this.getClientId(req);

        console.log(`Handling request from ${clientId}:`, message.operation);

        try {
            const response = await this.handleRequest(message, clientId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } catch (error) {
            const errorResponse = {
                id: message.id || 'unknown',
                type: 'response',
                timestamp: Date.now(),
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error'
                }
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorResponse));
        }
    }

    /**
     * 处理 API 事件
     */
    private async handleApiEvent(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const message = JSON.parse(body);
        const clientId = this.getClientId(req);

        console.log(`Handling event from ${clientId}:`, message.event);

        try {
            await this.handleEvent(message, clientId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }

    /**
     * 处理 Copilot 聊天请求
     */
    private async handleCopilotChat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        try {
            const body = await this.readRequestBody(req);
            const chatRequest = JSON.parse(body);

            // 获取 Copilot 聊天管理器 - 直接使用导入的函数
            const copilotManager = getCopilotChatManager();
            
            if (!copilotManager) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Copilot chat manager not available' }));
                return;
            }

            // 启动聊天会话
            const sessionId = await copilotManager.startChatSession(chatRequest);

            // 如果启用了流式传输，返回会话 ID 和流式端点
            if (chatRequest.streaming?.enabled) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    sessionId,
                    streamUrl: `/api/copilot/stream?sessionId=${sessionId}`,
                    success: true
                }));
            } else {
                // 非流式模式：等待完整响应
                // 这里需要实现等待机制
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    sessionId,
                    message: 'Chat session started. Use stream endpoint for real-time updates.',
                    success: true
                }));
            }

        } catch (error: any) {
            console.error('Copilot chat error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Internal server error',
                details: error?.message 
            }));
        }
    }

    /**
     * 处理 Copilot 流式响应
     */
    private async handleCopilotStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session ID required' }));
            return;
        }

        try {
            // 设置 Server-Sent Events 头
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // 发送初始连接事件
            res.write(`data: ${JSON.stringify({
                type: 'connected',
                sessionId,
                timestamp: Date.now()
            })}\n\n`);

            // 获取 Copilot 聊天管理器
            const copilotManager = getCopilotChatManager();
            if (!copilotManager) {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Copilot chat manager not available',
                    timestamp: Date.now()
                })}\n\n`);
                res.end();
                return;
            }

            // 监听流式事件
            const eventHandler = (event: any) => {
                if (event.sessionId === sessionId) {
                    res.write(`data: ${JSON.stringify(event)}\n\n`);
                    
                    // 如果是完成或错误事件，关闭连接
                    if (event.type === 'complete' || event.type === 'error') {
                        setTimeout(() => {
                            res.end();
                        }, 100);
                    }
                }
            };

            copilotManager.on('streamEvent', eventHandler);

            // 处理客户端断开连接
            req.on('close', () => {
                copilotManager.off('streamEvent', eventHandler);
            });

            // 保持连接活跃
            const keepAlive = setInterval(() => {
                res.write(`: keep-alive\n\n`);
            }, 30000);

            req.on('close', () => {
                clearInterval(keepAlive);
            });

        } catch (error: any) {
            console.error('Copilot stream error:', error);
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: error?.message || 'Unknown error',
                timestamp: Date.now()
            })}\n\n`);
            res.end();
        }
    }

    /**
     * 读取请求体
     */
    private readRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    /**
     * 获取客户端ID
     */
    private getClientId(req: http.IncomingMessage): string {
        const userAgent = req.headers['user-agent'] || 'unknown';
        const ip = req.socket.remoteAddress || 'unknown';
        return `${ip}-${userAgent.substring(0, 20)}`;
    }

    /**
     * 处理请求消息
     */
    private async handleRequest(message: any, clientId: string): Promise<any> {
        const { operation, payload } = message;

        // 根据操作类型路由到相应的处理器
        switch (operation) {
            case 'get_context':
                return await this.handleGetContext(message, payload, clientId);
            
            case 'get_workspace_info':
                return await this.handleGetWorkspaceInfo(message, payload, clientId);
            
            case 'authenticate':
                return await this.handleAuthenticate(message, payload, clientId);
            
            case 'read_file':
                return await this.handleReadFile(message, payload, clientId);
            
            case 'grep_search':
                return await this.handleGrepSearch(message, payload, clientId);
            
            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    }

    /**
     * 处理事件消息
     */
    private async handleEvent(message: any, clientId: string): Promise<void> {
        const { event, payload } = message;
        console.log(`Processing event: ${event}`, payload);
        
        // 事件处理逻辑
        this.adapter?.emit?.(event, payload, clientId);
    }

    /**
     * 处理获取上下文请求
     */
    private async handleGetContext(message: any, payload: any, clientId: string): Promise<any> {
        try {
            const contextContract = this.adapter.getContextContract?.();
            if (!contextContract) {
                throw new Error('Context contract not available');
            }

            const contextResponse = await contextContract.getContext(payload);
            
            return {
                id: message.id,
                type: 'response',
                timestamp: Date.now(),
                success: true,
                payload: contextResponse
            };
        } catch (error) {
            throw new Error(`Failed to get context: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * 处理获取工作区信息请求
     */
    private async handleGetWorkspaceInfo(message: any, payload: any, clientId: string): Promise<any> {
        try {
            const workspaceManager = getWorkspaceManager();
            const workspaceInfo = await workspaceManager.initializeWorkspace();
            
            return {
                id: message.id,
                type: 'response',
                timestamp: Date.now(),
                success: true,
                payload: {
                    id: workspaceInfo.id,
                    name: workspaceInfo.name,
                    path: workspaceInfo.path,
                    port: workspaceInfo.port
                }
            };
        } catch (error) {
            throw new Error(`Failed to get workspace info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * 处理认证请求
     */
    private async handleAuthenticate(message: any, payload: any, clientId: string): Promise<any> {
        try {
            // 简化的认证逻辑（测试模式）
            const isValid = payload && (payload.token || payload.accessToken);
            
            return {
                id: message.id,
                type: 'response',
                timestamp: Date.now(),
                success: true,
                payload: {
                    authenticated: isValid,
                    user: isValid ? { id: 'test-user', name: 'Test User' } : null
                }
            };
        } catch (error) {
            throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * 处理读取文件请求
     */
    private async handleReadFile(message: any, payload: any, clientId: string): Promise<any> {
        try {
            const { path } = payload;
            const document = await vscode.workspace.openTextDocument(path);
            
            return {
                id: message.id,
                type: 'response',
                timestamp: Date.now(),
                success: true,
                payload: {
                    path,
                    content: document.getText(),
                    language: document.languageId,
                    size: document.getText().length
                }
            };
        } catch (error) {
            throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * 处理搜索请求
     */
    private async handleGrepSearch(message: any, payload: any, clientId: string): Promise<any> {
        try {
            const { pattern, path } = payload;
            
            // 简化的搜索实现
            const results = await vscode.workspace.findFiles(
                path || '**/*',
                '**/node_modules/**'
            );
            
            return {
                id: message.id,
                type: 'response',
                timestamp: Date.now(),
                success: true,
                payload: {
                    pattern,
                    results: results.slice(0, 10).map(uri => ({
                        path: uri.fsPath,
                        uri: uri.toString()
                    }))
                }
            };
        } catch (error) {
            throw new Error(`Grep search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * 获取服务器状态
     */
    getServerStatus() {
        return {
            isRunning: this.isRunning,
            connectedClients: this.connectedClients.size,
            port: this.serverPort
        };
    }

    /**
     * 广播消息给所有连接的客户端
     */
    async broadcastMessage(message: any): Promise<void> {
        // HTTP 服务器是无状态的，无法直接广播
        // 这个方法保留用于未来的 WebSocket 实现
        console.log('Broadcast message (HTTP mode):', message);
    }

    /**
     * 发送消息给特定客户端
     */
    async sendMessageToClient(message: any, clientId: string): Promise<void> {
        // HTTP 服务器是无状态的，无法直接推送
        // 这个方法保留用于未来的 WebSocket 实现
        console.log('Send message to client (HTTP mode):', clientId, message);
    }

    /**
     * 获取连接的客户端列表
     */
    getConnectedClients(): Map<string, any> {
        return new Map(this.connectedClients);
    }
}

/**
 * 获取协议服务器单例
 */
export function getProtocolServer(): ProtocolServer {
    return ProtocolServer.getInstance();
}
