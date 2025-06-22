import * as vscode from 'vscode';
import { AuthState, AUTH_CONFIG, CONFIG_KEYS } from '@connai/shared';

/**
 * 处理 Whop.com 的 OAuth 登录和订阅验证
 */

export class WhopAuth {
  private context: vscode.ExtensionContext;
  private authState: AuthState = { isAuthenticated: false };

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadAuthState();
  }

  /**
   * 启动登录流程
   */
  async login(): Promise<boolean> {
    try {
      // 构建授权 URL
      const authUrl = this.buildAuthUrl();
      
      // 打开外部浏览器进行授权
      await vscode.env.openExternal(vscode.Uri.parse(authUrl));
      
      // 显示等待消息
      const result = await vscode.window.showInformationMessage(
        'Please complete the authorization in your browser, then click "Completed" when done.',
        'Completed',
        'Cancel'
      );
      
      if (result === 'Completed') {
        // 这里应该有一个机制来接收授权回调
        // 由于这是一个复杂的OAuth流程，这里提供一个简化的实现
        return await this.handleAuthCallback();
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      // 清除存储的认证信息
      await this.context.secrets.delete(CONFIG_KEYS.AUTH_TOKEN);
      await this.context.secrets.delete(CONFIG_KEYS.REFRESH_TOKEN);
      
      this.authState = { isAuthenticated: false };
      
      vscode.window.showInformationMessage('Successfully logged out');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await this.context.secrets.get(CONFIG_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        return false;
      }

      // TODO: 实现实际的令牌刷新逻辑
      // 这里应该调用 Whop API 来刷新令牌
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * 验证当前令牌
   */
  async validateToken(): Promise<boolean> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      
      if (!accessToken) {
        return false;
      }

      // TODO: 实现实际的令牌验证逻辑
      // 这里应该调用 Whop API 来验证令牌
      
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * 检查订阅状态
   */
  async checkSubscriptionStatus(): Promise<{
    isValid: boolean;
    plan?: string;
    expiresAt?: number;
  }> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      
      if (!accessToken) {
        return { isValid: false };
      }

      // TODO: 实现实际的订阅检查逻辑
      // 这里应该调用 Whop API 来检查订阅状态
      
      return {
        isValid: true,
        plan: 'premium',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30天后
      };
    } catch (error) {
      console.error('Subscription check failed:', error);
      return { isValid: false };
    }
  }

  /**
   * 获取当前认证状态
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * 检查是否需要重新认证
   */
  async needsReauth(): Promise<boolean> {
    if (!this.authState.isAuthenticated) {
      return true;
    }

    if (this.authState.expiresAt && Date.now() > this.authState.expiresAt) {
      return true;
    }

    return !(await this.validateToken());
  }

  /**
   * 自动刷新令牌
   */
  async autoRefreshToken(): Promise<void> {
    if (this.authState.expiresAt && Date.now() > this.authState.expiresAt - AUTH_CONFIG.TOKEN_REFRESH_THRESHOLD) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        console.log('Token refreshed automatically');
      } else {
        console.warn('Failed to refresh token automatically');
      }
    }
  }

  /**
   * 启动定期令牌检查
   */
  startTokenRefreshTimer(): vscode.Disposable {
    const timer = setInterval(async () => {
      try {
        await this.autoRefreshToken();
      } catch (error) {
        console.error('Token refresh timer error:', error);
      }
    }, AUTH_CONFIG.TOKEN_REFRESH_THRESHOLD);

    return new vscode.Disposable(() => {
      clearInterval(timer);
    });
  }

  /**
   * 构建授权 URL
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: AUTH_CONFIG.WHOP_CLIENT_ID,
      redirect_uri: AUTH_CONFIG.WHOP_REDIRECT_URI,
      response_type: 'code',
      scope: AUTH_CONFIG.WHOP_SCOPES.join(' '),
      state: this.generateState(),
    });

    return `https://whop.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * 生成状态参数（用于安全）
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * 处理授权回调
   */
  private async handleAuthCallback(): Promise<boolean> {
    try {
      // 这里应该有一个机制来接收来自浏览器的授权码
      // 由于VS Code扩展的限制，这可能需要一个本地服务器或其他机制
      
      // 临时实现：让用户手动输入授权码
      const authCode = await vscode.window.showInputBox({
        prompt: 'Enter the authorization code from the browser',
        placeHolder: 'Authorization code',
        ignoreFocusOut: true,
      });

      if (!authCode) {
        return false;
      }

      // 交换授权码获取访问令牌
      const tokenData = await this.exchangeCodeForToken(authCode);
      
      if (tokenData) {
        // 保存令牌
        await this.context.secrets.store(CONFIG_KEYS.AUTH_TOKEN, tokenData.accessToken);
        if (tokenData.refreshToken) {
          await this.context.secrets.store(CONFIG_KEYS.REFRESH_TOKEN, tokenData.refreshToken);
        }

        // 更新认证状态
        this.authState = {
          isAuthenticated: true,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: Date.now() + (tokenData.expiresIn * 1000),
          user: tokenData.user,
        };

        return true;
      }

      return false;
    } catch (error) {
      console.error('Auth callback failed:', error);
      return false;
    }
  }

  /**
   * 交换授权码获取访问令牌
   */
  private async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    user?: any;
  } | null> {
    try {
      // TODO: 实现实际的令牌交换逻辑
      // 这里应该调用 Whop OAuth API
      
      // 临时返回模拟数据
      return {
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresIn: 3600, // 1小时
        user: {
          id: 'user_123',
          email: 'user@example.com',
          plan: 'premium',
        },
      };
    } catch (error) {
      console.error('Token exchange failed:', error);
      return null;
    }
  }

  /**
   * 从存储中加载认证状态
   */
  private async loadAuthState(): Promise<void> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      const refreshToken = await this.context.secrets.get(CONFIG_KEYS.REFRESH_TOKEN);

      if (accessToken) {
        // 验证令牌是否仍然有效
        const isValid = await this.validateToken();
        
        if (isValid) {
          this.authState = {
            isAuthenticated: true,
            accessToken,
            refreshToken,
            // 这里可以添加更多从令牌中解析的信息
          };
        }
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
    }
  }

  /**
   * 处理URI回调（当扩展被授权回调URL激活时）
   */
  async handleUriCallback(uri: vscode.Uri): Promise<boolean> {
    try {
      const query = new URLSearchParams(uri.query);
      const code = query.get('code');
      const state = query.get('state');
      const error = query.get('error');

      if (error) {
        vscode.window.showErrorMessage(`Authorization failed: ${error}`);
        return false;
      }

      if (!code) {
        vscode.window.showErrorMessage('No authorization code received');
        return false;
      }

      // 验证状态参数（如果实现了状态存储的话）
      
      // 交换代码获取令牌
      const tokenData = await this.exchangeCodeForToken(code);
      
      if (tokenData) {
        await this.context.secrets.store(CONFIG_KEYS.AUTH_TOKEN, tokenData.accessToken);
        if (tokenData.refreshToken) {
          await this.context.secrets.store(CONFIG_KEYS.REFRESH_TOKEN, tokenData.refreshToken);
        }

        this.authState = {
          isAuthenticated: true,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: Date.now() + (tokenData.expiresIn * 1000),
          user: tokenData.user,
        };

        vscode.window.showInformationMessage('Successfully authenticated with Whop!');
        return true;
      }

      return false;
    } catch (error) {
      console.error('URI callback failed:', error);
      vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      return false;
    }
  }
}
