/**
 * 项目常量定义
 */

// 服务器配置
export const SERVER_CONFIG = {
  DEFAULT_PORT: 6718,
  DEFAULT_HOST: 'localhost',
  CORS_ORIGINS: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'file://', // 允许本地文件访问
    'https://chat.openai.com',
    'https://claude.ai'
  ],
  MAX_CONNECTIONS: 10,
  HEARTBEAT_INTERVAL: 30000, // 30秒
} as const;

// 认证配置
export const AUTH_CONFIG = {
  WHOP_CLIENT_ID: process.env.WHOP_CLIENT_ID || '',
  WHOP_CLIENT_SECRET: process.env.WHOP_CLIENT_SECRET || '',
  WHOP_REDIRECT_URI: 'vscode://publisher.connai/auth/callback',
  WHOP_SCOPES: ['read:user', 'read:subscription'],
  TOKEN_REFRESH_THRESHOLD: 300000, // 5分钟
} as const;

// 机器检查配置
export const MACHINE_CONFIG = {
  API_ENDPOINT: 'https://api.bringyourai.com',
  CHECK_INTERVAL: 3600000, // 1小时
  MAX_MACHINES: 3,
} as const;

// 文件监听配置
export const WATCHER_CONFIG = {
  DEBOUNCE_DELAY: 300, // 300ms
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  EXCLUDED_EXTENSIONS: ['.exe', '.dll', '.so', '.dylib', '.bin', '.obj'],
  EXCLUDED_FOLDERS: ['node_modules', '.git', 'dist', 'build', 'out'],
} as const;

// 缓存配置
export const CACHE_CONFIG = {
  MAX_FILE_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  CACHE_TTL: 300000, // 5分钟
  MAX_CACHE_ENTRIES: 1000,
} as const;

// tiktoken 配置
export const TOKEN_CONFIG = {
  DEFAULT_MODEL: 'cl100k_base',
  MODELS: {
    GPT_3_5: 'cl100k_base',
    GPT_4: 'cl100k_base',
    GPT_4O: 'o200k_base',
  },
  MAX_TOKENS_PER_REQUEST: 32000,
} as const;

// Git 忽略默认规则
export const DEFAULT_IGNORE_PATTERNS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/coverage/**',
  '**/.nyc_output/**',
  '**/logs/**',
  '**/*.log',
  '**/tmp/**',
  '**/temp/**',
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/*.tmp',
  '**/*.temp',
] as const;

// 错误消息
export const ERROR_MESSAGES = {
  AUTHENTICATION_FAILED: 'Authentication failed',
  UNAUTHORIZED: 'Unauthorized access',
  SERVER_START_FAILED: 'Failed to start WebSocket server',
  FILE_NOT_FOUND: 'File not found',
  PERMISSION_DENIED: 'Permission denied',
  INVALID_REQUEST: 'Invalid request',
  SUBSCRIPTION_EXPIRED: 'Subscription expired',
  MACHINE_LIMIT_EXCEEDED: 'Machine limit exceeded',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;

// 成功消息
export const SUCCESS_MESSAGES = {
  AUTHENTICATED: 'Successfully authenticated',
  SERVER_STARTED: 'WebSocket server started',
  FILE_SAVED: 'File saved successfully',
  FILE_DELETED: 'File deleted successfully',
  CACHE_CLEARED: 'Cache cleared successfully',
} as const;

// 扩展配置键
export const CONFIG_KEYS = {
  AUTH_TOKEN: 'connai.auth.token',
  REFRESH_TOKEN: 'connai.auth.refreshToken',
  MACHINE_ID: 'connai.machine.id',
  SERVER_PORT: 'connai.server.port',
  AUTO_START: 'connai.server.autoStart',
  IGNORE_PATTERNS: 'connai.files.ignorePatterns',
  MAX_FILE_SIZE: 'connai.files.maxSize',
} as const;

// 命令 ID
export const COMMAND_IDS = {
  LOGIN: 'connai.auth.login',
  LOGOUT: 'connai.auth.logout',
  START_SERVER: 'connai.server.start',
  STOP_SERVER: 'connai.server.stop',
  RESTART_SERVER: 'connai.server.restart',
  SEND_FILE: 'connai.context.sendFile',
  SEND_SELECTION: 'connai.context.sendSelection',
  SEND_WORKSPACE: 'connai.context.sendWorkspace',
  CLEAR_CACHE: 'connai.cache.clear',
  SHOW_STATUS: 'connai.status.show',
} as const;

// 状态栏优先级
export const STATUS_BAR_PRIORITY = {
  CONNECTION: 100,
  AUTH: 90,
  SERVER: 80,
} as const;
