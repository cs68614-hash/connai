import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeNode } from '@connai/shared';
import { UriHelper } from '../utils/uriHelper';
import { IgnoreManager } from '../utils/ignore';
import { cache } from '../utils/cache';

/**
 * 提供文件夹的树状结构
 */

export class FileTreeProvider {
  private ignoreManager: IgnoreManager;

  constructor() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    this.ignoreManager = new IgnoreManager(workspaceFolder?.uri.fsPath);
  }

  /**
   * 获取完整的文件树
   */
  async getFileTree(rootPath?: string, options?: {
    maxDepth?: number;
    includeHidden?: boolean;
    includeSize?: boolean;
    sortBy?: 'name' | 'type' | 'size' | 'modified';
    sortOrder?: 'asc' | 'desc';
  }): Promise<FileTreeNode[]> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
      }

      // 如果没有指定根路径，使用工作区根目录
      const targetPath = rootPath || workspaceFolders[0].uri.fsPath;
      
      // 尝试从缓存获取
      const cacheKey = `filetree:${targetPath}:${JSON.stringify(options)}`;
      const cached = cache.get<FileTreeNode[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const tree = await this.buildFileTree(targetPath, options?.maxDepth || 10, 0, options);
      
      // 排序
      this.sortFileTree(tree, options?.sortBy || 'name', options?.sortOrder || 'asc');
      
      // 缓存结果
      cache.set(cacheKey, tree);
      
      return tree;
    } catch (error) {
      console.error('Failed to get file tree:', error);
      throw error;
    }
  }

  /**
   * 获取压缩的文件树（只包含必要信息）
   */
  async getCompactFileTree(rootPath?: string, options?: {
    maxDepth?: number;
    fileTypesOnly?: string[];
    excludeEmpty?: boolean;
  }): Promise<Array<{
    path: string;
    type: 'file' | 'directory';
    depth: number;
    hasChildren?: boolean;
  }>> {
    try {
      const tree = await this.getFileTree(rootPath, {
        maxDepth: options?.maxDepth,
        includeSize: false,
      });

      const compact: Array<{
        path: string;
        type: 'file' | 'directory';
        depth: number;
        hasChildren?: boolean;
      }> = [];

      const flatten = (nodes: FileTreeNode[], depth: number) => {
        nodes.forEach(node => {
          // 过滤文件类型
          if (options?.fileTypesOnly && node.type === 'file') {
            const ext = path.extname(node.name).toLowerCase();
            if (!options.fileTypesOnly.includes(ext)) {
              return;
            }
          }

          // 排除空目录
          if (options?.excludeEmpty && node.type === 'directory' && (!node.children || node.children.length === 0)) {
            return;
          }

          compact.push({
            path: node.path,
            type: node.type,
            depth,
            hasChildren: node.children && node.children.length > 0,
          });

          if (node.children) {
            flatten(node.children, depth + 1);
          }
        });
      };

      flatten(tree, 0);
      return compact;
    } catch (error) {
      console.error('Failed to get compact file tree:', error);
      throw error;
    }
  }

  /**
   * 搜索文件树中的节点
   */
  async searchInFileTree(
    query: string,
    rootPath?: string,
    options?: {
      searchType?: 'name' | 'path' | 'extension';
      caseSensitive?: boolean;
      includeDirectories?: boolean;
      maxResults?: number;
    }
  ): Promise<FileTreeNode[]> {
    try {
      const tree = await this.getFileTree(rootPath);
      const results: FileTreeNode[] = [];
      const maxResults = options?.maxResults || 100;

      const searchRegex = new RegExp(
        query,
        options?.caseSensitive ? 'g' : 'gi'
      );

      const searchInNodes = (nodes: FileTreeNode[]) => {
        for (const node of nodes) {
          if (results.length >= maxResults) {
            break;
          }

          let shouldInclude = false;

          // 搜索逻辑
          if (options?.searchType === 'path') {
            shouldInclude = searchRegex.test(node.path);
          } else if (options?.searchType === 'extension') {
            const ext = path.extname(node.name);
            shouldInclude = searchRegex.test(ext);
          } else {
            // 默认搜索名称
            shouldInclude = searchRegex.test(node.name);
          }

          // 过滤目录
          if (!options?.includeDirectories && node.type === 'directory') {
            shouldInclude = false;
          }

          if (shouldInclude) {
            results.push(node);
          }

          // 递归搜索子节点
          if (node.children) {
            searchInNodes(node.children);
          }
        }
      };

      searchInNodes(tree);
      return results;
    } catch (error) {
      console.error('Failed to search in file tree:', error);
      throw error;
    }
  }

  /**
   * 获取文件树统计信息
   */
  async getFileTreeStats(rootPath?: string): Promise<{
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    maxDepth: number;
    filesByExtension: Record<string, number>;
    largestFiles: Array<{ name: string; path: string; size: number }>;
  }> {
    try {
      const tree = await this.getFileTree(rootPath, { includeSize: true });

      let totalFiles = 0;
      let totalDirectories = 0;
      let totalSize = 0;
      let maxDepth = 0;
      const filesByExtension: Record<string, number> = {};
      const largestFiles: Array<{ name: string; path: string; size: number }> = [];

      const analyzeNodes = (nodes: FileTreeNode[], depth: number) => {
        if (depth > maxDepth) {
          maxDepth = depth;
        }

        nodes.forEach(node => {
          if (node.type === 'file') {
            totalFiles++;
            if (node.size) {
              totalSize += node.size;
              largestFiles.push({ name: node.name, path: node.path, size: node.size });
            }

            const ext = path.extname(node.name).toLowerCase() || 'no-extension';
            filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
          } else {
            totalDirectories++;
          }

          if (node.children) {
            analyzeNodes(node.children, depth + 1);
          }
        });
      };

      analyzeNodes(tree, 0);

      // 排序最大文件
      largestFiles.sort((a, b) => b.size - a.size);
      const topLargestFiles = largestFiles.slice(0, 10);

      return {
        totalFiles,
        totalDirectories,
        totalSize,
        maxDepth,
        filesByExtension,
        largestFiles: topLargestFiles,
      };
    } catch (error) {
      console.error('Failed to get file tree stats:', error);
      throw error;
    }
  }

  /**
   * 获取指定路径的子树
   */
  async getSubTree(targetPath: string, options?: {
    maxDepth?: number;
    includeHidden?: boolean;
  }): Promise<FileTreeNode | null> {
    try {
      const tree = await this.getFileTree(undefined, options);
      
      const findNode = (nodes: FileTreeNode[]): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.path === targetPath) {
            return node;
          }
          if (node.children) {
            const found = findNode(node.children);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      return findNode(tree);
    } catch (error) {
      console.error(`Failed to get subtree for ${targetPath}:`, error);
      return null;
    }
  }

  /**
   * 构建文件树
   */
  private async buildFileTree(
    dirPath: string,
    maxDepth: number,
    currentDepth: number,
    options?: {
      includeHidden?: boolean;
      includeSize?: boolean;
    }
  ): Promise<FileTreeNode[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    try {
      const uri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const nodes: FileTreeNode[] = [];

      for (const [name, type] of entries) {
        if (!options?.includeHidden && name.startsWith('.')) {
          continue;
        }

        const childPath = path.join(dirPath, name);
        
        if (this.ignoreManager.ignores(childPath)) {
          continue;
        }

        const childUri = vscode.Uri.file(childPath);
        let size: number | undefined;
        let lastModified: number | undefined;

        if (options?.includeSize) {
          try {
            const stat = await vscode.workspace.fs.stat(childUri);
            size = stat.size;
            lastModified = stat.mtime;
          } catch {
            // 忽略统计错误
          }
        }

        const node: FileTreeNode = {
          name,
          path: childPath,
          type: type === vscode.FileType.File ? 'file' : 'directory',
          size,
          lastModified,
        };

        // 递归处理子目录
        if (type === vscode.FileType.Directory) {
          node.children = await this.buildFileTree(childPath, maxDepth, currentDepth + 1, options);
        }

        nodes.push(node);
      }

      return nodes;
    } catch (error) {
      console.error(`Failed to build file tree for ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * 排序文件树
   */
  private sortFileTree(
    nodes: FileTreeNode[],
    sortBy: 'name' | 'type' | 'size' | 'modified',
    sortOrder: 'asc' | 'desc'
  ): void {
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    nodes.sort((a, b) => {
      // 目录始终在文件前面
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          const extA = path.extname(a.name);
          const extB = path.extname(b.name);
          comparison = extA.localeCompare(extB);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'modified':
          comparison = (a.lastModified || 0) - (b.lastModified || 0);
          break;
      }

      return comparison * multiplier;
    });

    // 递归排序子节点
    nodes.forEach(node => {
      if (node.children) {
        this.sortFileTree(node.children, sortBy, sortOrder);
      }
    });
  }

  /**
   * 将文件树转换为平面列表
   */
  flattenFileTree(tree: FileTreeNode[]): Array<{
    node: FileTreeNode;
    depth: number;
    parentPath?: string;
  }> {
    const result: Array<{
      node: FileTreeNode;
      depth: number;
      parentPath?: string;
    }> = [];

    const flatten = (nodes: FileTreeNode[], depth: number, parentPath?: string) => {
      nodes.forEach(node => {
        result.push({ node, depth, parentPath });
        if (node.children) {
          flatten(node.children, depth + 1, node.path);
        }
      });
    };

    flatten(tree, 0);
    return result;
  }

  /**
   * 过滤文件树
   */
  filterFileTree(
    tree: FileTreeNode[],
    predicate: (node: FileTreeNode) => boolean
  ): FileTreeNode[] {
    const filtered: FileTreeNode[] = [];

    tree.forEach(node => {
      if (predicate(node)) {
        const filteredNode: FileTreeNode = { ...node };
        
        if (node.children) {
          filteredNode.children = this.filterFileTree(node.children, predicate);
        }
        
        filtered.push(filteredNode);
      } else if (node.children) {
        // 即使当前节点不匹配，也要检查子节点
        const filteredChildren = this.filterFileTree(node.children, predicate);
        if (filteredChildren.length > 0) {
          filtered.push({ ...node, children: filteredChildren });
        }
      }
    });

    return filtered;
  }

  /**
   * 更新忽略管理器
   */
  updateIgnoreManager(workspaceRoot: string): void {
    this.ignoreManager = new IgnoreManager(workspaceRoot);
  }

  /**
   * 清除文件树缓存
   */
  clearCache(): void {
    cache.removeMatching(/^filetree:/);
  }
}
