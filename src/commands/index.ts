import * as vscode from 'vscode';
import { COMMAND_IDS } from '../utils/constants';
import { getWebSocketManager } from '../server/manager';
import { getWorkspaceManager } from '../utils/workspaceManager';
// import { WhopAuth } from '../auth/whop'; // 暂时注释，等待创建文件
import { cache } from '../utils/cache';

/**
 * 注册所有 VS Code 命令
 */

export function registerCommands(context: vscode.ExtensionContext): void {
  const webSocketManager = getWebSocketManager();
  // const whopAuth = new WhopAuth(context); // 暂时注释，等待创建文件

  // 认证相关命令
  const loginCommand = vscode.commands.registerCommand(COMMAND_IDS.LOGIN, async () => {
    try {
      // await whopAuth.login(); // 暂时注释
      vscode.window.showInformationMessage('Login functionality coming soon');
    } catch (error) {
      vscode.window.showErrorMessage(`Login failed: ${error}`);
    }
  });

  const logoutCommand = vscode.commands.registerCommand(COMMAND_IDS.LOGOUT, async () => {
    try {
      // await whopAuth.logout(); // 暂时注释
      vscode.window.showInformationMessage('Logged out successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Logout failed: ${error}`);
    }
  });

  // 服务器相关命令
  const startServerCommand = vscode.commands.registerCommand(COMMAND_IDS.START_SERVER, async () => {
    try {
      const started = await webSocketManager.startServer();
      if (started) {
        vscode.window.showInformationMessage('WebSocket server started successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start server: ${error}`);
    }
  });

  const stopServerCommand = vscode.commands.registerCommand(COMMAND_IDS.STOP_SERVER, async () => {
    try {
      await webSocketManager.stopServer();
      vscode.window.showInformationMessage('WebSocket server stopped');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop server: ${error}`);
    }
  });

  const restartServerCommand = vscode.commands.registerCommand(COMMAND_IDS.RESTART_SERVER, async () => {
    try {
      const restarted = await webSocketManager.restartServer();
      if (restarted) {
        vscode.window.showInformationMessage('WebSocket server restarted successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to restart server: ${error}`);
    }
  });

  // 上下文发送相关命令
  const sendFileCommand = vscode.commands.registerCommand(COMMAND_IDS.SEND_FILE, async (uri?: vscode.Uri) => {
    try {
      const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
      
      if (!fileUri) {
        vscode.window.showWarningMessage('No file selected');
        return;
      }

      // 发送文件内容到连接的客户端
      const message = {
        type: 'file_content',
        data: {
          uri: fileUri.toString(),
          path: fileUri.fsPath,
        },
        timestamp: Date.now(),
      };

      webSocketManager.broadcast(message as any);
      vscode.window.showInformationMessage('File sent to connected clients');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send file: ${error}`);
    }
  });

  const sendSelectionCommand = vscode.commands.registerCommand(COMMAND_IDS.SEND_SELECTION, async () => {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor || activeEditor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const selectedText = activeEditor.document.getText(activeEditor.selection);
      
      const message = {
        type: 'selection_content',
        data: {
          text: selectedText,
          uri: activeEditor.document.uri.toString(),
          selection: {
            start: {
              line: activeEditor.selection.start.line,
              character: activeEditor.selection.start.character,
            },
            end: {
              line: activeEditor.selection.end.line,
              character: activeEditor.selection.end.character,
            },
          },
        },
        timestamp: Date.now(),
      };

      webSocketManager.broadcast(message as any);
      vscode.window.showInformationMessage('Selection sent to connected clients');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send selection: ${error}`);
    }
  });

  const sendWorkspaceCommand = vscode.commands.registerCommand(COMMAND_IDS.SEND_WORKSPACE, async () => {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace open');
        return;
      }

      const message = {
        type: 'workspace_content',
        data: {
          folders: workspaceFolders.map(folder => ({
            uri: folder.uri.toString(),
            name: folder.name,
            path: folder.uri.fsPath,
          })),
        },
        timestamp: Date.now(),
      };

      webSocketManager.broadcast(message as any);
      vscode.window.showInformationMessage('Workspace info sent to connected clients');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send workspace: ${error}`);
    }
  });

  // 缓存相关命令
  const clearCacheCommand = vscode.commands.registerCommand(COMMAND_IDS.CLEAR_CACHE, async () => {
    try {
      cache.clear();
      vscode.window.showInformationMessage('Cache cleared successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
    }
  });

  // 状态显示命令
  const showStatusCommand = vscode.commands.registerCommand(COMMAND_IDS.SHOW_STATUS, async () => {
    try {
      const serverStatus = webSocketManager.getServerStatus();
      const workspaceManager = getWorkspaceManager();
      const workspaceInfo = workspaceManager.getCurrentWorkspace();
      // const authStatus = whopAuth.getAuthState(); // 暂时注释
      
      const statusMessage = `
ConnAI Status:
- Server: ${serverStatus.isRunning ? 'Running' : 'Stopped'}
- Port: ${serverStatus.port}
- Connected Clients: ${serverStatus.connectedClients}
- Authentication: Test Mode (Any token accepted)

Workspace Info:
- Name: ${workspaceInfo?.name || 'Unknown'}
- ID: ${workspaceInfo?.id || 'None'}
- Assigned Port: ${workspaceInfo?.port || 'None'}
- Folders: ${workspaceInfo?.folders.length || 0}

💡 To test: Start server, then open demo.html and use any token to connect.
      `.trim();

      vscode.window.showInformationMessage(statusMessage);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show status: ${error}`);
    }
  });

  // 注册所有命令到上下文
  context.subscriptions.push(
    loginCommand,
    logoutCommand,
    startServerCommand,
    stopServerCommand,
    restartServerCommand,
    sendFileCommand,
    sendSelectionCommand,
    sendWorkspaceCommand,
    clearCacheCommand,
    showStatusCommand
  );
}

/**
 * 创建上下文菜单
 */
export function createContextMenus(): void {
  // 这里可以添加自定义的上下文菜单项
  // 通常在 package.json 的 contributes.menus 中定义
}

/**
 * 创建状态栏项目
 */
export function createStatusBarItems(context: vscode.ExtensionContext): vscode.StatusBarItem[] {
  const statusBarItems: vscode.StatusBarItem[] = [];

  // 服务器状态
  const serverStatusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  serverStatusItem.text = '$(server-process) ConnAI';
  serverStatusItem.tooltip = 'ConnAI WebSocket Server';
  serverStatusItem.command = COMMAND_IDS.SHOW_STATUS;
  serverStatusItem.show();
  statusBarItems.push(serverStatusItem);

  // 认证状态
  const authStatusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );
  authStatusItem.text = '$(account) Auth';
  authStatusItem.tooltip = 'ConnAI Authentication Status';
  authStatusItem.command = COMMAND_IDS.LOGIN;
  authStatusItem.show();
  statusBarItems.push(authStatusItem);

  // 注册到上下文以便清理
  context.subscriptions.push(...statusBarItems);

  return statusBarItems;
}

/**
 * 更新状态栏项目
 */
export function updateStatusBarItems(
  statusBarItems: vscode.StatusBarItem[],
  serverRunning: boolean,
  authenticated: boolean,
  connectedClients: number
): void {
  if (statusBarItems.length >= 2) {
    const [serverItem, authItem] = statusBarItems;
    
    // 获取工作区信息
    const workspaceManager = getWorkspaceManager();
    const workspaceInfo = workspaceManager.getCurrentWorkspace();
    
    // 更新服务器状态
    const portInfo = workspaceInfo ? `:${workspaceInfo.port}` : '';
    const workspaceShortName = workspaceInfo?.name ? ` (${workspaceInfo.name})` : '';
    
    serverItem.text = `$(server-process) ConnAI${portInfo} ${serverRunning ? '●' : '○'}`;
    serverItem.tooltip = serverRunning 
      ? `ConnAI WebSocket Server - Running on port ${workspaceInfo?.port || 'unknown'}${workspaceShortName}\n${connectedClients} client(s) connected`
      : `ConnAI WebSocket Server - Stopped${workspaceShortName}`;
    serverItem.backgroundColor = serverRunning 
      ? new vscode.ThemeColor('statusBarItem.activeBackground')
      : new vscode.ThemeColor('statusBarItem.errorBackground');

    // 更新认证状态
    authItem.text = `$(account) ${authenticated ? 'Authenticated' : 'Test Mode'}`;
    authItem.tooltip = `ConnAI Authentication - ${authenticated ? 'Authenticated' : 'Test Mode (Any token accepted)'}`;
    authItem.backgroundColor = authenticated
      ? new vscode.ThemeColor('statusBarItem.activeBackground')
      : new vscode.ThemeColor('statusBarItem.warningBackground');
  }
}
