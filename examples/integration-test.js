#!/usr/bin/env node
/**
 * ConnAI 多工作区集成测试
 * 全面测试多工作区功能的各个方面
 */

const WebSocket = require('ws');
const { io } = require('socket.io-client');

class ConnAIIntegrationTest {
    constructor() {
        this.testResults = [];
        this.workspaces = [
            { name: 'Frontend Project', port: 6718 },
            { name: 'Backend API', port: 6719 },
            { name: 'Mobile App', port: 6720 }
        ];
    }

    async runAllTests() {
        console.log('🧪 Starting ConnAI Multi-Workspace Integration Tests\n');

        try {
            // 1. 测试工作区发现
            await this.testWorkspaceDiscovery();
            
            // 2. 测试连接管理
            await this.testConnectionManagement();
            
            // 3. 测试 API 功能
            await this.testAPIFunctionality();
            
            // 4. 测试并发连接
            await this.testConcurrentConnections();
            
            // 5. 测试错误处理
            await this.testErrorHandling();

            // 总结测试结果
            this.printTestSummary();

        } catch (error) {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        }
    }

    async testWorkspaceDiscovery() {
        console.log('🔍 Testing Workspace Discovery...');
        
        for (const workspace of this.workspaces) {
            const result = await this.testSingleWorkspaceDiscovery(workspace);
            this.testResults.push({
                category: 'Discovery',
                test: `Discover ${workspace.name}`,
                result: result.success ? 'PASS' : 'FAIL',
                details: result.details
            });
        }
    }

    async testSingleWorkspaceDiscovery(workspace) {
        try {
            const response = await fetch(`http://localhost:${workspace.port}`);
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    details: `Found workspace with ${data.connectedClients} clients`
                };
            } else {
                return {
                    success: false,
                    details: `HTTP ${response.status}`
                };
            }
        } catch (error) {
            return {
                success: false,
                details: `Connection failed: ${error.message}`
            };
        }
    }

    async testConnectionManagement() {
        console.log('🔗 Testing Connection Management...');
        
        // 测试 Socket.IO 连接
        for (const workspace of this.workspaces) {
            const result = await this.testSocketConnection(workspace);
            this.testResults.push({
                category: 'Connection',
                test: `Connect to ${workspace.name}`,
                result: result.success ? 'PASS' : 'FAIL',
                details: result.details
            });
        }
    }

    async testSocketConnection(workspace) {
        return new Promise((resolve) => {
            const socket = io(`http://localhost:${workspace.port}`, {
                timeout: 5000
            });

            const timeout = setTimeout(() => {
                socket.disconnect();
                resolve({
                    success: false,
                    details: 'Connection timeout'
                });
            }, 5000);

            socket.on('connect', () => {
                clearTimeout(timeout);
                
                // 测试认证
                socket.emit('auth', { token: 'test-token' });
                
                socket.once('auth-result', (result) => {
                    socket.disconnect();
                    resolve({
                        success: result.success,
                        details: result.success ? 'Authentication successful' : result.error
                    });
                });
            });

            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    details: `Connection error: ${error.message}`
                });
            });
        });
    }

    async testAPIFunctionality() {
        console.log('📡 Testing API Functionality...');
        
        // 选择第一个工作区进行详细 API 测试
        const testWorkspace = this.workspaces[0];
        const socket = io(`http://localhost:${testWorkspace.port}`, {
            timeout: 10000
        });

        try {
            await this.authenticateSocket(socket);
            
            // 测试各种 API 端点
            const apiTests = [
                { event: 'get-context', data: { type: 'workspace' }, response: 'context-response' },
                { event: 'get-context', data: { type: 'cursor' }, response: 'context-response' },
                { event: 'get-context', data: { type: 'diagnostics' }, response: 'context-response' },
                { event: 'get-file', data: { path: '/test/file.ts' }, response: 'file-response' },
                { event: 'search-files', data: { query: '*.ts' }, response: 'search-response' },
                { event: 'execute-command', data: { command: 'test.command' }, response: 'command-response' },
                { event: 'ping', data: {}, response: 'pong' }
            ];

            for (const test of apiTests) {
                const result = await this.testAPIEndpoint(socket, test);
                this.testResults.push({
                    category: 'API',
                    test: `${test.event} (${testWorkspace.name})`,
                    result: result.success ? 'PASS' : 'FAIL',
                    details: result.details
                });
            }

        } catch (error) {
            this.testResults.push({
                category: 'API',
                test: 'API Authentication',
                result: 'FAIL',
                details: error.message
            });
        } finally {
            socket.disconnect();
        }
    }

    async authenticateSocket(socket) {
        return new Promise((resolve, reject) => {
            socket.on('connect', () => {
                socket.emit('auth', { token: 'test-token' });
                
                socket.once('auth-result', (result) => {
                    if (result.success) {
                        resolve();
                    } else {
                        reject(new Error(result.error || 'Authentication failed'));
                    }
                });
            });

            socket.on('connect_error', (error) => {
                reject(error);
            });

            setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 5000);
        });
    }

    async testAPIEndpoint(socket, test) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    success: false,
                    details: 'Request timeout'
                });
            }, 5000);

            socket.emit(test.event, test.data);

            socket.once(test.response, (response) => {
                clearTimeout(timeout);
                resolve({
                    success: true,
                    details: `Response received: ${JSON.stringify(response).substring(0, 100)}...`
                });
            });
        });
    }

    async testConcurrentConnections() {
        console.log('🔄 Testing Concurrent Connections...');
        
        const testWorkspace = this.workspaces[0];
        const connectionPromises = [];
        const connectionCount = 5;

        for (let i = 0; i < connectionCount; i++) {
            connectionPromises.push(this.testConcurrentConnection(testWorkspace, i));
        }

        try {
            const results = await Promise.all(connectionPromises);
            const successCount = results.filter(r => r.success).length;
            
            this.testResults.push({
                category: 'Concurrency',
                test: `${connectionCount} Concurrent Connections`,
                result: successCount === connectionCount ? 'PASS' : 'PARTIAL',
                details: `${successCount}/${connectionCount} connections successful`
            });
        } catch (error) {
            this.testResults.push({
                category: 'Concurrency',
                test: 'Concurrent Connections',
                result: 'FAIL',
                details: error.message
            });
        }
    }

    async testConcurrentConnection(workspace, index) {
        return new Promise((resolve) => {
            const socket = io(`http://localhost:${workspace.port}`, {
                timeout: 3000
            });

            const timeout = setTimeout(() => {
                socket.disconnect();
                resolve({
                    success: false,
                    details: `Connection ${index} timeout`
                });
            }, 3000);

            socket.on('connect', () => {
                socket.emit('auth', { token: `test-token-${index}` });
                
                socket.once('auth-result', (result) => {
                    clearTimeout(timeout);
                    socket.disconnect();
                    resolve({
                        success: result.success,
                        details: `Connection ${index} ${result.success ? 'successful' : 'failed'}`
                    });
                });
            });

            socket.on('connect_error', () => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    details: `Connection ${index} error`
                });
            });
        });
    }

    async testErrorHandling() {
        console.log('⚠️ Testing Error Handling...');
        
        // 测试无效端口
        const invalidResult = await this.testSingleWorkspaceDiscovery({ name: 'Invalid', port: 9999 });
        this.testResults.push({
            category: 'Error Handling',
            test: 'Invalid Port Connection',
            result: !invalidResult.success ? 'PASS' : 'FAIL',
            details: 'Should fail to connect to invalid port'
        });

        // 测试无效认证
        const authResult = await this.testInvalidAuth();
        this.testResults.push({
            category: 'Error Handling',
            test: 'Invalid Authentication',
            result: authResult.success ? 'PASS' : 'FAIL',
            details: authResult.details
        });
    }

    async testInvalidAuth() {
        return new Promise((resolve) => {
            const socket = io(`http://localhost:${this.workspaces[0].port}`, {
                timeout: 3000
            });

            socket.on('connect', () => {
                // 发送无效认证
                socket.emit('auth', {});
                
                socket.once('auth-result', (result) => {
                    socket.disconnect();
                    resolve({
                        success: !result.success, // 应该失败
                        details: result.success ? 'Should have failed auth' : 'Correctly rejected invalid auth'
                    });
                });
            });

            setTimeout(() => {
                socket.disconnect();
                resolve({
                    success: false,
                    details: 'Auth test timeout'
                });
            }, 3000);
        });
    }

    printTestSummary() {
        console.log('\n📊 Test Results Summary');
        console.log('========================\n');

        const categories = [...new Set(this.testResults.map(r => r.category))];
        
        categories.forEach(category => {
            const categoryTests = this.testResults.filter(r => r.category === category);
            const passed = categoryTests.filter(r => r.result === 'PASS').length;
            const total = categoryTests.length;
            
            console.log(`${category}: ${passed}/${total} tests passed`);
            
            categoryTests.forEach(test => {
                const icon = test.result === 'PASS' ? '✅' : test.result === 'PARTIAL' ? '⚠️' : '❌';
                console.log(`  ${icon} ${test.test}: ${test.result}`);
                if (test.result !== 'PASS') {
                    console.log(`     Details: ${test.details}`);
                }
            });
            console.log();
        });

        const totalPassed = this.testResults.filter(r => r.result === 'PASS').length;
        const totalTests = this.testResults.length;
        const successRate = ((totalPassed / totalTests) * 100).toFixed(1);

        console.log(`🎯 Overall Results: ${totalPassed}/${totalTests} tests passed (${successRate}%)`);
        
        if (successRate >= 90) {
            console.log('🎉 Excellent! Multi-workspace functionality is working well.');
        } else if (successRate >= 70) {
            console.log('👍 Good! Most functionality is working, but some issues need attention.');
        } else {
            console.log('⚠️ Warning! Multiple issues detected. Please review the failures.');
        }
    }
}

// 运行测试
async function main() {
    const tester = new ConnAIIntegrationTest();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ConnAIIntegrationTest;
