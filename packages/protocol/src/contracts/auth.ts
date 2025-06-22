/**
 * ConnAI Protocol Authentication Contracts
 * 
 * Defines standard contracts for authentication across different editors and platforms
 */

// Authentication methods
export enum AuthMethod {
  TOKEN = 'token',
  OAUTH = 'oauth',
  CERTIFICATE = 'certificate',
  API_KEY = 'api_key',
  WHOP = 'whop',
  MACHINE_CHECK = 'machine_check'
}

// Authentication status
export enum AuthStatus {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  EXPIRED = 'expired',
  FAILED = 'failed',
  REVOKED = 'revoked'
}

// Authentication request interface
export interface AuthRequest {
  method: AuthMethod;
  credentials?: AuthCredentials;
  options?: AuthRequestOptions;
}

// Authentication credentials
export interface AuthCredentials {
  token?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  refreshToken?: string;
  certificate?: string;
  privateKey?: string;
  whopToken?: string;
  machineId?: string;
}

// Authentication request options
export interface AuthRequestOptions {
  scope?: string[];
  expiresIn?: number; // seconds
  rememberMe?: boolean;
  autoRefresh?: boolean;
  redirectUri?: string; // for OAuth
}

// Authentication response interface
export interface AuthResponse {
  success: boolean;
  status: AuthStatus;
  user?: AuthUser;
  tokens?: AuthTokens;
  expiresAt?: number;
  error?: string;
  errorCode?: string;
}

// Authenticated user info
export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  name?: string;
  avatar?: string;
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, any>;
}

// Authentication tokens
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string; // 'Bearer', 'Basic', etc.
  expiresIn?: number; // seconds
  scope?: string[];
}

// Authentication info interface
export interface AuthInfo {
  status: AuthStatus;
  method?: AuthMethod;
  user?: AuthUser;
  tokens?: AuthTokens;
  authenticatedAt?: number;
  expiresAt?: number;
  lastRefreshedAt?: number;
}

// Authentication event interface
export interface AuthEvent {
  type: 'login' | 'logout' | 'refresh' | 'expired' | 'revoked';
  timestamp: number;
  user?: AuthUser;
  error?: string;
}

// OAuth configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope?: string[];
}

// Whop authentication configuration
export interface WhopConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
}

// Machine check configuration
export interface MachineCheckConfig {
  serverUrl: string;
  checkInterval?: number; // seconds
  maxRetries?: number;
}

// Permission check interface
export interface PermissionCheck {
  resource: string;
  action: string;
  context?: Record<string, any>;
}

// Permission result interface
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  conditions?: Record<string, any>;
}

// Authentication contract interface - to be implemented by editor adapters
export interface AuthContract {
  /**
   * Authenticate user
   */
  authenticate(request: AuthRequest): Promise<AuthResponse>;
  
  /**
   * Get current authentication status
   */
  getAuthInfo(): Promise<AuthInfo>;
  
  /**
   * Refresh authentication tokens
   */
  refreshAuth(refreshToken?: string): Promise<AuthResponse>;
  
  /**
   * Logout user
   */
  logout(): Promise<void>;
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): Promise<boolean>;
  
  /**
   * Check user permissions
   */
  checkPermission(check: PermissionCheck): Promise<PermissionResult>;
  
  /**
   * Check multiple permissions
   */
  checkPermissions(checks: PermissionCheck[]): Promise<PermissionResult[]>;
  
  /**
   * Get user profile
   */
  getUserProfile(): Promise<AuthUser | null>;
  
  /**
   * Update user profile
   */
  updateUserProfile(updates: Partial<AuthUser>): Promise<AuthResponse>;
  
  /**
   * Get supported authentication methods
   */
  getSupportedMethods(): AuthMethod[];
  
  /**
   * Start OAuth flow
   */
  startOAuthFlow?(config: OAuthConfig): Promise<string>; // returns authorization URL
  
  /**
   * Handle OAuth callback
   */
  handleOAuthCallback?(code: string, state?: string): Promise<AuthResponse>;
  
  /**
   * Start Whop authentication
   */
  startWhopAuth?(config: WhopConfig): Promise<string>;
  
  /**
   * Handle Whop callback
   */
  handleWhopCallback?(code: string): Promise<AuthResponse>;
  
  /**
   * Perform machine check
   */
  performMachineCheck?(config: MachineCheckConfig): Promise<AuthResponse>;
}

// Authentication utilities
export class AuthUtils {
  /**
   * Validate authentication credentials
   */
  static validateCredentials(credentials: AuthCredentials, method: AuthMethod): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    switch (method) {
      case AuthMethod.TOKEN:
        if (!credentials.token) {
          errors.push('Token is required');
        }
        break;
        
      case AuthMethod.API_KEY:
        if (!credentials.apiKey) {
          errors.push('API key is required');
        }
        break;
        
      case AuthMethod.OAUTH:
        // OAuth validation happens during flow
        break;
        
      case AuthMethod.CERTIFICATE:
        if (!credentials.certificate) {
          errors.push('Certificate is required');
        }
        break;
        
      case AuthMethod.WHOP:
        if (!credentials.whopToken) {
          errors.push('Whop token is required');
        }
        break;
        
      case AuthMethod.MACHINE_CHECK:
        if (!credentials.machineId) {
          errors.push('Machine ID is required');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if authentication is expired
   */
  static isExpired(authInfo: AuthInfo): boolean {
    if (!authInfo.expiresAt) {
      return false;
    }
    
    return Date.now() >= authInfo.expiresAt;
  }
  
  /**
   * Check if authentication needs refresh
   */
  static needsRefresh(authInfo: AuthInfo, bufferTime: number = 300000): boolean { // 5 minutes buffer
    if (!authInfo.expiresAt) {
      return false;
    }
    
    return Date.now() >= (authInfo.expiresAt - bufferTime);
  }
  
  /**
   * Generate secure random token
   */
  static generateToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
  
  /**
   * Parse JWT token (basic parsing, not verification)
   */
  static parseJWT(token: string): { header: any; payload: any; signature: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const signature = parts[2];
      
      return { header, payload, signature };
    } catch {
      return null;
    }
  }
  
  /**
   * Check if JWT token is expired
   */
  static isJWTExpired(token: string): boolean {
    const parsed = this.parseJWT(token);
    if (!parsed || !parsed.payload.exp) {
      return true;
    }
    
    return Date.now() >= parsed.payload.exp * 1000;
  }
  
  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): number | null {
    const parsed = this.parseJWT(token);
    if (!parsed || !parsed.payload.exp) {
      return null;
    }
    
    return parsed.payload.exp * 1000;
  }
  
  /**
   * Mask sensitive data for logging
   */
  static maskCredentials(credentials: AuthCredentials): Partial<AuthCredentials> {
    const masked: Partial<AuthCredentials> = {};
    
    if (credentials.token) {
      masked.token = credentials.token.substring(0, 8) + '...';
    }
    
    if (credentials.apiKey) {
      masked.apiKey = credentials.apiKey.substring(0, 8) + '...';
    }
    
    if (credentials.password) {
      masked.password = '***';
    }
    
    if (credentials.refreshToken) {
      masked.refreshToken = credentials.refreshToken.substring(0, 8) + '...';
    }
    
    if (credentials.username) {
      masked.username = credentials.username;
    }
    
    return masked;
  }
  
  /**
   * Check if user has permission
   */
  static hasPermission(user: AuthUser, resource: string, action: string): boolean {
    if (!user.permissions) {
      return false;
    }
    
    // Check exact permission
    const exactPermission = `${resource}:${action}`;
    if (user.permissions.includes(exactPermission)) {
      return true;
    }
    
    // Check wildcard permissions
    const resourceWildcard = `${resource}:*`;
    if (user.permissions.includes(resourceWildcard)) {
      return true;
    }
    
    const actionWildcard = `*:${action}`;
    if (user.permissions.includes(actionWildcard)) {
      return true;
    }
    
    // Check admin permission
    if (user.permissions.includes('*:*')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if user has role
   */
  static hasRole(user: AuthUser, role: string): boolean {
    return user.roles?.includes(role) || false;
  }
  
  /**
   * Get user display name
   */
  static getDisplayName(user: AuthUser): string {
    return user.name || user.username || user.email || 'Unknown User';
  }
}
