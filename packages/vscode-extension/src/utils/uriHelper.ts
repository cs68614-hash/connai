import * as vscode from 'vscode';

/**
 * 处理和解析 VS Code 的 Uri
 */

export class UriHelper {
  /**
   * 将 VS Code Uri 转换为文件系统路径
   */
  static uriToPath(uri: vscode.Uri): string {
    return uri.fsPath;
  }

  /**
   * 将文件系统路径转换为 VS Code Uri
   */
  static pathToUri(path: string): vscode.Uri {
    return vscode.Uri.file(path);
  }

  /**
   * 获取相对路径
   */
  static getRelativePath(uri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder): string {
    if (!workspaceFolder) {
      const folder = vscode.workspace.getWorkspaceFolder(uri);
      if (!folder) {
        return uri.fsPath;
      }
      workspaceFolder = folder;
    }
    
    return vscode.workspace.asRelativePath(uri, false);
  }

  /**
   * 检查 Uri 是否为文件
   */
  static isFile(uri: vscode.Uri): boolean {
    return uri.scheme === 'file';
  }

  /**
   * 检查 Uri 是否为目录
   */
  static async isDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件扩展名
   */
  static getExtension(uri: vscode.Uri): string {
    const path = uri.fsPath;
    const lastDotIndex = path.lastIndexOf('.');
    return lastDotIndex > 0 ? path.substring(lastDotIndex) : '';
  }

  /**
   * 获取文件名（不含扩展名）
   */
  static getBaseName(uri: vscode.Uri): string {
    const path = uri.fsPath;
    const lastSlashIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const fileName = path.substring(lastSlashIndex + 1);
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  /**
   * 获取文件名（含扩展名）
   */
  static getFileName(uri: vscode.Uri): string {
    const path = uri.fsPath;
    const lastSlashIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return path.substring(lastSlashIndex + 1);
  }

  /**
   * 获取目录路径
   */
  static getDirectoryUri(uri: vscode.Uri): vscode.Uri {
    const path = uri.fsPath;
    const lastSlashIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return vscode.Uri.file(path.substring(0, lastSlashIndex));
  }

  /**
   * 规范化路径
   */
  static normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }

  /**
   * 检查路径是否在工作区内
   */
  static isInWorkspace(uri: vscode.Uri): boolean {
    return vscode.workspace.getWorkspaceFolder(uri) !== undefined;
  }

  /**
   * 获取工作区根目录相对路径
   */
  static getWorkspaceRelativePath(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return undefined;
    }
    
    const relativePath = vscode.workspace.asRelativePath(uri);
    return this.normalizePath(relativePath);
  }

  /**
   * 创建安全的 Uri（处理特殊字符）
   */
  static createSafeUri(path: string): vscode.Uri {
    try {
      return vscode.Uri.file(path);
    } catch (error) {
      // 如果路径包含特殊字符，尝试编码
      const encodedPath = encodeURI(path);
      return vscode.Uri.parse(encodedPath);
    }
  }

  /**
   * 比较两个 Uri 是否相等
   */
  static isEqual(uri1: vscode.Uri, uri2: vscode.Uri): boolean {
    return uri1.toString() === uri2.toString();
  }

  /**
   * 检查 Uri 是否匹配 glob 模式
   */
  static matchesGlob(uri: vscode.Uri, pattern: string): boolean {
    const relativePath = this.getWorkspaceRelativePath(uri);
    if (!relativePath) {
      return false;
    }
    
    // 简单的 glob 匹配实现
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regex}$`).test(relativePath);
  }

  /**
   * 获取 Uri 的显示名称
   */
  static getDisplayName(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      const relativePath = this.getWorkspaceRelativePath(uri);
      return relativePath || this.getFileName(uri);
    }
    return uri.fsPath;
  }

  /**
   * 将 Uri 数组按路径排序
   */
  static sortUris(uris: vscode.Uri[]): vscode.Uri[] {
    return uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
  }

  /**
   * 过滤出文件 Uri
   */
  static async filterFiles(uris: vscode.Uri[]): Promise<vscode.Uri[]> {
    const results = await Promise.all(
      uris.map(async uri => ({
        uri,
        isFile: !(await this.isDirectory(uri))
      }))
    );
    
    return results
      .filter(result => result.isFile)
      .map(result => result.uri);
  }

  /**
   * 过滤出目录 Uri
   */
  static async filterDirectories(uris: vscode.Uri[]): Promise<vscode.Uri[]> {
    const results = await Promise.all(
      uris.map(async uri => ({
        uri,
        isDirectory: await this.isDirectory(uri)
      }))
    );
    
    return results
      .filter(result => result.isDirectory)
      .map(result => result.uri);
  }
}
