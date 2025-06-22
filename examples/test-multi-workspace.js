#!/usr/bin/env node
/**
 * 多工作区测试脚本
 * 模拟多个 VS Code 工作区运行在不同端口
 */

const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// 模拟工作区配置
const workspaces = [
    {
        id: 'workspace-1',
        name: 'Frontend Project',
        path: '/Users/developer/projects/frontend',
        port: 6718,
        folders: [
            { name: 'src', path: '/Users/developer/projects/frontend/src' },
            { name: 'public', path: '/Users/developer/projects/frontend/public' }
        ]
    },
    {
        id: 'workspace-2', 
        name: 'Backend API',
        path: '/Users/developer/projects/backend',
        port: 6719,
        folders: [
            { name: 'src', path: '/Users/developer/projects/backend/src' },
            { name: 'tests', path: '/Users/developer/projects/backend/tests' }
        ]
    },
    {
        id: 'workspace-3',
        name: 'Mobile App',
        path: '/Users/developer/projects/mobile',
        port: 6720,
        folders: [
            { name: 'src', path: '/Users/developer/projects/mobile/src' },
            { name: 'assets', path: '/Users/developer/projects/mobile/assets' }
        ]
    }
];

class MockWorkspaceServer {
    constructor(workspace) {
        this.workspace = workspace;
        this.httpServer = null;
        this.io = null;
        this.connectedClients = 0;
    }

    start() {
        return new Promise((resolve, reject) => {
            this.httpServer = http.createServer((req, res) => {
                // Handle basic HTTP requests
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    workspace: this.workspace,
                    connectedClients: this.connectedClients
                }));
            });

            this.io = new Server(this.httpServer, {
                cors: {
                    origin: true,
                    credentials: true,
                    methods: ['GET', 'POST']
                }
            });

            this.setupSocketHandlers();

            this.httpServer.listen(this.workspace.port, 'localhost', () => {
                console.log(`🚀 Mock workspace "${this.workspace.name}" running on port ${this.workspace.port}`);
                resolve();
            });

            this.httpServer.on('error', reject);
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.connectedClients++;
            console.log(`📱 Client connected to ${this.workspace.name} (${this.connectedClients} total)`);

            socket.on('auth', (data) => {
                // Mock authentication - accept any token
                if (data && data.token) {
                    socket.emit('auth-result', {
                        success: true,
                        user: {
                            id: 'test-user',
                            name: 'Test User'
                        }
                    });
                    console.log(`✅ Authentication successful for ${this.workspace.name}`);
                } else {
                    socket.emit('auth-result', {
                        success: false,
                        error: 'No token provided'
                    });
                }
            });

            socket.on('get-context', (data) => {
                if (data.type === 'workspace') {
                    socket.emit('context-response', {
                        data: {
                            workspace: {
                                id: this.workspace.id,
                                name: this.workspace.name,
                                path: this.workspace.path,
                                port: this.workspace.port,
                                folderCount: this.workspace.folders.length,
                                folders: this.workspace.folders.map(folder => ({
                                    name: folder.name,
                                    path: folder.path,
                                    index: this.workspace.folders.indexOf(folder)
                                })),
                                isActive: true,
                                lastActivity: new Date().toISOString()
                            },
                            workspaceFolders: this.workspace.folders,
                            timestamp: Date.now()
                        }
                    });
                } else if (data.type === 'cursor') {
                    socket.emit('context-response', {
                        data: {
                            activeEditor: {
                                uri: `file://${this.workspace.path}/src/index.ts`,
                                fileName: 'index.ts',
                                language: 'typescript',
                                selection: {
                                    start: { line: Math.floor(Math.random() * 100), character: 0 },
                                    end: { line: Math.floor(Math.random() * 100), character: 10 }
                                }
                            }
                        }
                    });
                } else if (data.type === 'diagnostics') {
                    socket.emit('context-response', {
                        data: {
                            diagnostics: [
                                {
                                    file: `${this.workspace.path}/src/main.ts`,
                                    line: 42,
                                    message: 'Unused variable',
                                    severity: 'warning'
                                }
                            ]
                        }
                    });
                }
            });

            socket.on('get-file', (data) => {
                socket.emit('file-response', {
                    data: {
                        path: data.path,
                        content: `// Mock file content for ${this.workspace.name}\n// Path: ${data.path}\n\nexport function example() {\n    return 'Hello from ${this.workspace.name}';\n}`,
                        language: path.extname(data.path).substring(1) || 'plaintext',
                        size: 256,
                        lastModified: new Date().toISOString()
                    }
                });
            });

            socket.on('search-files', (data) => {
                const mockFiles = this.workspace.folders.flatMap(folder => [
                    `${folder.path}/index.ts`,
                    `${folder.path}/utils.ts`,
                    `${folder.path}/types.ts`
                ]);

                socket.emit('search-response', {
                    data: {
                        query: data.query,
                        results: mockFiles.filter(file => 
                            file.endsWith('.ts') || file.endsWith('.js')
                        ).map(file => ({
                            path: file,
                            type: 'file',
                            size: Math.floor(Math.random() * 10000) + 1000
                        }))
                    }
                });
            });

            socket.on('execute-command', (data) => {
                socket.emit('command-response', {
                    data: {
                        command: data.command,
                        result: `Command "${data.command}" executed successfully in ${this.workspace.name}`,
                        success: true
                    }
                });
            });

            socket.on('ping', () => {
                socket.emit('pong', { timestamp: Date.now() });
            });

            socket.on('disconnect', () => {
                this.connectedClients--;
                console.log(`👋 Client disconnected from ${this.workspace.name} (${this.connectedClients} remaining)`);
            });
        });
    }

    async stop() {
        if (this.io) {
            this.io.close();
        }
        if (this.httpServer) {
            return new Promise((resolve) => {
                this.httpServer.close(resolve);
            });
        }
    }
}

class MultiWorkspaceTestRunner {
    constructor() {
        this.servers = [];
    }

    async startAll() {
        console.log('📋 Starting mock workspace servers...');
        
        for (const workspace of workspaces) {
            const server = new MockWorkspaceServer(workspace);
            try {
                await server.start();
                this.servers.push(server);
            } catch (error) {
                if (error.code === 'EADDRINUSE') {
                    console.log(`⚠️  Port ${workspace.port} already in use, skipping ${workspace.name}`);
                } else {
                    console.error(`❌ Failed to start ${workspace.name}:`, error.message);
                }
            }
        }

        console.log(`\n✅ Started ${this.servers.length} mock workspace servers`);
        console.log('\n📍 Available workspaces:');
        this.servers.forEach(server => {
            console.log(`   • ${server.workspace.name} - http://localhost:${server.workspace.port}`);
        });

        console.log('\n🌐 Open multi-workspace-demo.html to test the multi-workspace functionality');
        console.log('🔍 Use "Discover Workspaces" to find all running workspaces');
        console.log('\n⏹️  Press Ctrl+C to stop all servers');
    }

    async stopAll() {
        console.log('\n🛑 Stopping all mock workspace servers...');
        
        for (const server of this.servers) {
            await server.stop();
        }
        
        console.log('✅ All servers stopped');
        process.exit(0);
    }
}

// Main execution
async function main() {
    const runner = new MultiWorkspaceTestRunner();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        runner.stopAll();
    });
    
    process.on('SIGTERM', () => {
        runner.stopAll();
    });

    await runner.startAll();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MultiWorkspaceTestRunner, MockWorkspaceServer };
