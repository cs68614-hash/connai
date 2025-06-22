# ConnAI - VS Code Extension

[![Build Status](https://github.com/your-username/connai/workflows/CI/badge.svg)](https://github.com/your-username/connai/actions)
[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/your-username/connai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/vscode)

ConnAI is a powerful VS Code extension that bridges your editor with web clients, enabling AI-powered code context sharing, remote control, and advanced workspace management.

## Features

### 🌐 WebSocket Bridge
- Local WebSocket server integration
- Real-time communication with web clients
- Secure authentication and authorization

### 🔐 Authentication & Authorization
- Whop.com OAuth integration
- Subscription-based access control
- Multi-device license management
- Secure token validation

### 📊 Code Context Analysis
- Complete workspace context extraction
- File content and structure analysis
- AI token counting with tiktoken
- Smart file filtering with .gitignore support

### 🎮 Remote Control
- Execute VS Code commands remotely
- File operations through web interface
- Real-time workspace monitoring
- Cursor and selection tracking

### 🚀 AI Integration
- Token counting for various AI models
- Context optimization for AI prompts
- Smart content chunking and splitting
- Cache management for performance

## 🏗️ 多工作区支持

ConnAI 现在支持同时管理多个 VS Code 工作区，每个工作区运行在不同的端口上，提供完全独立的上下文和连接。

### 工作区标识系统

- **唯一标识符**: 每个工作区根据其路径生成唯一的 ID
- **自动端口分配**: 基于工作区 ID 自动分配端口 (6718-6818 范围)
- **工作区信息**: 包含名称、路径、文件夹数量等详细信息

### 多工作区管理

```typescript
// 工作区信息结构
interface WorkspaceInfo {
  id: string;           // 唯一标识符
  name: string;         // 工作区名称
  path: string;         // 工作区路径
  port: number;         // 分配的端口
  folders: WorkspaceFolder[];  // 包含的文件夹
  isActive: boolean;    // 是否活跃
  lastActivity: Date;   // 最后活动时间
}
```

### Web 客户端增强

新的 `multi-workspace-demo.html` 提供了完整的多工作区管理界面：

- **工作区发现**: 自动扫描端口范围，发现可用的工作区
- **可视化选择**: 网格视图显示所有发现的工作区
- **连接管理**: 支持同时连接多个工作区
- **状态监控**: 实时显示每个工作区的连接状态

### 使用示例

1. **启动多个 VS Code 窗口**:
   ```bash
   # 打开不同的项目文件夹
   code /path/to/frontend-project
   code /path/to/backend-project  
   code /path/to/mobile-project
   ```

2. **工作区自动配置**:
   - Frontend Project → 端口 6718
   - Backend Project → 端口 6719  
   - Mobile Project → 端口 6720

3. **Web 客户端连接**:
   ```html
   <!-- 打开多工作区演示页面 -->
   open examples/multi-workspace-demo.html
   
   <!-- 点击 "Discover Workspaces" 自动发现所有工作区 -->
   <!-- 选择要连接的工作区并进行操作 -->
   ```

### API 增强

所有现有 API 现在都包含工作区上下文信息：

```json
{
  "workspace": {
    "id": "workspace-abc123",
    "name": "My Project",
    "path": "/Users/developer/my-project",
    "port": 6718,
    "folderCount": 2,
    "folders": [
      {"name": "src", "path": "/Users/developer/my-project/src"},
      {"name": "tests", "path": "/Users/developer/my-project/tests"}
    ],
    "isActive": true,
    "lastActivity": "2025-06-22T10:30:00.000Z"
  }
}
```

### 测试工具

提供了完整的测试环境：

```bash
# 启动模拟多工作区服务器
node examples/test-multi-workspace.js

# 会创建 3 个模拟工作区:
# - Frontend Project (端口 6718)
# - Backend API (端口 6719)  
# - Mobile App (端口 6720)
```

### 配置选项

```json
{
  "connai.workspace.basePort": 6718,
  "connai.workspace.portRange": 100,
  "connai.workspace.autoDetect": true,
  "connai.workspace.displayName": "auto"
}
```

这个功能特别适用于：
- 🔄 **微服务开发**: 同时管理多个相关服务
- 📱 **全栈开发**: 前端、后端、移动端同时开发
- 🎯 **项目对比**: 比较不同项目的代码结构
- 🤖 **AI 辅助**: 为 AI 提供多项目上下文

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or install from VSIX package
3. Configure your Whop API credentials
4. Start the ConnAI server

## Configuration

The extension can be configured through VS Code settings:

```json
{
  "connai.server.port": 8080,
  "connai.server.host": "localhost",
  "connai.auth.whopApiKey": "your-whop-api-key",
  "connai.auth.productId": "your-product-id",
  "connai.machine.maxDevices": 3,
  "connai.cache.ttl": 300000,
  "connai.ignore.useGitignore": true,
  "connai.ignore.customPatterns": ["*.log", "tmp/"]
}
```

## Usage

### Starting the Server

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run `ConnAI: Start ConnAI Server`
3. The server will start on the configured port (default: 8080)

### Authentication

1. Run `ConnAI: Login to ConnAI`
2. Complete the OAuth flow in your browser
3. Your subscription will be validated automatically

### Connecting Web Clients

Connect your web application to the WebSocket server:

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:8080');

// Authenticate
socket.emit('auth', { token: 'your-auth-token' });

// Request workspace context
socket.emit('get-context', { type: 'workspace' });

// Listen for responses
socket.on('context-response', (data) => {
  console.log('Workspace context:', data);
});
```

## API Reference

### WebSocket Events

#### Client to Server

- `auth`: Authenticate with token
- `get-context`: Request workspace context
- `get-file`: Get specific file content
- `search-files`: Search for files
- `execute-command`: Execute VS Code command
- `get-diagnostics`: Get error/warning information

#### Server to Client

- `auth-result`: Authentication response
- `context-response`: Workspace context data
- `file-response`: File content response
- `search-response`: Search results
- `command-response`: Command execution result
- `diagnostics-response`: Diagnostics information

### Context Types

- `workspace`: Complete workspace overview
- `file`: Single file content and metadata
- `folder`: Folder structure and contents
- `cursor`: Current cursor position and selection
- `diagnostics`: Errors, warnings, and suggestions
- `recent-changes`: Recent file modifications

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.101.0+
- TypeScript 5.8+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd connai

# Install dependencies
pnpm install

# Build the extension
pnpm run compile

# Watch for changes
pnpm run watch
```

### Testing

```bash
# Run tests
pnpm test

# Run in development mode
F5 (Launch Extension Development Host)
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │    │   VS Code Ext    │    │   Whop.com      │
│                 │    │                  │    │                 │
│  ┌───────────┐  │    │  ┌─────────────┐ │    │  ┌───────────┐  │
│  │ Socket.io │◄─┼────┼─►│ WebSocket   │ │    │  │   OAuth   │  │
│  │  Client   │  │    │  │   Server    │ │    │  │  Service  │  │
│  └───────────┘  │    │  └─────────────┘ │    │  └───────────┘  │
│                 │    │         │        │    │         ▲       │
│  ┌───────────┐  │    │  ┌─────────────┐ │    │         │       │
│  │    AI     │  │    │  │  Context    │ │    │  ┌───────────┐  │
│  │ Assistant │  │    │  │ Providers   │ │    │  │   Auth    │  │
│  └───────────┘  │    │  └─────────────┘ │    │  │ Validation│  │
└─────────────────┘    │         │        │    │  └───────────┘  │
                       │  ┌─────────────┐ │    └─────────────────┘
                       │  │  Commands   │ │
                       │  │ & Handlers  │ │
                       │  └─────────────┘ │
                       └──────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact us through Whop.com
- Join our Discord community

---

Made with ❤️ for the AI development community
