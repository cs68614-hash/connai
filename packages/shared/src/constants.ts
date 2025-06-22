/**
 * 共享常量定义
 */

// 通信协议版本
export const PROTOCOL_VERSION = '1.0.0';

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
  MAX_PAYLOAD_SIZE: 50 * 1024 * 1024, // 50MB
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
    GPT_4_TURBO: 'cl100k_base',
    CLAUDE: 'cl100k_base', // Claude 使用类似的 tokenizer
  },
  MAX_TOKENS: {
    GPT_3_5: 16385,
    GPT_4: 8192,
    GPT_4_TURBO: 128000,
    CLAUDE: 200000,
  },
  MAX_TOKENS_PER_REQUEST: 32000,
} as const;

// 命令 ID
export const COMMAND_IDS = {
  // 认证命令
  LOGIN: 'connai.auth.login',
  LOGOUT: 'connai.auth.logout',
  
  // 服务器管理
  START_SERVER: 'connai.startServer',
  STOP_SERVER: 'connai.stopServer',
  RESTART_SERVER: 'connai.restartServer',
  
  // 状态查看
  SHOW_STATUS: 'connai.showStatus',
  
  // 上下文发送
  SEND_FILE: 'connai.sendFile',
  SEND_SELECTION: 'connai.sendSelection',
  SEND_WORKSPACE: 'connai.sendWorkspace',
  SEND_DIAGNOSTICS: 'connai.sendDiagnostics',
  
  // 设置和配置
  OPEN_SETTINGS: 'connai.openSettings',
  CLEAR_CACHE: 'connai.clearCache',
} as const;

// 错误信息
export const ERROR_MESSAGES = {
  // 服务器相关
  SERVER_START_FAILED: 'Failed to start ConnAI server',
  SERVER_STOP_FAILED: 'Failed to stop ConnAI server',
  SERVER_ALREADY_RUNNING: 'ConnAI server is already running',
  SERVER_NOT_RUNNING: 'ConnAI server is not running',
  
  // 认证相关
  AUTH_FAILED: 'Authentication failed',
  AUTH_EXPIRED: 'Authentication token expired',
  AUTH_REQUIRED: 'Authentication required',
  AUTHENTICATION_FAILED: 'Authentication failed',
  
  // 文件操作
  FILE_NOT_FOUND: 'File not found',
  FILE_READ_ERROR: 'Failed to read file',
  FILE_WRITE_ERROR: 'Failed to write file',
  
  // 网络相关
  CONNECTION_FAILED: 'Failed to connect to server',
  REQUEST_TIMEOUT: 'Request timeout',
  NETWORK_ERROR: 'Network error occurred',
  
  // 权限相关
  PERMISSION_DENIED: 'Permission denied',
  UNAUTHORIZED: 'Unauthorized access',
  
  // 一般错误
  UNKNOWN_ERROR: 'Unknown error occurred',
  INVALID_REQUEST: 'Invalid request format',
} as const;

// 成功信息
export const SUCCESS_MESSAGES = {
  SERVER_STARTED: 'ConnAI server started successfully',
  SERVER_STOPPED: 'ConnAI server stopped successfully',
  AUTH_SUCCESS: 'Authentication successful',
  FILE_SAVED: 'File saved successfully',
  CONTEXT_SENT: 'Context sent to connected clients',
} as const;

// 浏览器扩展配置
export const BROWSER_EXTENSION_CONFIG = {
  // 触发字符
  GLOBAL_TRIGGER_CHAR: '@',
  
  // 支持的 AI 平台
  SUPPORTED_PLATFORMS: [
    'chat.openai.com',
    'claude.ai',
    'bard.google.com',
    'www.bing.com',
    'you.com'
  ],
  
  // 上下文限制
  MAX_CONTEXT_SIZE: 1000000, // 1MB
  MAX_FILES_PER_REQUEST: 50,
  
  // UI 配置
  MENU_MAX_HEIGHT: 400,
  MENU_MAX_WIDTH: 600,
  
  // 存储键名
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'accessToken',
    USER_INFO: 'user',
    VSC_CONNECTION: 'vscIsConnected',
    SESSION_ID: 'sessionId',
    SETTINGS: 'settings',
  },
} as const;

// GitHub 配置
export const GITHUB_CONFIG = {
  API_BASE: 'https://api.github.com',
  RAW_BASE: 'https://raw.githubusercontent.com',
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
  SUPPORTED_EXTENSIONS: [
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.py', '.java', '.c', '.cpp', '.cs', '.php',
    '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
    '.html', '.css', '.scss', '.less', '.md', '.txt',
    '.json', '.xml', '.yaml', '.yml', '.toml'
  ],
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
