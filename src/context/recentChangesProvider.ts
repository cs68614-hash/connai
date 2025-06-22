import * as vscode from 'vscode';
import { RecentChange } from '../types';
import { UriHelper } from '../utils/uriHelper';

/**
 * 提供最近的代码变更历史
 */

export class RecentChangesProvider {
  private changes: RecentChange[] = [];
  private maxChanges: number = 100;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听文档变更事件
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
      this.handleDocumentChange(event);
    });

    this.disposables.push(changeDisposable);
  }

  /**
   * 处理文档变更事件
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    try {
      if (event.contentChanges.length === 0) {
        return;
      }

      const uri = event.document.uri;
      const fileName = UriHelper.getFileName(uri);

      const recentChange: RecentChange = {
        uri: uri.toString(),
        fileName,
        timestamp: Date.now(),
        changes: event.contentChanges.map(change => ({
          range: {
            start: {
              line: change.range.start.line,
              character: change.range.start.character,
            },
            end: {
              line: change.range.end.line,
              character: change.range.end.character,
            },
          },
          rangeOffset: change.rangeOffset,
          rangeLength: change.rangeLength,
          text: change.text,
        })),
      };

      // 添加到变更历史
      this.changes.unshift(recentChange);

      // 保持最大数量限制
      if (this.changes.length > this.maxChanges) {
        this.changes = this.changes.slice(0, this.maxChanges);
      }
    } catch (error) {
      console.error('Failed to handle document change:', error);
    }
  }

  /**
   * 获取最近的变更
   */
  async getRecentChanges(limit?: number): Promise<RecentChange[]> {
    try {
      const actualLimit = limit || this.maxChanges;
      return this.changes.slice(0, actualLimit);
    } catch (error) {
      console.error('Failed to get recent changes:', error);
      throw error;
    }
  }

  /**
   * 获取特定文件的最近变更
   */
  async getFileRecentChanges(filePath: string, limit?: number): Promise<RecentChange[]> {
    try {
      const uri = vscode.Uri.file(filePath);
      const fileChanges = this.changes.filter(change => change.uri === uri.toString());
      
      const actualLimit = limit || 10;
      return fileChanges.slice(0, actualLimit);
    } catch (error) {
      console.error(`Failed to get recent changes for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 获取指定时间范围内的变更
   */
  async getChangesInTimeRange(startTime: number, endTime: number): Promise<RecentChange[]> {
    try {
      return this.changes.filter(change => 
        change.timestamp >= startTime && change.timestamp <= endTime
      );
    } catch (error) {
      console.error('Failed to get changes in time range:', error);
      throw error;
    }
  }

  /**
   * 获取最近N分钟的变更
   */
  async getChangesInLastMinutes(minutes: number): Promise<RecentChange[]> {
    try {
      const now = Date.now();
      const startTime = now - (minutes * 60 * 1000);
      return this.getChangesInTimeRange(startTime, now);
    } catch (error) {
      console.error(`Failed to get changes in last ${minutes} minutes:`, error);
      throw error;
    }
  }

  /**
   * 获取变更统计信息
   */
  async getChangeStats(): Promise<{
    totalChanges: number;
    uniqueFiles: number;
    changesInLastHour: number;
    changesInLastDay: number;
    mostActiveFiles: Array<{ fileName: string; changeCount: number }>;
  }> {
    try {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;

      const changesInLastHour = this.changes.filter(
        change => change.timestamp > now - oneHour
      ).length;

      const changesInLastDay = this.changes.filter(
        change => change.timestamp > now - oneDay
      ).length;

      // 统计每个文件的变更次数
      const fileChangeCounts: Record<string, number> = {};
      this.changes.forEach(change => {
        fileChangeCounts[change.fileName] = (fileChangeCounts[change.fileName] || 0) + 1;
      });

      const mostActiveFiles = Object.entries(fileChangeCounts)
        .map(([fileName, changeCount]) => ({ fileName, changeCount }))
        .sort((a, b) => b.changeCount - a.changeCount)
        .slice(0, 10);

      return {
        totalChanges: this.changes.length,
        uniqueFiles: Object.keys(fileChangeCounts).length,
        changesInLastHour,
        changesInLastDay,
        mostActiveFiles,
      };
    } catch (error) {
      console.error('Failed to get change stats:', error);
      throw error;
    }
  }

  /**
   * 清除所有变更历史
   */
  clearHistory(): void {
    this.changes = [];
  }

  /**
   * 清除指定文件的变更历史
   */
  clearFileHistory(filePath: string): void {
    const uri = vscode.Uri.file(filePath);
    this.changes = this.changes.filter(change => change.uri !== uri.toString());
  }

  /**
   * 清除指定时间之前的变更历史
   */
  clearHistoryBefore(timestamp: number): void {
    this.changes = this.changes.filter(change => change.timestamp >= timestamp);
  }

  /**
   * 获取变更的文本差异
   */
  async getChangeDiff(change: RecentChange): Promise<{
    additions: number;
    deletions: number;
    modifications: number;
  }> {
    try {
      let additions = 0;
      let deletions = 0;
      let modifications = 0;

      change.changes.forEach(changeItem => {
        if (changeItem.rangeLength === 0 && changeItem.text.length > 0) {
          // 纯添加
          additions += changeItem.text.split('\n').length - 1 || 1;
        } else if (changeItem.rangeLength > 0 && changeItem.text.length === 0) {
          // 纯删除
          deletions += 1;
        } else if (changeItem.rangeLength > 0 && changeItem.text.length > 0) {
          // 修改
          modifications += 1;
        }
      });

      return { additions, deletions, modifications };
    } catch (error) {
      console.error('Failed to get change diff:', error);
      throw error;
    }
  }

  /**
   * 导出变更历史
   */
  exportHistory(): string {
    try {
      return JSON.stringify(this.changes, null, 2);
    } catch (error) {
      console.error('Failed to export history:', error);
      throw error;
    }
  }

  /**
   * 导入变更历史
   */
  importHistory(data: string): boolean {
    try {
      const imported = JSON.parse(data);
      if (Array.isArray(imported)) {
        this.changes = imported;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  }

  /**
   * 设置最大变更数量
   */
  setMaxChanges(maxChanges: number): void {
    this.maxChanges = maxChanges;
    if (this.changes.length > maxChanges) {
      this.changes = this.changes.slice(0, maxChanges);
    }
  }

  /**
   * 获取最大变更数量
   */
  getMaxChanges(): number {
    return this.maxChanges;
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    this.changes = [];
  }
}
