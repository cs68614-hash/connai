# Changelog

All notable changes to the ConnAI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-06-22

### Added
- **Monorepo Architecture**: Complete refactor to pnpm workspace-based monorepo
- **Protocol Layer** (@connai/protocol): Standardized communication protocol for editor-agnostic integration
- **Browser Extension**: Chrome/Edge extension with smart input detection and auto-connect
- **Smart Port Management**: Automatic port detection and scanning (6718-6817, 8080-8090)
- **Auto-Connect Functionality**: Zero-configuration connection between browser and VS Code
- **Multi-Workspace Support**: Support for multiple VS Code instances with unique port assignment
- **Rich Context Types**: Focused file, selected text, open tabs, problems, file tree, full workspace
- **Background Connection Management**: Health checks, reconnection, and status monitoring
- **Protocol Server**: HTTP RESTful API with health monitoring and diagnostics
- **Integration Testing**: End-to-end testing setup with example HTML files

### Changed
- **Major Architecture Refactor**: Migrated from single package to monorepo structure
- **Communication Protocol**: Switched from WebSocket to HTTP-based protocol (WebSocket support coming soon)
- **VS Code Extension**: Refactored to use native http.Server instead of Express
- **Browser Integration**: Complete rewrite using WXT framework with React
- **Documentation**: Major README.md update with comprehensive feature documentation

### Technical Details
- **Packages**: 
  - `@connai/protocol`: Core protocol implementation
  - `@connai/vscode-extension`: VS Code integration
  - `@connai/browser-extension`: Browser extension (WXT + React)
  - `@connai/shared`: Shared utilities and types
- **Build System**: Unified pnpm workspace with cross-package dependencies
- **Type Safety**: Full TypeScript implementation with shared type definitions
- **Testing**: Integration tests and development tools

### Future Plans
- WebSocket protocol implementation for real-time push notifications
- Support for additional editors (Cursor, WebStorm, etc.)
- Enhanced AI context optimization
- Team collaboration features
- Performance monitoring and analytics

## [0.0.1] - 2024-06-21

### Added
- Initial project structure and core architecture
- Complete TypeScript implementation
- All major components and providers
- Basic testing framework
- Documentation and examples

### Infrastructure
- GitHub Actions CI/CD pipeline
- Package configuration for npm/pnpm
- ESLint and TypeScript configuration
- VS Code extension manifest and settings