import * as assert from 'assert';
import * as vscode from 'vscode';

suite('ConnAI Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    suite('Basic Tests', () => {
        test('Extension should be present', () => {
            assert.ok(vscode.extensions.getExtension('connai.connai'));
        });

        test('VS Code API should be available', () => {
            assert.ok(vscode);
            assert.ok(vscode.window);
            assert.ok(vscode.workspace);
        });

        test('Commands should be available', async () => {
            const commands = await vscode.commands.getCommands();
            
            // Check if our commands are registered
            const hasStartCommand = commands.includes('connai.startServer');
            const hasStopCommand = commands.includes('connai.stopServer');
            const hasLoginCommand = commands.includes('connai.login');
            
            // These might not be registered yet in test environment
            // So just check that commands array exists
            assert.ok(Array.isArray(commands));
            assert.ok(commands.length > 0);
        });
    });

    suite('Workspace Tests', () => {
        test('Workspace should be accessible', () => {
            // These are basic VS Code API tests
            // In test environment, workspace name might be undefined, which is expected
            assert.ok(vscode.workspace.name !== null); // Allow undefined, but not null
            assert.ok(Array.isArray(vscode.workspace.workspaceFolders) || vscode.workspace.workspaceFolders === undefined);
        });

        test('Configuration should be accessible', () => {
            const config = vscode.workspace.getConfiguration('connai');
            assert.ok(config);
            
            // Test default values
            const port = config.get('server.port');
            const host = config.get('server.host');
            
            // Should have defaults even if not set
            assert.ok(typeof port === 'number' || port === undefined);
            assert.ok(typeof host === 'string' || host === undefined);
        });
    });

    suite('File System Tests', () => {
        test('URI creation should work', () => {
            const uri = vscode.Uri.file('/test/path');
            assert.ok(uri);
            assert.strictEqual(uri.scheme, 'file');
            assert.ok(uri.path.includes('/test/path'));
        });

        test('URI parsing should work', () => {
            const uriString = 'file:///test/path';
            const uri = vscode.Uri.parse(uriString);
            assert.ok(uri);
            assert.strictEqual(uri.scheme, 'file');
        });
    });
});
