# ConnAI Development Guide

This guide provides detailed information for developers working on the ConnAI extension.

## Architecture Overview

ConnAI follows a modular architecture with clear separation of concerns:

```
src/
├── extension.ts          # Main extension entry point
├── types/               # TypeScript type definitions
├── utils/               # Utility functions and helpers
├── server/              # WebSocket server implementation
├── context/             # Context providers for various data sources
├── commands/            # VS Code command implementations
├── auth/                # Authentication and authorization
└── test/                # Test files
```

## Core Components

### 1. Extension Entry Point (`extension.ts`)

The main extension file that:
- Initializes all components
- Manages extension lifecycle
- Handles activation and deactivation
- Coordinates between different modules

### 2. Server Management (`server/`)

- **Manager** (`manager.ts`): WebSocket server lifecycle management
- **Handlers** (`handlers.ts`): Message routing and processing

### 3. Context Providers (`context/`)

Each provider is responsible for extracting specific types of context:

- **VSCProvider**: Overall VS Code and workspace state
- **FileProvider**: Individual file content and metadata
- **FolderProvider**: Directory structure and contents
- **FileTreeProvider**: Complete file tree representation
- **CursorProvider**: Editor cursor and selection state
- **DiagnosticsProvider**: Code errors, warnings, and suggestions
- **RecentChangesProvider**: File modification history

### 4. Authentication (`auth/`)

- **WhopAuth**: Whop.com OAuth integration
- **MachineCheck**: Device registration and license validation

### 5. Utilities (`utils/`)

- **Constants**: Configuration and enumeration values
- **Cache**: Performance caching system
- **GPTTok**: AI token counting and text processing
- **Ignore**: File filtering based on .gitignore rules
- **UriHelper**: URI manipulation and validation

## Development Workflow

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- VS Code 1.101.0+
- TypeScript 5.8+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd connai

# Install dependencies
pnpm install

# Start development mode
pnpm run watch
```

### Commands

```bash
# Type checking
pnpm run check-types

# Linting
pnpm run lint

# Build for production
pnpm run package

# Run tests
pnpm test

# Watch mode (auto-rebuild on changes)
pnpm run watch
```

### Testing

Launch the Extension Development Host:
1. Open VS Code in the project directory
2. Press `F5` to launch the Extension Development Host
3. Test your changes in the new VS Code window

### Debugging

- Set breakpoints in TypeScript files
- Use `console.log()` or VS Code's debugging tools
- Check the Developer Console (`Help > Toggle Developer Tools`)
- Monitor the Output panel for extension logs

## Adding New Features

### 1. Adding a New Context Provider

1. Create a new file in `src/context/`
2. Implement the provider interface
3. Export the provider from the context module
4. Register it in the server handlers
5. Add corresponding types to `src/types/`

Example:
```typescript
// src/context/myProvider.ts
export class MyProvider {
  async getContext(): Promise<MyContextType> {
    // Implementation
  }
}
```

### 2. Adding a New Command

1. Define the command in `package.json` contributions
2. Implement the command handler in `src/commands/`
3. Register the command in the main extension file

### 3. Adding New WebSocket Events

1. Define message types in `src/types/`
2. Add handlers in `src/server/handlers.ts`
3. Update client documentation

## Configuration

Extension settings are defined in `package.json` under `contributes.configuration`. All settings are prefixed with `connai.`.

Example:
```json
{
  "connai.server.port": {
    "type": "number",
    "default": 8080,
    "description": "WebSocket server port"
  }
}
```

## Error Handling

- Use try-catch blocks for async operations
- Log errors with context information
- Provide meaningful error messages to users
- Handle network failures gracefully

## Performance Considerations

- Use caching for expensive operations
- Implement debouncing for frequent events
- Limit the size of data sent over WebSocket
- Use VS Code's built-in APIs efficiently

## Security

- Validate all input from WebSocket clients
- Implement proper authentication checks
- Sanitize file paths and URIs
- Use HTTPS for external API calls

## Testing Guidelines

- Write unit tests for utility functions
- Test error conditions and edge cases
- Mock VS Code APIs in tests
- Test WebSocket communication

## Code Style

- Follow TypeScript best practices
- Use ESLint configuration provided
- Write descriptive comments for complex logic
- Use proper error types and handling

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` with new features
3. Create a new git tag: `git tag v1.0.0`
4. Push tags: `git push origin --tags`
5. GitHub Actions will handle the rest

## Troubleshooting

### Common Issues

1. **TypeScript errors**: Run `pnpm run check-types`
2. **Build failures**: Check ESLint output
3. **Extension not loading**: Check VS Code Developer Console
4. **WebSocket connection issues**: Verify port configuration

### Debug Tools

- VS Code Extension Host Developer Tools
- Network tab for WebSocket connections
- Extension Output panel
- VS Code Problems panel for TypeScript errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the guidelines
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## API Documentation

### WebSocket Events

#### Authentication
- `auth`: Authenticate client with token
- `auth-result`: Authentication response

#### Context Requests
- `get-context`: Request workspace context
- `get-file`: Request specific file content
- `search-files`: Search for files

#### Responses
- `context-response`: Context data response
- `file-response`: File content response
- `search-response`: Search results

### Internal APIs

See the TypeScript definitions in `src/types/` for complete API documentation.

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Socket.io Documentation](https://socket.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Whop API Documentation](https://dev.whop.com/)

---

For questions or support, please create an issue in the GitHub repository.
