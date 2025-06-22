import * as vscode from 'vscode';
import { DiagnosticInfo } from '@connai/shared';
import { UriHelper } from '../utils/uriHelper';

/**
 * 提供代码中的错误和警告
 */

export class DiagnosticsProvider {
  /**
   * 获取所有诊断信息
   */
  async getAllDiagnostics(): Promise<DiagnosticInfo[]> {
    try {
      const diagnostics: DiagnosticInfo[] = [];
      
      // 获取所有诊断信息
      vscode.languages.getDiagnostics().forEach(([uri, uriDiagnostics]) => {
        if (uriDiagnostics.length > 0) {
          const fileName = UriHelper.getFileName(uri);
          
          const diagnosticInfo: DiagnosticInfo = {
            uri: uri.toString(),
            fileName,
            diagnostics: uriDiagnostics.map(diagnostic => ({
              range: {
                start: {
                  line: diagnostic.range.start.line,
                  character: diagnostic.range.start.character,
                },
                end: {
                  line: diagnostic.range.end.line,
                  character: diagnostic.range.end.character,
                },
              },
              severity: diagnostic.severity,
              message: diagnostic.message,
              source: diagnostic.source,
              code: typeof diagnostic.code === 'object' && diagnostic.code && 'value' in diagnostic.code 
                ? diagnostic.code.value 
                : diagnostic.code,
            })),
          };
          
          diagnostics.push(diagnosticInfo);
        }
      });

      return diagnostics;
    } catch (error) {
      console.error('Failed to get all diagnostics:', error);
      throw error;
    }
  }

  /**
   * 获取特定文件的诊断信息
   */
  async getFileDiagnostics(filePath: string): Promise<DiagnosticInfo | null> {
    try {
      const uri = vscode.Uri.file(filePath);
      const uriDiagnostics = vscode.languages.getDiagnostics(uri);

      if (uriDiagnostics.length === 0) {
        return null;
      }

      const fileName = UriHelper.getFileName(uri);

      return {
        uri: uri.toString(),
        fileName,
        diagnostics: uriDiagnostics.map(diagnostic => ({
          range: {
            start: {
              line: diagnostic.range.start.line,
              character: diagnostic.range.start.character,
            },
            end: {
              line: diagnostic.range.end.line,
              character: diagnostic.range.end.character,
            },
          },
          severity: diagnostic.severity,
          message: diagnostic.message,
          source: diagnostic.source,
          code: typeof diagnostic.code === 'object' && diagnostic.code && 'value' in diagnostic.code 
            ? diagnostic.code.value 
            : diagnostic.code,
        })),
      };
    } catch (error) {
      console.error(`Failed to get diagnostics for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 按严重程度分类获取诊断信息
   */
  async getDiagnosticsBySeverity(): Promise<{
    errors: DiagnosticInfo[];
    warnings: DiagnosticInfo[];
    information: DiagnosticInfo[];
    hints: DiagnosticInfo[];
  }> {
    try {
      const allDiagnostics = await this.getAllDiagnostics();
      
      const errors: DiagnosticInfo[] = [];
      const warnings: DiagnosticInfo[] = [];
      const information: DiagnosticInfo[] = [];
      const hints: DiagnosticInfo[] = [];

      allDiagnostics.forEach(diagnosticInfo => {
        const errorDiagnostics = diagnosticInfo.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        const warningDiagnostics = diagnosticInfo.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
        const infoDiagnostics = diagnosticInfo.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Information);
        const hintDiagnostics = diagnosticInfo.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Hint);

        if (errorDiagnostics.length > 0) {
          errors.push({ ...diagnosticInfo, diagnostics: errorDiagnostics });
        }
        if (warningDiagnostics.length > 0) {
          warnings.push({ ...diagnosticInfo, diagnostics: warningDiagnostics });
        }
        if (infoDiagnostics.length > 0) {
          information.push({ ...diagnosticInfo, diagnostics: infoDiagnostics });
        }
        if (hintDiagnostics.length > 0) {
          hints.push({ ...diagnosticInfo, diagnostics: hintDiagnostics });
        }
      });

      return { errors, warnings, information, hints };
    } catch (error) {
      console.error('Failed to get diagnostics by severity:', error);
      throw error;
    }
  }

  /**
   * 获取诊断统计信息
   */
  async getDiagnosticStats(): Promise<{
    totalFiles: number;
    totalDiagnostics: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    hintCount: number;
    bySource: Record<string, number>;
  }> {
    try {
      const allDiagnostics = await this.getAllDiagnostics();
      
      let totalDiagnostics = 0;
      let errorCount = 0;
      let warningCount = 0;
      let informationCount = 0;
      let hintCount = 0;
      const bySource: Record<string, number> = {};

      allDiagnostics.forEach(diagnosticInfo => {
        diagnosticInfo.diagnostics.forEach(diagnostic => {
          totalDiagnostics++;
          
          switch (diagnostic.severity) {
            case vscode.DiagnosticSeverity.Error:
              errorCount++;
              break;
            case vscode.DiagnosticSeverity.Warning:
              warningCount++;
              break;
            case vscode.DiagnosticSeverity.Information:
              informationCount++;
              break;
            case vscode.DiagnosticSeverity.Hint:
              hintCount++;
              break;
          }

          if (diagnostic.source) {
            bySource[diagnostic.source] = (bySource[diagnostic.source] || 0) + 1;
          }
        });
      });

      return {
        totalFiles: allDiagnostics.length,
        totalDiagnostics,
        errorCount,
        warningCount,
        informationCount,
        hintCount,
        bySource,
      };
    } catch (error) {
      console.error('Failed to get diagnostic stats:', error);
      throw error;
    }
  }

  /**
   * 获取当前编辑器的诊断信息
   */
  async getCurrentEditorDiagnostics(): Promise<DiagnosticInfo | null> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        return null;
      }

      return await this.getFileDiagnostics(activeEditor.document.uri.fsPath);
    } catch (error) {
      console.error('Failed to get current editor diagnostics:', error);
      return null;
    }
  }

  /**
   * 获取光标位置的诊断信息
   */
  async getDiagnosticsAtCursor(): Promise<Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    severity: number;
    message: string;
    source?: string;
    code?: string | number;
  }>> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        return [];
      }

      const position = activeEditor.selection.active;
      const uri = activeEditor.document.uri;
      const uriDiagnostics = vscode.languages.getDiagnostics(uri);

      return uriDiagnostics
        .filter(diagnostic => diagnostic.range.contains(position))
        .map(diagnostic => ({
          range: {
            start: {
              line: diagnostic.range.start.line,
              character: diagnostic.range.start.character,
            },
            end: {
              line: diagnostic.range.end.line,
              character: diagnostic.range.end.character,
            },
          },
          severity: diagnostic.severity,
          message: diagnostic.message,
          source: diagnostic.source,
          code: typeof diagnostic.code === 'object' && diagnostic.code && 'value' in diagnostic.code 
            ? diagnostic.code.value 
            : diagnostic.code,
        }));
    } catch (error) {
      console.error('Failed to get diagnostics at cursor:', error);
      return [];
    }
  }

  /**
   * 获取诊断信息的详细描述
   */
  getSeverityDescription(severity: number): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'Error';
      case vscode.DiagnosticSeverity.Warning:
        return 'Warning';
      case vscode.DiagnosticSeverity.Information:
        return 'Information';
      case vscode.DiagnosticSeverity.Hint:
        return 'Hint';
      default:
        return 'Unknown';
    }
  }

  /**
   * 过滤诊断信息
   */
  async filterDiagnostics(options: {
    severities?: number[];
    sources?: string[];
    includePattern?: string;
    excludePattern?: string;
  }): Promise<DiagnosticInfo[]> {
    try {
      const allDiagnostics = await this.getAllDiagnostics();
      
      return allDiagnostics
        .map(diagnosticInfo => {
          const filteredDiagnostics = diagnosticInfo.diagnostics.filter(diagnostic => {
            // 按严重程度过滤
            if (options.severities && !options.severities.includes(diagnostic.severity)) {
              return false;
            }

            // 按来源过滤
            if (options.sources && diagnostic.source && !options.sources.includes(diagnostic.source)) {
              return false;
            }

            return true;
          });

          return {
            ...diagnosticInfo,
            diagnostics: filteredDiagnostics,
          };
        })
        .filter(diagnosticInfo => {
          // 按文件路径过滤
          if (options.includePattern) {
            const regex = new RegExp(options.includePattern, 'i');
            if (!regex.test(diagnosticInfo.uri)) {
              return false;
            }
          }

          if (options.excludePattern) {
            const regex = new RegExp(options.excludePattern, 'i');
            if (regex.test(diagnosticInfo.uri)) {
              return false;
            }
          }

          return diagnosticInfo.diagnostics.length > 0;
        });
    } catch (error) {
      console.error('Failed to filter diagnostics:', error);
      throw error;
    }
  }

  /**
   * 获取最近的诊断变化
   */
  async getRecentDiagnosticChanges(since: number): Promise<{
    added: DiagnosticInfo[];
    removed: DiagnosticInfo[];
    modified: DiagnosticInfo[];
  }> {
    try {
      // 这里需要维护一个诊断历史记录
      // 由于这是一个复杂的功能，这里提供一个基本的实现框架
      
      return {
        added: [],
        removed: [],
        modified: [],
      };
    } catch (error) {
      console.error('Failed to get recent diagnostic changes:', error);
      throw error;
    }
  }
}
