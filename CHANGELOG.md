# Change Log

All notable changes to the ConnAI extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- WebSocket server integration for bridging VS Code with web clients
- Whop.com OAuth authentication and subscription management
- Multi-device license validation and machine registration
- Complete workspace context extraction and analysis
- AI token counting with tiktoken integration
- Smart file filtering with .gitignore support
- Real-time file content and structure monitoring
- Cursor position and selection tracking
- Diagnostics information (errors, warnings, suggestions)
- Recent changes tracking and history
- Remote command execution capabilities
- Caching system for performance optimization
- Comprehensive configuration options
- TypeScript implementation with full type safety

### Technical Features
- Socket.io WebSocket server with authentication
- Context providers for workspace, files, folders, cursor, diagnostics
- Modular architecture with clear separation of concerns
- Comprehensive error handling and logging
- Unit tests and CI/CD pipeline setup
- VS Code extension packaging and distribution

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