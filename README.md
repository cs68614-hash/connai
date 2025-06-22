# ConnAI - AI-Powered Code Context Bridge

[![Build Status](https://github.com/cs68614-hash/connai/workflows/CI/badge.svg)](https://github.com/cs68614-hash/connai/actions)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/cs68614-hash/connai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/vscode)

ConnAI is a modern Monorepo project that seamlessly bridges VS Code with web browsers, enabling AI-powered code context sharing through a standardized protocol. Built with a multi-package architecture, it provides real-time, bidirectional communication between your local development environment and any web application.

## ✨ Features

### 🏗️ Monorepo Architecture
- **Multi-package workspace** with pnpm workspaces
- **Shared protocol** (@connai/protocol) for cross-package communication
- **Unified build system** and development workflow
- **Cross-package type safety** and dependency management

### 🔌 Protocol-Based Communication
- **Standardized ConnAI Protocol** for editor-agnostic communication
- **HTTP RESTful API** with auto-discovery and health monitoring
- **Smart port management** with automatic detection (6718-6817, 8080-8090)
- **Auto-connect functionality** - zero configuration required
- **WebSocket support** (coming soon) for real-time push notifications

### 🌐 Browser Extension (Chrome/Edge)
- **Universal web integration** - works on any website
- **Smart input detection** - type `#` in any input field to trigger
- **Context menu integration** with rich UI and visual feedback
- **Auto-connect to VS Code** with intelligent port scanning
- **Background connection management** with health checks and reconnection
- **Manual server configuration** when auto-detection fails

### 🖥️ VS Code Extension
- **HTTP protocol server** on configurable ports
- **Multi-workspace support** with automatic port assignment
- **Real-time context extraction** from active editor
- **Rich context types**: focused file, selected text, open tabs, problems, file tree
- **File operations** and workspace management
- **Health monitoring** and diagnostic endpoints

### 🧠 AI-Optimized Context Analysis
- **Token-aware processing** for AI model optimization
- **Smart file filtering** with .gitignore support
- **Metadata enrichment** with file types and structure analysis
- **Configurable context depth** and scope control

## 🏗️ Architecture Overview

ConnAI is built as a modern Monorepo with four main packages:

```
packages/
├── protocol/          # 🔌 Core protocol layer
├── vscode-extension/  # 🖥️ VS Code integration  
├── browser-extension/ # 🌐 Browser extension (Chrome/Edge)
└── shared/           # 📦 Shared utilities and types
```

### Communication Flow

```
Browser Extension → HTTP Protocol → VS Code Extension → VS Code API
        ↓                              ↓                    ↓
   Auto-discovery                 Port management        Context extraction
   Smart reconnect               Health monitoring       File operations
   User interface                Protocol server         Workspace info
```

### Protocol Layer (@connai/protocol)

The heart of ConnAI is its standardized protocol layer that provides:

- **Editor-agnostic interface** for future extensibility (Cursor, WebStorm, etc.)
- **Type-safe message contracts** for reliable communication
- **Transport abstraction** supporting HTTP and WebSocket
- **Capability negotiation** for feature discovery
- **Error handling** with detailed diagnostics and retry logic

```typescript
// Example protocol usage
import { createProtocolClient } from '@connai/protocol';

const client = createProtocolClient({
  serverUrl: 'http://localhost:6797',
  timeout: 10000,
  maxReconnectAttempts: 5
});

await client.connect();
const context = await client.sendRequest('get_context', {
  type: 'focused_file',
  workspaceId: 'default'
});
```

## 🚀 Quick Start

### 1. Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd connai

# Install dependencies
pnpm install

# Build all packages
pnpm run build
```

### 2. VS Code Extension

```bash
# Build VS Code extension
cd packages/vscode-extension
pnpm run compile

# Install in VS Code
# Method 1: Development mode
# - Press F5 to launch Extension Development Host
# Method 2: Install VSIX
# - Package: pnpm run package
# - Install via Extensions: "Install from VSIX"
```

### 3. Browser Extension

```bash
# Build browser extension
cd packages/browser-extension
pnpm build

# Install in Chrome/Edge
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select packages/browser-extension/.output/chrome-mv3/
```

### 4. Usage

1. **Start VS Code** with a project open
2. **Activate ConnAI extension** (starts automatically on first use)
3. **Install browser extension** (auto-connects to VS Code)
4. **Go to any webpage** with text inputs
5. **Type `#`** in any input field → Context menu appears
6. **Select context type** → VS Code data is inserted automatically

## 🎯 Use Cases

### For AI Development
- **ChatGPT/Claude Integration**: Easily share code context with AI assistants
- **Code Review Assistance**: Provide full context for AI-powered code reviews
- **Documentation Generation**: Share project structure for AI documentation tools
- **Debugging Help**: Include relevant code and error context in AI queries

### For Web Development  
- **Issue Reporting**: Automatically include relevant code context in bug reports
- **Code Sharing**: Share code snippets with full context on forums/chat
- **Pair Programming**: Remote collaboration with shared context
- **Technical Support**: Provide complete context when asking for help

### for Content Creation
- **Technical Writing**: Include live code examples in documentation
- **Tutorials/Courses**: Dynamic code context for educational content
- **Blog Posts**: Embed current project state in technical articles
- **Code Reviews**: Share context-rich code snippets for review

## 🔧 Configuration

### VS Code Extension Settings

```json
{
  "connai.server.port": 6797,
  "connai.server.host": "127.0.0.1",
  "connai.workspace.basePort": 6718,
  "connai.workspace.portRange": 100,
  "connai.cache.ttl": 300000,
  "connai.ignore.useGitignore": true,
  "connai.ignore.customPatterns": ["*.log", "tmp/", "node_modules/"]
}
```

### Browser Extension Settings

The browser extension automatically detects VS Code servers but can be manually configured:

- **Auto-detect servers**: Scans ports 6718-6817 and 8080-8090
- **Manual configuration**: Set specific server URL and port in popup
- **Connection timeout**: Configurable timeout for server connections (default: 10s)
- **Reconnection settings**: Automatic reconnection with exponential backoff

### Supported Context Types

| Context Type | Description | VS Code Command | Browser Shortcut |
|-------------|-------------|-----------------|------------------|
| 📄 Focused File | Current active file content | `connai.getFocusedFile` | Type `#` → Select |
| 🎯 Selected Text | Currently selected text/cursor | `connai.getSelectedText` | Type `#` → Select |
| 📑 All Open Tabs | List of all open editor tabs | `connai.getAllOpenTabs` | Type `#` → Select |
| ⚠️ Problems | Current errors and warnings | `connai.getProblems` | Type `#` → Select |
| 🌲 File Tree | Project file structure | `connai.getFileTree` | Type `#` → Select |
| 📚 Full Workspace | Complete project overview | `connai.getFullWorkspace` | Type `#` → Select |

## 💻 Development

### Prerequisites

- Node.js 18+ (with pnpm)
- VS Code 1.101.0+
- TypeScript 5.8+
- Chrome/Edge for browser extension testing

### Development Setup

```bash
# Clone and setup
git clone <repository-url>
cd connai
pnpm install

# Build all packages
pnpm run build

# Watch mode for development
pnpm run dev

# Run specific package in watch mode
cd packages/vscode-extension && pnpm run watch
cd packages/browser-extension && pnpm run dev
cd packages/protocol && pnpm run build:watch
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/protocol && pnpm test
cd packages/vscode-extension && pnpm test

# Integration testing
# 1. Start VS Code Extension Development Host (F5)
# 2. Load browser extension in development mode
# 3. Open test-integration.html for end-to-end testing
```

### Project Structure

```
connai/
├── packages/
│   ├── protocol/                    # Core protocol implementation
│   │   ├── src/
│   │   │   ├── core/               # Protocol core (message, transport)
│   │   │   ├── contracts/          # API contracts (context, file, workspace)
│   │   │   ├── adapters/           # Editor adapters (VS Code, future: Cursor)
│   │   │   └── index.ts            # Public API
│   │   └── package.json
│   │
│   ├── vscode-extension/           # VS Code extension
│   │   ├── src/
│   │   │   ├── extension.ts        # Main extension entry
│   │   │   ├── server/             # HTTP protocol server
│   │   │   ├── context/            # Context providers
│   │   │   ├── commands/           # VS Code commands
│   │   │   └── utils/              # Utilities and helpers
│   │   └── package.json
│   │
│   ├── browser-extension/          # Browser extension (WXT + React)
│   │   ├── entrypoints/
│   │   │   ├── background.ts       # Service worker
│   │   │   ├── content.ts          # Content script
│   │   │   └── popup/              # Extension popup UI
│   │   ├── src/utils/              # Protocol client, port scanner
│   │   └── wxt.config.ts
│   │
│   └── shared/                     # Shared utilities
│       ├── src/
│       │   ├── types.ts            # Common types
│       │   ├── constants.ts        # Shared constants
│       │   └── utils.ts            # Helper functions
│       └── package.json
│
├── examples/                       # Example implementations
├── docs/                          # Documentation
├── pnpm-workspace.yaml            # Monorepo configuration
└── package.json                   # Root package configuration
```

## 🚀 Deployment

### VS Code Extension

```bash
# Package for distribution
cd packages/vscode-extension
pnpm run package

# Publish to marketplace (requires vsce)
pnpm run publish
```

### Browser Extension

```bash
# Build for production
cd packages/browser-extension
pnpm run build

# Package for Chrome Web Store
pnpm run package
```

## 📊 Current Status

### ✅ Completed Features

- [x] Monorepo architecture with pnpm workspaces
- [x] Core protocol layer (@connai/protocol)
- [x] VS Code extension with HTTP server
- [x] Browser extension with auto-connect
- [x] Smart port management and discovery
- [x] Rich context extraction (file, selection, tabs, problems, tree)
- [x] Background connection management
- [x] Multi-workspace support
- [x] Protocol integration between browser and VS Code
- [x] End-to-end testing setup

### 🚧 In Progress

- [ ] WebSocket protocol implementation
- [ ] Real-time push notifications
- [ ] Enhanced error handling and user feedback
- [ ] Performance optimization and caching

### 🔮 Future Plans

- [ ] Support for additional editors (Cursor, WebStorm)
- [ ] Advanced AI context optimization
- [ ] Team collaboration features
- [ ] Plugin architecture for custom context providers
- [ ] Performance monitoring and analytics

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Ensure tests pass**: `pnpm test`
6. **Submit a pull request**

### Development Guidelines

- Use TypeScript for all new code
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages

### Package Guidelines

- Keep packages focused and loosely coupled
- Use the shared package for common utilities
- Maintain clean public APIs
- Document all public interfaces

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **GitHub Issues**: [Create an issue](https://github.com/your-username/connai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/connai/discussions)
- **Documentation**: Check the `/docs` folder for detailed guides

## 🙏 Acknowledgments

- Built with [VS Code Extension API](https://code.visualstudio.com/api)
- Browser extension powered by [WXT Framework](https://wxt.dev/)
- UI components using React and modern web standards
- Monorepo management with [pnpm workspaces](https://pnpm.io/workspaces)

---

**Made with ❤️ for the AI development community**

*ConnAI bridges the gap between your local development environment and the web, making AI-assisted coding more seamless and powerful.*
