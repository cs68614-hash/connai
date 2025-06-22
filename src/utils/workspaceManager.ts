import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * 工作区标识和管理
 */

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  folders: readonly vscode.WorkspaceFolder[];
  port: number;
  isActive: boolean;
  lastActivity: Date;
}

export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspaceInfo: WorkspaceInfo | null = null;
  private readonly basePort = 6718;

  private constructor() {}

  static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * 初始化当前工作区信息
   */
  async initializeWorkspace(): Promise<WorkspaceInfo> {
    if (this.workspaceInfo) {
      return this.workspaceInfo;
    }

    const folders = vscode.workspace.workspaceFolders || [];
    const workspaceName = this.generateWorkspaceName(folders);
    const workspacePath = this.generateWorkspacePath(folders);
    const workspaceId = this.generateWorkspaceId(workspacePath);
    const port = await this.assignPort(workspaceId);

    this.workspaceInfo = {
      id: workspaceId,
      name: workspaceName,
      path: workspacePath,
      folders,
      port,
      isActive: true,
      lastActivity: new Date(),
    };

    console.log(`Initialized workspace: ${workspaceName} (${workspaceId}) on port ${port}`);
    return this.workspaceInfo;
  }

  /**
   * 获取当前工作区信息
   */
  getCurrentWorkspace(): WorkspaceInfo | null {
    return this.workspaceInfo;
  }

  /**
   * 更新工作区活动时间
   */
  updateActivity(): void {
    if (this.workspaceInfo) {
      this.workspaceInfo.lastActivity = new Date();
    }
  }

  /**
   * 生成工作区名称
   */
  private generateWorkspaceName(folders: readonly vscode.WorkspaceFolder[]): string {
    if (folders.length === 0) {
      return 'Untitled Workspace';
    }

    if (folders.length === 1) {
      return path.basename(folders[0].uri.fsPath);
    }

    // 多文件夹工作区
    const folderNames = folders
      .map(folder => path.basename(folder.uri.fsPath))
      .slice(0, 3) // 最多显示3个文件夹
      .join(', ');
    
    return folders.length > 3 
      ? `${folderNames} (+${folders.length - 3} more)`
      : folderNames;
  }

  /**
   * 生成工作区路径
   */
  private generateWorkspacePath(folders: readonly vscode.WorkspaceFolder[]): string {
    if (folders.length === 0) {
      return '';
    }

    if (folders.length === 1) {
      return folders[0].uri.fsPath;
    }

    // 多文件夹工作区，使用共同的父目录
    const paths = folders.map(folder => folder.uri.fsPath);
    return this.findCommonPath(paths) || paths[0];
  }

  /**
   * 生成工作区唯一标识符
   */
  private generateWorkspaceId(workspacePath: string): string {
    if (!workspacePath) {
      // 如果没有工作区路径，使用随机ID
      return crypto.randomBytes(8).toString('hex');
    }

    // 使用工作区路径的哈希作为ID
    const hash = crypto.createHash('sha256');
    hash.update(workspacePath);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * 为工作区分配端口
   */
  private async assignPort(workspaceId: string): Promise<number> {
    // 基于工作区ID生成一个稳定的端口偏移
    const idHash = crypto.createHash('sha256');
    idHash.update(workspaceId);
    const hashBuffer = idHash.digest();
    const offset = hashBuffer.readUInt16BE(0) % 100; // 0-99的偏移
    
    const port = this.basePort + offset;
    
    // 检查端口是否可用
    const isAvailable = await this.isPortAvailable(port);
    if (isAvailable) {
      return port;
    }

    // 如果计算出的端口不可用，寻找下一个可用端口
    return this.findAvailablePort(this.basePort, this.basePort + 200);
  }

  /**
   * 检查端口是否可用
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * 寻找可用端口
   */
  private async findAvailablePort(startPort: number, endPort: number): Promise<number> {
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available port found in range ${startPort}-${endPort}`);
  }

  /**
   * 寻找路径的公共前缀
   */
  private findCommonPath(paths: string[]): string {
    if (paths.length === 0) {
      return '';
    }
    if (paths.length === 1) {
      return path.dirname(paths[0]);
    }

    const normalizedPaths = paths.map(p => path.normalize(p).split(path.sep));
    const firstPath = normalizedPaths[0];
    
    let commonParts: string[] = [];
    
    for (let i = 0; i < firstPath.length; i++) {
      const part = firstPath[i];
      const isCommon = normalizedPaths.every(pathParts => 
        pathParts.length > i && pathParts[i] === part
      );
      
      if (isCommon) {
        commonParts.push(part);
      } else {
        break;
      }
    }
    
    return commonParts.length > 0 ? commonParts.join(path.sep) : '';
  }

  /**
   * 获取工作区信息用于API响应
   */
  getWorkspaceApiInfo(): any {
    if (!this.workspaceInfo) {
      return null;
    }

    return {
      id: this.workspaceInfo.id,
      name: this.workspaceInfo.name,
      path: this.workspaceInfo.path,
      port: this.workspaceInfo.port,
      folderCount: this.workspaceInfo.folders.length,
      folders: this.workspaceInfo.folders.map(folder => ({
        name: folder.name,
        path: folder.uri.fsPath,
        index: folder.index
      })),
      isActive: this.workspaceInfo.isActive,
      lastActivity: this.workspaceInfo.lastActivity.toISOString(),
    };
  }

  /**
   * 清理工作区信息
   */
  cleanup(): void {
    if (this.workspaceInfo) {
      this.workspaceInfo.isActive = false;
    }
  }
}

/**
 * 获取工作区管理器实例
 */
export function getWorkspaceManager(): WorkspaceManager {
  return WorkspaceManager.getInstance();
}
