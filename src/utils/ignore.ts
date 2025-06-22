import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_IGNORE_PATTERNS } from './constants';

/**
 * 解析和应用 .gitignore 和自定义忽略规则
 */

export class IgnoreManager {
  private patterns: string[] = [];
  private compiledPatterns: RegExp[] = [];
  private gitignoreContent: string = '';
  private customPatterns: string[] = [];

  constructor(workspaceRoot?: string) {
    this.loadDefaultPatterns();
    if (workspaceRoot) {
      this.loadGitignore(workspaceRoot);
    }
  }

  /**
   * 加载默认忽略模式
   */
  private loadDefaultPatterns(): void {
    this.patterns = [...DEFAULT_IGNORE_PATTERNS];
    this.compilePatterns();
  }

  /**
   * 加载 .gitignore 文件
   */
  private loadGitignore(workspaceRoot: string): void {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    
    try {
      if (fs.existsSync(gitignorePath)) {
        this.gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        const gitignorePatterns = this.parseGitignore(this.gitignoreContent);
        this.patterns = [...this.patterns, ...gitignorePatterns];
        this.compilePatterns();
      }
    } catch (error) {
      console.warn('Failed to load .gitignore:', error);
    }
  }

  /**
   * 解析 .gitignore 内容
   */
  private parseGitignore(content: string): string[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        // 处理 gitignore 特殊规则
        if (line.startsWith('/')) {
          return line.substring(1);
        }
        if (!line.includes('/')) {
          return `**/${line}`;
        }
        return line;
      });
  }

  /**
   * 编译 glob 模式为正则表达式
   */
  private compilePatterns(): void {
    this.compiledPatterns = this.patterns.map(pattern => {
      // 将 glob 模式转换为正则表达式
      let regex = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*\//g, '(.*/)??')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      
      // 处理目录匹配
      if (pattern.endsWith('/')) {
        regex = `^${regex}.*`;
      } else {
        regex = `^${regex}$`;
      }
      
      return new RegExp(regex, 'i');
    });
  }

  /**
   * 添加自定义忽略模式
   */
  addCustomPatterns(patterns: string[]): void {
    this.customPatterns = [...this.customPatterns, ...patterns];
    this.patterns = [...this.patterns, ...patterns];
    this.compilePatterns();
  }

  /**
   * 移除自定义忽略模式
   */
  removeCustomPatterns(patterns: string[]): void {
    this.customPatterns = this.customPatterns.filter(p => !patterns.includes(p));
    this.patterns = this.patterns.filter(p => !patterns.includes(p));
    this.compilePatterns();
  }

  /**
   * 检查路径是否应该被忽略
   */
  ignores(filePath: string): boolean {
    // 规范化路径
    const normalizedPath = this.normalizePath(filePath);
    
    // 检查是否匹配任何忽略模式
    return this.compiledPatterns.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * 批量检查多个路径
   */
  filterIgnored(filePaths: string[]): string[] {
    return filePaths.filter(path => !this.ignores(path));
  }

  /**
   * 规范化路径（统一使用正斜杠）
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * 获取当前的忽略模式
   */
  getPatterns(): string[] {
    return [...this.patterns];
  }

  /**
   * 获取自定义模式
   */
  getCustomPatterns(): string[] {
    return [...this.customPatterns];
  }

  /**
   * 获取 .gitignore 内容
   */
  getGitignoreContent(): string {
    return this.gitignoreContent;
  }

  /**
   * 重新加载 .gitignore 文件
   */
  reloadGitignore(workspaceRoot: string): void {
    // 清除之前的 gitignore 模式
    this.patterns = [...DEFAULT_IGNORE_PATTERNS, ...this.customPatterns];
    this.loadGitignore(workspaceRoot);
  }

  /**
   * 检查文件是否为二进制文件
   */
  isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.ogg',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.ttf', '.otf', '.woff', '.woff2', '.eot',
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
  }

  /**
   * 检查文件是否过大
   */
  isFileTooLarge(filePath: string, maxSize: number = 10 * 1024 * 1024): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.size > maxSize;
    } catch {
      return false;
    }
  }

  /**
   * 综合检查文件是否应该被包含
   */
  shouldIncludeFile(filePath: string, maxSize?: number): boolean {
    if (this.ignores(filePath)) {
      return false;
    }
    
    if (this.isBinaryFile(filePath)) {
      return false;
    }
    
    if (maxSize && this.isFileTooLarge(filePath, maxSize)) {
      return false;
    }
    
    return true;
  }

  /**
   * 创建新的 IgnoreManager 实例
   */
  static create(workspaceRoot?: string): IgnoreManager {
    return new IgnoreManager(workspaceRoot);
  }
}
