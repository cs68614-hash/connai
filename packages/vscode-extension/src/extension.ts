import * as vscode from 'vscode';
import { getProtocolServer } from './server/protocol-server';
import { registerCommands, createStatusBarItems, updateStatusBarItems } from './commands';
import { WhopAuth } from './auth/whop';
import { MachineCheck } from './auth/machineCheck';
import { getWorkspaceManager } from './utils/workspaceManager';
import { CopilotChatManager } from './copilot/chatManager';

let statusBarItems: vscode.StatusBarItem[] = [];
let whopAuth: WhopAuth;
let machineCheck: MachineCheck;
let copilotChatManager: CopilotChatManager;

export async function activate(context: vscode.ExtensionContext) {
	console.log('ConnAI extension is now active!');

	// 初始化工作区管理器
	const workspaceManager = getWorkspaceManager();
	await workspaceManager.initializeWorkspace();

	// 初始化认证和机器检查
	whopAuth = new WhopAuth(context);
	machineCheck = new MachineCheck(context);

	// 初始化 Copilot 聊天管理器
	copilotChatManager = new CopilotChatManager();
	context.subscriptions.push(copilotChatManager);

	// 注册命令
	registerCommands(context);

	// 创建状态栏项目
	statusBarItems = createStatusBarItems(context);

	// 处理URI回调（用于OAuth）
	const uriHandler = vscode.window.registerUriHandler({
		handleUri: async (uri: vscode.Uri) => {
			if (uri.path === '/auth/callback') {
				await whopAuth.handleUriCallback(uri);
				updateStatusBar();
			}
		}
	});
	context.subscriptions.push(uriHandler);

	// 监听工作区变化
	const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
		console.log('Workspace folders changed, reinitializing...');
		await workspaceManager.initializeWorkspace();
		
		// 重启服务器以使用新的端口
		const protocolServer = getProtocolServer();
		await protocolServer.stopServer();
		await checkAuthAndStartServer();
		
		updateStatusBar();
	});
	context.subscriptions.push(workspaceWatcher);

	// 检查认证状态并启动服务器
	await checkAuthAndStartServer();

	// 启动定期检查
	const tokenRefreshTimer = whopAuth.startTokenRefreshTimer();
	const machineCheckTimer = machineCheck.startMachineCheckTimer();
	context.subscriptions.push(tokenRefreshTimer, machineCheckTimer);

	// 定期更新状态栏
	const statusUpdateTimer = setInterval(updateStatusBar, 5000);
	context.subscriptions.push(new vscode.Disposable(() => {
		clearInterval(statusUpdateTimer);
	}));

	// 初始状态栏更新
	updateStatusBar();
}

export function deactivate() {
	console.log('ConnAI extension is deactivating...');
	
	// 清理工作区管理器
	const workspaceManager = getWorkspaceManager();
	workspaceManager.cleanup();
	
	// 停止协议服务器
	const protocolServer = getProtocolServer();
	protocolServer.stopServer().catch((error: any) => {
		console.error('Error stopping server during deactivation:', error);
	});
}

/**
 * 检查认证状态并启动服务器
 */
async function checkAuthAndStartServer(): Promise<void> {
	try {
		// 测试模式：直接启动服务器，无需认证
		console.log('Starting ConnAI server in test mode...');
		
		const workspaceManager = getWorkspaceManager();
		const workspaceInfo = await workspaceManager.initializeWorkspace();
		
		const protocolServer = getProtocolServer();
		const started = await protocolServer.startServer(workspaceInfo.port);
		
		if (started) {
			console.log(`Protocol server started successfully in test mode on port ${workspaceInfo.port}`);
			console.log(`Workspace: ${workspaceInfo.name} (${workspaceInfo.id})`);
		} else {
			console.error('Failed to start protocol server');
			vscode.window.showErrorMessage('Failed to start ConnAI server');
		}

		/* TODO: 生产模式下的认证逻辑
		const authState = whopAuth.getAuthState();
		
		if (authState.isAuthenticated) {
			// 检查机器授权
			const machineAuth = await machineCheck.checkMachineAuthorization();
			
			if (machineAuth.isAuthorized) {
				// 启动WebSocket服务器
				const webSocketManager = getWebSocketManager();
				const started = await webSocketManager.startServer();
				
				if (started) {
					console.log('WebSocket server started successfully');
				}
			} else {
				// 处理机器限制
				if (machineAuth.machineCount >= machineAuth.maxMachines) {
					await machineCheck.handleMachineLimitExceeded();
				} else {
					await machineCheck.registerMachine();
				}
			}
		} else {
			vscode.window.showInformationMessage(
				'ConnAI requires authentication to function. Please login to continue.',
				'Login'
			).then(selection => {
				if (selection === 'Login') {
					vscode.commands.executeCommand('connai.auth.login');
				}
			});
		}
		*/
	} catch (error) {
		console.error('Failed to check auth and start server:', error);
		vscode.window.showErrorMessage(`ConnAI initialization failed: ${error}`);
	}

	// 返回扩展的公共 API（可选）
	return {
		copilotChatManager,
		getProtocolServer: () => getProtocolServer(),
		getWorkspaceManager: () => getWorkspaceManager()
	} as any;
}

/**
 * 更新状态栏
 */
function updateStatusBar(): void {
	try {
		const protocolServer = getProtocolServer();
		const serverStatus = protocolServer.getServerStatus();
		const authState = whopAuth.getAuthState();
		
		updateStatusBarItems(
			statusBarItems,
			serverStatus.isRunning,
			authState.isAuthenticated,
			serverStatus.connectedClients
		);
	} catch (error) {
		console.error('Failed to update status bar:', error);
	}
}

/**
 * 获取 Copilot 聊天管理器实例
 */
export function getCopilotChatManager(): CopilotChatManager | undefined {
	return copilotChatManager;
}
