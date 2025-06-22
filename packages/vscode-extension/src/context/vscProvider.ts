import * as vscode from 'vscode';
import { WorkspaceSnapshot, CursorContext, DiagnosticInfo, RecentChange } from '@connai/shared';
import { FileProvider } from './fileProvider';
import { FolderProvider } from './folderProvider';
import { CursorProvider } from './cursorProvider';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { RecentChangesProvider } from './recentChangesProvider';

/**
 * 提供完整的 VS Code 上下文快照
 */

export class VSCProvider {
  private static fileProvider = new FileProvider();
  private static folderProvider = new FolderProvider();
  private static cursorProvider = new CursorProvider();
  private static diagnosticsProvider = new DiagnosticsProvider();
  private static recentChangesProvider = new RecentChangesProvider();

  /**
   * 获取完整的工作区快照
   */
  static async getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    try {
      const [
        cursor,
        diagnostics,
        recentChanges
      ] = await Promise.all([
        this.cursorProvider.getCursorContext(),
        this.diagnosticsProvider.getAllDiagnostics(),
        this.recentChangesProvider.getRecentChanges()
      ]);

      const workspaceFolders = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];
      const openFiles = vscode.workspace.textDocuments.map(doc => doc.uri.fsPath);
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;

      return {
        workspaceFolders,
        openFiles,
        activeFile,
        cursor,
        diagnostics,
        recentChanges,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to get workspace snapshot:', error);
      throw error;
    }
  }

  /**
   * 获取工作区概览信息
   */
  static async getWorkspaceOverview(): Promise<{
    name?: string;
    rootPath?: string;
    totalFiles: number;
    totalSize: number;
    languages: string[];
    openEditors: number;
    problems: number;
  }> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const diagnostics = await this.diagnosticsProvider.getAllDiagnostics();
      const totalProblems = diagnostics.reduce((sum, diag) => sum + diag.diagnostics.length, 0);

      // 获取语言统计
      const languages = new Set<string>();
      vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId && doc.languageId !== 'plaintext') {
          languages.add(doc.languageId);
        }
      });

      return {
        name: workspaceFolder?.name,
        rootPath: workspaceFolder?.uri.fsPath,
        totalFiles: vscode.workspace.textDocuments.length,
        totalSize: 0, // TODO: 计算实际大小
        languages: Array.from(languages),
        openEditors: vscode.window.visibleTextEditors.length,
        problems: totalProblems,
      };
    } catch (error) {
      console.error('Failed to get workspace overview:', error);
      throw error;
    }
  }

  /**
   * 获取当前编辑器状态
   */
  static async getEditorState(): Promise<{
    activeEditor?: {
      uri: string;
      fileName: string;
      language: string;
      isDirty: boolean;
      lineCount: number;
      selection: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      visibleRange: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    };
    visibleEditors: Array<{
      uri: string;
      fileName: string;
      language: string;
      viewColumn?: number;
    }>;
    tabGroups: Array<{
      isActive: boolean;
      tabs: Array<{
        label: string;
        uri?: string;
        isActive: boolean;
        isDirty: boolean;
        isPinned: boolean;
      }>;
    }>;
  }> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      let activeEditorInfo;
      if (activeEditor) {
        activeEditorInfo = {
          uri: activeEditor.document.uri.toString(),
          fileName: activeEditor.document.fileName,
          language: activeEditor.document.languageId,
          isDirty: activeEditor.document.isDirty,
          lineCount: activeEditor.document.lineCount,
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
          visibleRange: {
            start: {
              line: activeEditor.visibleRanges[0]?.start.line || 0,
              character: activeEditor.visibleRanges[0]?.start.character || 0,
            },
            end: {
              line: activeEditor.visibleRanges[0]?.end.line || 0,
              character: activeEditor.visibleRanges[0]?.end.character || 0,
            },
          },
        };
      }

      const visibleEditors = vscode.window.visibleTextEditors.map(editor => ({
        uri: editor.document.uri.toString(),
        fileName: editor.document.fileName,
        language: editor.document.languageId,
        viewColumn: editor.viewColumn,
      }));

      const tabGroups = vscode.window.tabGroups.all.map(group => ({
        isActive: group.isActive,
        tabs: group.tabs.map(tab => ({
          label: tab.label,
          uri: tab.input && typeof tab.input === 'object' && 'uri' in tab.input ? (tab.input.uri as vscode.Uri).toString() : undefined,
          isActive: tab.isActive,
          isDirty: tab.isDirty,
          isPinned: tab.isPinned,
        })),
      }));

      return {
        activeEditor: activeEditorInfo,
        visibleEditors,
        tabGroups,
      };
    } catch (error) {
      console.error('Failed to get editor state:', error);
      throw error;
    }
  }

  /**
   * 获取工作区文件统计
   */
  static async getFileStats(): Promise<{
    byLanguage: Record<string, number>;
    bySize: {
      small: number; // < 1KB
      medium: number; // 1KB - 100KB
      large: number; // > 100KB
    };
    byModified: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      older: number;
    };
  }> {
    try {
      const byLanguage: Record<string, number> = {};
      const bySize = { small: 0, medium: 0, large: 0 };
      const byModified = { today: 0, thisWeek: 0, thisMonth: 0, older: 0 };

      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;
      const oneMonth = 30 * oneDay;

      for (const document of vscode.workspace.textDocuments) {
        // 按语言统计
        const language = document.languageId || 'unknown';
        byLanguage[language] = (byLanguage[language] || 0) + 1;

        // 按大小统计
        const size = Buffer.byteLength(document.getText(), 'utf8');
        if (size < 1024) {
          bySize.small++;
        } else if (size < 100 * 1024) {
          bySize.medium++;
        } else {
          bySize.large++;
        }

        // 按修改时间统计（这里用文档创建时间作为近似）
        // 实际项目中可能需要读取文件系统的修改时间
        const fileAge = now; // 临时使用当前时间
        if (fileAge < oneDay) {
          byModified.today++;
        } else if (fileAge < oneWeek) {
          byModified.thisWeek++;
        } else if (fileAge < oneMonth) {
          byModified.thisMonth++;
        } else {
          byModified.older++;
        }
      }

      return { byLanguage, bySize, byModified };
    } catch (error) {
      console.error('Failed to get file stats:', error);
      throw error;
    }
  }

  /**
   * 搜索工作区中的文本
   */
  static async searchInWorkspace(query: string, options?: {
    includePattern?: string;
    excludePattern?: string;
    isRegex?: boolean;
    isCaseSensitive?: boolean;
    maxResults?: number;
  }): Promise<Array<{
    uri: string;
    fileName: string;
    matches: Array<{
      line: number;
      character: number;
      text: string;
      preview: string;
    }>;
  }>> {
    try {
      // TODO: 实现更高效的搜索逻辑
      // 这里提供一个基本实现
      
      const results: Array<{
        uri: string;
        fileName: string;
        matches: Array<{
          line: number;
          character: number;
          text: string;
          preview: string;
        }>;
      }> = [];

      const searchRegex = options?.isRegex 
        ? new RegExp(query, options.isCaseSensitive ? 'g' : 'gi')
        : new RegExp(escapeRegExp(query), options?.isCaseSensitive ? 'g' : 'gi');

      for (const document of vscode.workspace.textDocuments) {
        if (results.length >= (options?.maxResults || 100)) {
          break;
        }

        const text = document.getText();
        const lines = text.split('\n');
        const matches: Array<{
          line: number;
          character: number;
          text: string;
          preview: string;
        }> = [];

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
            
            if (matches.length >= 10) {
              break; // 每个文件最多10个匹配
            }
          }
          
          if (matches.length >= 10) {
            break;
          }
        }

        if (matches.length > 0) {
          results.push({
            uri: document.uri.toString(),
            fileName: document.fileName,
            matches,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to search in workspace:', error);
      throw error;
    }
  }
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
