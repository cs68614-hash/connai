import { browser } from 'wxt/browser';
import { createProtocolClient, ProtocolClient } from '../src/utils/protocol-client';

interface ConnectionState {
  connected: boolean;
  serverUrl: string;
  error?: string;
}

class BackgroundService {
  private protocolClient: ProtocolClient | null = null;
  private connectionState: ConnectionState = {
    connected: false,
    serverUrl: 'http://localhost:8080'
  };

  constructor() {
    this.initializeEventListeners();
    this.loadSettings();
  }

  private initializeEventListeners(): void {
    // 监听来自 content script 和 popup 的消息
    browser.runtime.onMessage.addListener(async (message, sender) => {
      try {
        return await this.handleMessage(message, sender);
      } catch (error) {
        console.error('Error handling message:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 监听扩展安装和更新
    browser.runtime.onInstalled.addListener((details) => {
      console.log('ConnAI extension installed/updated:', details.reason);
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await browser.storage.local.get(['serverUrl', 'autoConnect']);
      
      if (stored.serverUrl) {
        this.connectionState.serverUrl = stored.serverUrl;
      }

      // 如果开启自动连接，则尝试连接
      if (stored.autoConnect) {
        this.connectToServer();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private async handleMessage(message: any, sender: any): Promise<any> {
    const { type, payload } = message;

    switch (type) {
      case 'GET_CONNECTION_STATE':
        return this.getConnectionState();

      case 'CONNECT_TO_SERVER':
      case 'Connect':
        return await this.connectToServer(payload?.serverUrl || payload?.url);

      case 'DISCONNECT_FROM_SERVER':
      case 'Disconnect':
        return this.disconnectFromServer();

      case 'UPDATE_SERVER_URL':
        return await this.updateServerUrl(payload.serverUrl);

      case 'SEND_CONTEXT_REQUEST':
      case 'GetContext':
        return await this.sendContextRequest(payload);

      case 'SEND_MENU_ACTION':
        return await this.handleMenuAction(payload);

      case 'AUTHENTICATE':
        return await this.authenticate(payload);

      case 'GetFile':
        return await this.getFile(payload);

      case 'Grep':
        return await this.grep(payload);

      default:
        console.warn('Unknown message type:', type);
        return { success: false, error: 'Unknown message type' };
    }
  }

  private getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  private async connectToServer(serverUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (serverUrl) {
        this.connectionState.serverUrl = serverUrl;
        await browser.storage.local.set({ serverUrl });
      }

      if (this.protocolClient) {
        this.protocolClient.disconnect();
      }

      this.protocolClient = createProtocolClient({
        serverUrl: this.connectionState.serverUrl,
        timeout: 10000,
        reconnectInterval: 3000,
        maxReconnectAttempts: 3
      });

      this.setupProtocolClientEvents();
      await this.protocolClient.connect();

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.connectionState.error = errorMessage;
      this.updateConnectionState(false);
      return { success: false, error: errorMessage };
    }
  }

  private disconnectFromServer(): { success: boolean } {
    if (this.protocolClient) {
      this.protocolClient.disconnect();
      this.protocolClient = null;
    }
    
    this.updateConnectionState(false);
    return { success: true };
  }

  private async updateServerUrl(serverUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.connectionState.serverUrl = serverUrl;
      await browser.storage.local.set({ serverUrl });

      if (this.protocolClient) {
        this.protocolClient.updateServerUrl(serverUrl);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update server URL' };
    }
  }

  private setupProtocolClientEvents(): void {
    if (!this.protocolClient) return;

    this.protocolClient.on('connected', () => {
      this.updateConnectionState(true);
      this.broadcastToTabs('CONNECTION_STATE_CHANGED', this.connectionState);
    });

    this.protocolClient.on('disconnected', () => {
      this.updateConnectionState(false);
      this.broadcastToTabs('CONNECTION_STATE_CHANGED', this.connectionState);
    });

    this.protocolClient.on('error', (error: Error) => {
      this.connectionState.error = error.message;
      this.updateConnectionState(false);
      this.broadcastToTabs('CONNECTION_STATE_CHANGED', this.connectionState);
    });
  }

  private updateConnectionState(connected: boolean): void {
    this.connectionState.connected = connected;
    if (connected) {
      this.connectionState.error = undefined;
    }
  }

  private async broadcastToTabs(type: string, payload: any): Promise<void> {
    try {
      const tabs = await browser.tabs.query({});
      const message = { type, payload };
      
      for (const tab of tabs) {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, message).catch(() => {
            // 忽略错误，有些标签页可能没有 content script
          });
        }
      }
    } catch (error) {
      console.error('Error broadcasting to tabs:', error);
    }
  }

  private async sendContextRequest(payload: any): Promise<any> {
    if (!this.protocolClient || !this.protocolClient.isConnected()) {
      return { success: false, error: 'Not connected to server' };
    }

    try {
      const response = await this.protocolClient.sendRequest('get_context', {
        type: payload.type || 'page_context',
        url: payload.url,
        content: payload.content,
        selection: payload.selection,
        timestamp: Date.now()
      });

      return { success: true, data: response, timestamp: Date.now() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Context request failed', timestamp: Date.now() };
    }
  }

  private async handleMenuAction(payload: any): Promise<any> {
    if (!this.protocolClient || !this.protocolClient.isConnected()) {
      return { success: false, error: 'Not connected to server' };
    }

    try {
      const { action, text, url, selection } = payload;

      // 发送菜单操作事件
      await this.protocolClient.sendEvent('menu_action', {
        action,
        text,
        url,
        selection,
        timestamp: Date.now()
      });

      // 根据动作类型处理
      switch (action) {
        case 'explain':
        case 'improve':
        case 'debug':
          // 发送代码分析请求
          const response = await this.protocolClient.sendRequest('analyze_code', {
            code: text,
            action,
            context: { url, selection }
          });
          return { success: true, data: response };

        default:
          return { success: true, message: 'Action sent to server' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Menu action failed' };
    }
  }

  private async authenticate(payload: any): Promise<any> {
    if (!this.protocolClient || !this.protocolClient.isConnected()) {
      return { success: false, error: 'Not connected to server' };
    }

    try {
      const response = await this.protocolClient.sendRequest('authenticate', {
        token: payload.token,
        provider: payload.provider || 'browser'
      });

      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Authentication failed' };
    }
  }

  private async getFile(payload: any): Promise<any> {
    if (!this.protocolClient || !this.protocolClient.isConnected()) {
      return { success: false, error: 'Not connected to server', timestamp: Date.now() };
    }

    try {
      const response = await this.protocolClient.sendRequest('read_file', {
        path: payload.path,
        encoding: payload.encoding || 'utf8'
      });

      return { success: true, data: response, timestamp: Date.now() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'File request failed', timestamp: Date.now() };
    }
  }

  private async grep(payload: any): Promise<any> {
    if (!this.protocolClient || !this.protocolClient.isConnected()) {
      return { success: false, error: 'Not connected to server', timestamp: Date.now() };
    }

    try {
      const response = await this.protocolClient.sendRequest('grep_search', {
        pattern: payload.pattern,
        path: payload.path,
        options: payload.options || {}
      });

      return { success: true, data: response, timestamp: Date.now() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Grep request failed', timestamp: Date.now() };
    }
  }
}

// 初始化背景服务
export default defineBackground(() => {
  const backgroundService = new BackgroundService();
  console.log('ConnAI background service initialized with protocol client');
});
