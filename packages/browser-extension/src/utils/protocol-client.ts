/**
 * ConnAI Protocol Client for Browser Extension
 * 
 * 基于协议层的通信客户端，支持标准化的消息格式和接口
 */

export interface ProtocolClientConfig {
  serverUrl: string;
  timeout?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface ProtocolMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  timestamp: number;
  [key: string]: any;
}

export class ProtocolClient {
  private config: ProtocolClientConfig;
  private connected = false;
  private messageId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(config: ProtocolClientConfig) {
    this.config = {
      timeout: 30000,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...config
    };
  }

  /**
   * 生成唯一消息ID
   */
  private generateMessageId(): string {
    return `msg_${++this.messageId}_${Date.now()}`;
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      console.log(`Connecting to ConnAI server: ${this.config.serverUrl}`);
      
      // 测试连接
      const healthResponse = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!healthResponse.ok) {
        throw new Error(`Server health check failed: ${healthResponse.status}`);
      }

      this.connected = true;
      this.reconnectAttempts = 0;
      
      console.log('Connected to ConnAI server successfully');
      this.emit('connected', { serverUrl: this.config.serverUrl });
    } catch (error) {
      console.error('Failed to connect to ConnAI server:', error);
      this.connected = false;
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.connected = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // 清理待处理的请求
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    console.log('Disconnected from ConnAI server');
    this.emit('disconnected');
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnect failed:', error);
      }
    }, this.config.reconnectInterval);
  }

  /**
   * 发送请求并等待响应
   */
  async sendRequest(operation: string, payload: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to server');
    }

    const message: ProtocolMessage = {
      id: this.generateMessageId(),
      type: 'request',
      timestamp: Date.now(),
      operation,
      payload
    };

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timeout: ${operation}`));
      }, this.config.timeout);

      // 存储请求
      this.pendingRequests.set(message.id, { resolve, reject, timeout });

      // 发送请求
      this.sendMessage(message).catch(error => {
        this.pendingRequests.delete(message.id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 发送事件（无需响应）
   */
  async sendEvent(eventType: string, payload: any = {}): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to server');
    }

    const message: ProtocolMessage = {
      id: this.generateMessageId(),
      type: 'event',
      timestamp: Date.now(),
      event: eventType,
      payload
    };

    await this.sendMessage(message);
  }

  /**
   * 发送消息到服务器
   */
  private async sendMessage(message: ProtocolMessage): Promise<void> {
    try {
      const endpoint = message.type === 'request' ? '/api/request' : '/api/event';
      
      const response = await fetch(`${this.config.serverUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });

      if (message.type === 'request') {
        const result = await response.json();
        this.handleResponse(result);
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * 处理服务器响应
   */
  private handleResponse(response: any): void {
    const { id, success, payload, error } = response;
    
    const pendingRequest = this.pendingRequests.get(id);
    if (!pendingRequest) {
      console.warn('Received response for unknown request:', id);
      return;
    }

    this.pendingRequests.delete(id);
    clearTimeout(pendingRequest.timeout);

    if (success) {
      pendingRequest.resolve(payload);
    } else {
      pendingRequest.reject(new Error(error?.message || 'Request failed'));
    }
  }

  /**
   * 事件监听
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * 移除事件监听
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取服务器URL
   */
  getServerUrl(): string {
    return this.config.serverUrl;
  }

  /**
   * 更新服务器URL
   */
  updateServerUrl(serverUrl: string): void {
    if (this.config.serverUrl !== serverUrl) {
      const wasConnected = this.connected;
      if (wasConnected) {
        this.disconnect();
      }
      
      this.config.serverUrl = serverUrl;
      
      if (wasConnected) {
        this.connect().catch(console.error);
      }
    }
  }
}

/**
 * 创建协议客户端实例
 */
export function createProtocolClient(config: ProtocolClientConfig): ProtocolClient {
  return new ProtocolClient(config);
}
