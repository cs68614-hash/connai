import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileContext, countTokens } from '@connai/shared';
import { UriHelper } from '../utils/uriHelper';
import { IgnoreManager } from '../utils/ignore';
import { cache } from '../utils/cache';

/**
 * 提供单个文件的内容和信息
 */

export class FileProvider {
  private ignoreManager: IgnoreManager;

  constructor() {
    // 初始化时获取工作区根目录
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    this.ignoreManager = new IgnoreManager(workspaceFolder?.uri.fsPath);
  }

  /**
   * 获取文件内容和相关信息
   */
  async getFileContent(filePath: string): Promise<FileContext> {
    try {
      const uri = vscode.Uri.file(filePath);
      
      // 检查文件是否应该被忽略
      if (this.ignoreManager.ignores(filePath)) {
        throw new Error('File is ignored');
      }

      // 尝试从缓存获取
      const cacheKey = `file:${filePath}`;
      const cached = cache.get<FileContext>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // 读取文件内容
      const content = await this.readFileContent(uri);
      const stat = await vscode.workspace.fs.stat(uri);
      
      const fileContext: FileContext = {
        uri: uri.toString(),
        name: UriHelper.getFileName(uri),
        path: filePath,
        content,
        language: this.detectLanguage(filePath, content),
        size: Buffer.byteLength(content, 'utf8'),
        lastModified: stat.mtime,
      };

      // 缓存结果
      cache.set(cacheKey, fileContext);
      
      return fileContext;
    } catch (error) {
      console.error(`Failed to get file content for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件的基本信息（不包含内容）
   */
  async getFileInfo(filePath: string): Promise<Omit<FileContext, 'content'>> {
    try {
      const uri = vscode.Uri.file(filePath);
      const stat = await vscode.workspace.fs.stat(uri);
      
      return {
        uri: uri.toString(),
        name: UriHelper.getFileName(uri),
        path: filePath,
        language: this.detectLanguage(filePath),
        size: stat.size,
        lastModified: stat.mtime,
      };
    } catch (error) {
      console.error(`Failed to get file info for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件的 token 计数
   */
  async getFileTokenCount(filePath: string, model?: string): Promise<{
    count: number;
    model: string;
    estimatedCost?: number;
  }> {
    try {
      const fileContext = await this.getFileContent(filePath);
      const tokenInfo = countTokens(fileContext.content, model);
      
      return {
        count: tokenInfo.count,
        model: tokenInfo.model,
        // 这里可以添加成本估算逻辑
      };
    } catch (error) {
      console.error(`Failed to get token count for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 批量获取多个文件的内容
   */
  async getMultipleFileContents(filePaths: string[]): Promise<FileContext[]> {
    try {
      const results = await Promise.allSettled(
        filePaths.map(filePath => this.getFileContent(filePath))
      );

      return results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<FileContext>).value);
    } catch (error) {
      console.error('Failed to get multiple file contents:', error);
      throw error;
    }
  }

  /**
   * 搜索文件中的文本
   */
  async searchInFile(
    filePath: string,
    query: string,
    options?: {
      isRegex?: boolean;
      isCaseSensitive?: boolean;
      wholeWord?: boolean;
      maxMatches?: number;
    }
  ): Promise<Array<{
    line: number;
    character: number;
    text: string;
    preview: string;
  }>> {
    try {
      const fileContent = await this.getFileContent(filePath);
      const lines = fileContent.content.split('\n');
      const matches: Array<{
        line: number;
        character: number;
        text: string;
        preview: string;
      }> = [];

      let searchRegex: RegExp;
      
      if (options?.isRegex) {
        const flags = options.isCaseSensitive ? 'g' : 'gi';
        searchRegex = new RegExp(query, flags);
      } else {
        let escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (options?.wholeWord) {
          escapedQuery = `\\b${escapedQuery}\\b`;
        }
        const flags = options?.isCaseSensitive ? 'g' : 'gi';
        searchRegex = new RegExp(escapedQuery, flags);
      }

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match;
        
        while ((match = searchRegex.exec(line)) !== null) {
          matches.push({
            line: lineIndex,
            character: match.index,
            text: match[0],
            preview: line.trim(),
          });
          
          if (matches.length >= (options?.maxMatches || 100)) {
            return matches;
          }
        }
      }

      return matches;
    } catch (error) {
      console.error(`Failed to search in file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件的编码信息
   */
  async getFileEncoding(filePath: string): Promise<string> {
    try {
      // VS Code 通常处理 UTF-8 编码
      // 这里可以添加更复杂的编码检测逻辑
      return 'utf8';
    } catch (error) {
      console.error(`Failed to detect encoding for ${filePath}:`, error);
      return 'utf8';
    }
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(uri: vscode.Uri): Promise<string> {
    try {
      // 首先尝试从已打开的文档中获取
      const document = vscode.workspace.textDocuments.find(
        doc => doc.uri.toString() === uri.toString()
      );
      
      if (document) {
        return document.getText();
      }

      // 从文件系统读取
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      console.error(`Failed to read file content for ${uri.toString()}:`, error);
      throw error;
    }
  }

  /**
   * 检测文件语言类型
   */
  private detectLanguage(filePath: string, content?: string): string {
    // 首先尝试从已打开的文档中获取语言ID
    const uri = vscode.Uri.file(filePath);
    const document = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === uri.toString()
    );
    
    if (document && document.languageId !== 'plaintext') {
      return document.languageId;
    }

    // 根据文件扩展名判断
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.pl': 'perl',
      '.sh': 'shellscript',
      '.bash': 'shellscript',
      '.fish': 'fish',
      '.ps1': 'powershell',
      '.html': 'html',
      '.htm': 'html',
      '.xml': 'xml',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini',
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.tex': 'latex',
      '.sql': 'sql',
      '.r': 'r',
      '.R': 'r',
      '.m': 'matlab',
      '.lua': 'lua',
      '.vim': 'vim',
      '.dockerfile': 'dockerfile',
      '.Dockerfile': 'dockerfile',
      '.gitignore': 'ignore',
      '.dockerignore': 'ignore',
    };

    const detectedLanguage = languageMap[ext];
    if (detectedLanguage) {
      return detectedLanguage;
    }

    // 根据文件名判断
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName === 'dockerfile') {
      return 'dockerfile';
    }
    if (fileName === 'makefile') {
      return 'makefile';
    }
    if (fileName === 'cmakelists.txt') {
      return 'cmake';
    }

    // 如果有内容，尝试根据内容判断
    if (content) {
      if (content.startsWith('#!/usr/bin/env python') || content.startsWith('#!/usr/bin/python')) {
        return 'python';
      }
      if (content.startsWith('#!/bin/bash') || content.startsWith('#!/bin/sh')) {
        return 'shellscript';
      }
      if (content.startsWith('<?xml')) {
        return 'xml';
      }
      if (content.startsWith('<!DOCTYPE html') || content.includes('<html')) {
        return 'html';
      }
    }

    return 'plaintext';
  }

  /**
   * 更新忽略管理器
   */
  updateIgnoreManager(workspaceRoot: string): void {
    this.ignoreManager = new IgnoreManager(workspaceRoot);
  }

  /**
   * 清除特定文件的缓存
   */
  clearFileCache(filePath: string): void {
    const cacheKey = `file:${filePath}`;
    cache.remove(cacheKey);
  }

  /**
   * 清除所有文件缓存
   */
  clearAllCache(): void {
    cache.removeMatching(/^file:/);
  }
}
