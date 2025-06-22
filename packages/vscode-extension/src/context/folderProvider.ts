import * as vscode from 'vscode';
import * as path from 'path';
import { FolderContext, VSCEntry } from '@connai/shared';
import { UriHelper } from '../utils/uriHelper';
import { IgnoreManager } from '../utils/ignore';
import { cache } from '../utils/cache';

/**
 * 提供文件夹的内容
 */

export class FolderProvider {
  private ignoreManager: IgnoreManager;

  constructor() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    this.ignoreManager = new IgnoreManager(workspaceFolder?.uri.fsPath);
  }

  /**
   * 获取文件夹内容
   */
  async getFolderContent(folderPath: string, options?: {
    includeHidden?: boolean;
    maxDepth?: number;
    includeSize?: boolean;
  }): Promise<FolderContext> {
    try {
      const uri = vscode.Uri.file(folderPath);
      
      // 尝试从缓存获取
      const cacheKey = `folder:${folderPath}`;
      const cached = cache.get<FolderContext>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // 读取文件夹内容
      const entries = await this.readFolderEntries(uri, options);
      
      // 计算总大小
      let totalSize = 0;
      if (options?.includeSize) {
        totalSize = await this.calculateFolderSize(entries);
      }

      const folderContext: FolderContext = {
        uri: uri.toString(),
        name: UriHelper.getFileName(uri),
        path: folderPath,
        entries,
        totalFiles: entries.filter(entry => entry.type === 'file').length,
        totalSize,
      };

      // 缓存结果
      cache.set(cacheKey, folderContext);
      
      return folderContext;
    } catch (error) {
      console.error(`Failed to get folder content for ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件夹的基本信息（不包含详细内容）
   */
  async getFolderInfo(folderPath: string): Promise<{
    uri: string;
    name: string;
    path: string;
    exists: boolean;
    isDirectory: boolean;
    totalFiles?: number;
    totalDirectories?: number;
  }> {
    try {
      const uri = vscode.Uri.file(folderPath);
      
      let exists = false;
      let isDirectory = false;
      let totalFiles: number | undefined;
      let totalDirectories: number | undefined;

      try {
        const stat = await vscode.workspace.fs.stat(uri);
        exists = true;
        isDirectory = stat.type === vscode.FileType.Directory;

        if (isDirectory) {
          const entries = await vscode.workspace.fs.readDirectory(uri);
          totalFiles = 0;
          totalDirectories = 0;

          for (const [, type] of entries) {
            if (type === vscode.FileType.File) {
              totalFiles++;
            } else if (type === vscode.FileType.Directory) {
              totalDirectories++;
            }
          }
        }
      } catch {
        // 文件夹不存在或无法访问
      }

      return {
        uri: uri.toString(),
        name: UriHelper.getFileName(uri),
        path: folderPath,
        exists,
        isDirectory,
        totalFiles,
        totalDirectories,
      };
    } catch (error) {
      console.error(`Failed to get folder info for ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * 递归获取文件夹内容
   */
  async getFolderContentRecursive(
    folderPath: string,
    options?: {
      maxDepth?: number;
      includeHidden?: boolean;
      filterPattern?: string;
    }
  ): Promise<{
    files: VSCEntry[];
    directories: VSCEntry[];
    totalSize: number;
  }> {
    try {
      const files: VSCEntry[] = [];
      const directories: VSCEntry[] = [];
      let totalSize = 0;

      await this.walkDirectory(
        folderPath,
        (entry) => {
          if (entry.type === 'file') {
            files.push(entry);
            totalSize += entry.size || 0;
          } else {
            directories.push(entry);
          }
        },
        options?.maxDepth || 10,
        0,
        options
      );

      return { files, directories, totalSize };
    } catch (error) {
      console.error(`Failed to get recursive folder content for ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文件夹中的文件
   */
  async searchFiles(
    folderPath: string,
    query: string,
    options?: {
      includePattern?: string;
      excludePattern?: string;
      maxResults?: number;
      caseSensitive?: boolean;
    }
  ): Promise<VSCEntry[]> {
    try {
      const results: VSCEntry[] = [];
      const maxResults = options?.maxResults || 100;

      const searchRegex = new RegExp(
        query,
        options?.caseSensitive ? 'g' : 'gi'
      );

      await this.walkDirectory(
        folderPath,
        (entry) => {
          if (entry.type === 'file' && searchRegex.test(entry.name)) {
            // 应用包含和排除模式
            if (options?.includePattern) {
              const includeRegex = new RegExp(options.includePattern, 'i');
              if (!includeRegex.test(entry.path)) {
                return;
              }
            }

            if (options?.excludePattern) {
              const excludeRegex = new RegExp(options.excludePattern, 'i');
              if (excludeRegex.test(entry.path)) {
                return;
              }
            }

            results.push(entry);
          }
        },
        10, // 最大深度
        0,
        { maxResults }
      );

      return results.slice(0, maxResults);
    } catch (error) {
      console.error(`Failed to search files in ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件夹统计信息
   */
  async getFolderStats(folderPath: string): Promise<{
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    largestFile: { name: string; size: number } | null;
    filesByExtension: Record<string, number>;
    recentFiles: VSCEntry[];
  }> {
    try {
      const { files, directories, totalSize } = await this.getFolderContentRecursive(folderPath);

      // 查找最大文件
      let largestFile: { name: string; size: number } | null = null;
      let maxSize = 0;

      files.forEach(file => {
        if (file.size && file.size > maxSize) {
          maxSize = file.size;
          largestFile = { name: file.name, size: file.size };
        }
      });

      // 按扩展名统计
      const filesByExtension: Record<string, number> = {};
      files.forEach(file => {
        const ext = path.extname(file.name).toLowerCase() || 'no-extension';
        filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
      });

      // 最近修改的文件
      const recentFiles = files
        .filter(file => file.lastModified)
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
        .slice(0, 10);

      return {
        totalFiles: files.length,
        totalDirectories: directories.length,
        totalSize,
        largestFile,
        filesByExtension,
        recentFiles,
      };
    } catch (error) {
      console.error(`Failed to get folder stats for ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * 比较两个文件夹
   */
  async compareFolders(folderPath1: string, folderPath2: string): Promise<{
    onlyInFirst: VSCEntry[];
    onlyInSecond: VSCEntry[];
    common: VSCEntry[];
    different: VSCEntry[];
  }> {
    try {
      const [content1, content2] = await Promise.all([
        this.getFolderContentRecursive(folderPath1),
        this.getFolderContentRecursive(folderPath2)
      ]);

      const files1Map = new Map(content1.files.map(f => [f.name, f]));
      const files2Map = new Map(content2.files.map(f => [f.name, f]));

      const onlyInFirst: VSCEntry[] = [];
      const onlyInSecond: VSCEntry[] = [];
      const common: VSCEntry[] = [];
      const different: VSCEntry[] = [];

      // 检查第一个文件夹中的文件
      files1Map.forEach((file, name) => {
        if (files2Map.has(name)) {
          const file2 = files2Map.get(name)!;
          if (file.size !== file2.size || file.lastModified !== file2.lastModified) {
            different.push(file);
          } else {
            common.push(file);
          }
        } else {
          onlyInFirst.push(file);
        }
      });

      // 检查第二个文件夹中的文件
      files2Map.forEach((file, name) => {
        if (!files1Map.has(name)) {
          onlyInSecond.push(file);
        }
      });

      return { onlyInFirst, onlyInSecond, common, different };
    } catch (error) {
      console.error(`Failed to compare folders ${folderPath1} and ${folderPath2}:`, error);
      throw error;
    }
  }

  /**
   * 读取文件夹条目
   */
  private async readFolderEntries(
    uri: vscode.Uri,
    options?: {
      includeHidden?: boolean;
      maxDepth?: number;
      includeSize?: boolean;
    }
  ): Promise<VSCEntry[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const result: VSCEntry[] = [];

      for (const [name, type] of entries) {
        // 跳过隐藏文件（除非明确要求包含）
        if (!options?.includeHidden && name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(uri.fsPath, name);
        const entryUri = vscode.Uri.file(entryPath);

        // 检查是否应该忽略此文件/文件夹
        if (this.ignoreManager.ignores(entryPath)) {
          continue;
        }

        let size: number | undefined;
        let lastModified: number | undefined;

        if (options?.includeSize) {
          try {
            const stat = await vscode.workspace.fs.stat(entryUri);
            size = stat.size;
            lastModified = stat.mtime;
          } catch {
            // 忽略统计错误
          }
        }

        const entry: VSCEntry = {
          uri: entryUri.toString(),
          type: type === vscode.FileType.File ? 'file' : 'directory',
          name,
          path: entryPath,
          size,
          lastModified,
        };

        result.push(entry);
      }

      return result;
    } catch (error) {
      console.error(`Failed to read folder entries for ${uri.fsPath}:`, error);
      throw error;
    }
  }

  /**
   * 递归遍历目录
   */
  private async walkDirectory(
    dirPath: string,
    callback: (entry: VSCEntry) => void,
    maxDepth: number,
    currentDepth: number,
    options?: {
      maxResults?: number;
      includeHidden?: boolean;
    }
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    try {
      const uri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);

      for (const [name, type] of entries) {
        if (!options?.includeHidden && name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, name);
        
        if (this.ignoreManager.ignores(entryPath)) {
          continue;
        }

        const entryUri = vscode.Uri.file(entryPath);
        let size: number | undefined;
        let lastModified: number | undefined;

        try {
          const stat = await vscode.workspace.fs.stat(entryUri);
          size = stat.size;
          lastModified = stat.mtime;
        } catch {
          // 忽略统计错误
        }

        const entry: VSCEntry = {
          uri: entryUri.toString(),
          type: type === vscode.FileType.File ? 'file' : 'directory',
          name,
          path: entryPath,
          size,
          lastModified,
        };

        callback(entry);

        // 递归处理子目录
        if (type === vscode.FileType.Directory) {
          await this.walkDirectory(entryPath, callback, maxDepth, currentDepth + 1, options);
        }
      }
    } catch (error) {
      console.error(`Failed to walk directory ${dirPath}:`, error);
    }
  }

  /**
   * 计算文件夹大小
   */
  private async calculateFolderSize(entries: VSCEntry[]): Promise<number> {
    let totalSize = 0;
    
    for (const entry of entries) {
      if (entry.type === 'file' && entry.size) {
        totalSize += entry.size;
      }
    }

    return totalSize;
  }

  /**
   * 更新忽略管理器
   */
  updateIgnoreManager(workspaceRoot: string): void {
    this.ignoreManager = new IgnoreManager(workspaceRoot);
  }

  /**
   * 清除文件夹缓存
   */
  clearFolderCache(folderPath: string): void {
    const cacheKey = `folder:${folderPath}`;
    cache.remove(cacheKey);
  }

  /**
   * 清除所有文件夹缓存
   */
  clearAllCache(): void {
    cache.removeMatching(/^folder:/);
  }
}
