import * as vscode from 'vscode';
import { CursorContext } from '@connai/shared';
import { UriHelper } from '../utils/uriHelper';

/**
 * 提供光标位置和选中区的上下文
 */

export class CursorProvider {
  /**
   * 获取当前光标上下文
   */
  async getCursorContext(): Promise<CursorContext> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      let activeEditorInfo;

      if (activeEditor) {
        const document = activeEditor.document;
        const selection = activeEditor.selection;
        const visibleRanges = activeEditor.visibleRanges;

        // 获取选中的文本
        let selectedText: string | undefined;
        if (!selection.isEmpty) {
          selectedText = document.getText(selection);
        }

        activeEditorInfo = {
          uri: document.uri.toString(),
          fileName: UriHelper.getFileName(document.uri),
          language: document.languageId,
          selection: {
            start: {
              line: selection.start.line,
              character: selection.start.character,
            },
            end: {
              line: selection.end.line,
              character: selection.end.character,
            },
          },
          selectedText,
          visibleRange: {
            start: {
              line: visibleRanges[0]?.start.line || 0,
              character: visibleRanges[0]?.start.character || 0,
            },
            end: {
              line: visibleRanges[0]?.end.line || 0,
              character: visibleRanges[0]?.end.character || 0,
            },
          },
        };
      }

      // 获取所有打开的编辑器
      const openEditors = vscode.workspace.textDocuments.map(doc => doc.uri.toString());

      return {
        activeEditor: activeEditorInfo,
        openEditors,
      };
    } catch (error) {
      console.error('Failed to get cursor context:', error);
      throw error;
    }
  }

  /**
   * 获取光标周围的上下文文本
   */
  async getCursorSurroundingContext(lines: number = 10): Promise<{
    beforeCursor: string[];
    afterCursor: string[];
    currentLine: string;
    cursorPosition: { line: number; character: number };
  } | null> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        return null;
      }

      const document = activeEditor.document;
      const position = activeEditor.selection.active;
      const totalLines = document.lineCount;

      // 获取光标前的行
      const beforeLines: string[] = [];
      const startLine = Math.max(0, position.line - lines);
      for (let i = startLine; i < position.line; i++) {
        beforeLines.push(document.lineAt(i).text);
      }

      // 获取当前行
      const currentLine = document.lineAt(position.line).text;

      // 获取光标后的行
      const afterLines: string[] = [];
      const endLine = Math.min(totalLines - 1, position.line + lines);
      for (let i = position.line + 1; i <= endLine; i++) {
        afterLines.push(document.lineAt(i).text);
      }

      return {
        beforeCursor: beforeLines,
        afterCursor: afterLines,
        currentLine,
        cursorPosition: {
          line: position.line,
          character: position.character,
        },
      };
    } catch (error) {
      console.error('Failed to get cursor surrounding context:', error);
      throw error;
    }
  }

  /**
   * 获取当前选中的文本及其上下文
   */
  async getSelectionContext(contextLines: number = 5): Promise<{
    selectedText: string;
    beforeSelection: string[];
    afterSelection: string[];
    selectionRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  } | null> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor || activeEditor.selection.isEmpty) {
        return null;
      }

      const document = activeEditor.document;
      const selection = activeEditor.selection;
      const selectedText = document.getText(selection);

      // 获取选择前的上下文行
      const beforeLines: string[] = [];
      const startLine = Math.max(0, selection.start.line - contextLines);
      for (let i = startLine; i < selection.start.line; i++) {
        beforeLines.push(document.lineAt(i).text);
      }

      // 获取选择后的上下文行
      const afterLines: string[] = [];
      const endLine = Math.min(document.lineCount - 1, selection.end.line + contextLines);
      for (let i = selection.end.line + 1; i <= endLine; i++) {
        afterLines.push(document.lineAt(i).text);
      }

      return {
        selectedText,
        beforeSelection: beforeLines,
        afterSelection: afterLines,
        selectionRange: {
          start: {
            line: selection.start.line,
            character: selection.start.character,
          },
          end: {
            line: selection.end.line,
            character: selection.end.character,
          },
        },
      };
    } catch (error) {
      console.error('Failed to get selection context:', error);
      throw error;
    }
  }

  /**
   * 获取当前函数或方法的上下文
   */
  async getCurrentFunctionContext(): Promise<{
    functionName?: string;
    functionBody: string;
    startLine: number;
    endLine: number;
    language: string;
  } | null> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        return null;
      }

      const document = activeEditor.document;
      const position = activeEditor.selection.active;

      // 获取当前位置的符号信息
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      if (!symbols) {
        return null;
      }

      // 查找包含当前位置的函数符号
      const findContainingFunction = (symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | null => {
        for (const symbol of symbols) {
          if (symbol.kind === vscode.SymbolKind.Function || 
              symbol.kind === vscode.SymbolKind.Method ||
              symbol.kind === vscode.SymbolKind.Constructor) {
            if (symbol.range.contains(position)) {
              return symbol;
            }
          }
          
          // 递归查找子符号
          if (symbol.children) {
            const child = findContainingFunction(symbol.children);
            if (child) {
              return child;
            }
          }
        }
        return null;
      };

      const functionSymbol = findContainingFunction(symbols);
      
      if (!functionSymbol) {
        return null;
      }

      const functionBody = document.getText(functionSymbol.range);

      return {
        functionName: functionSymbol.name,
        functionBody,
        startLine: functionSymbol.range.start.line,
        endLine: functionSymbol.range.end.line,
        language: document.languageId,
      };
    } catch (error) {
      console.error('Failed to get current function context:', error);
      return null;
    }
  }

  /**
   * 获取光标位置的词汇信息
   */
  async getWordAtCursor(): Promise<{
    word: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  } | null> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        return null;
      }

      const document = activeEditor.document;
      const position = activeEditor.selection.active;
      const wordRange = document.getWordRangeAtPosition(position);

      if (!wordRange) {
        return null;
      }

      const word = document.getText(wordRange);

      return {
        word,
        range: {
          start: {
            line: wordRange.start.line,
            character: wordRange.start.character,
          },
          end: {
            line: wordRange.end.line,
            character: wordRange.end.character,
          },
        },
      };
    } catch (error) {
      console.error('Failed to get word at cursor:', error);
      return null;
    }
  }

  /**
   * 获取所有可见编辑器的信息
   */
  async getVisibleEditorsInfo(): Promise<Array<{
    uri: string;
    fileName: string;
    language: string;
    viewColumn?: number;
    selection: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    visibleRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>> {
    try {
      return vscode.window.visibleTextEditors.map(editor => ({
        uri: editor.document.uri.toString(),
        fileName: UriHelper.getFileName(editor.document.uri),
        language: editor.document.languageId,
        viewColumn: editor.viewColumn,
        selection: {
          start: {
            line: editor.selection.start.line,
            character: editor.selection.start.character,
          },
          end: {
            line: editor.selection.end.line,
            character: editor.selection.end.character,
          },
        },
        visibleRange: {
          start: {
            line: editor.visibleRanges[0]?.start.line || 0,
            character: editor.visibleRanges[0]?.start.character || 0,
          },
          end: {
            line: editor.visibleRanges[0]?.end.line || 0,
            character: editor.visibleRanges[0]?.end.character || 0,
          },
        },
      }));
    } catch (error) {
      console.error('Failed to get visible editors info:', error);
      throw error;
    }
  }

  /**
   * 获取当前编辑器的滚动位置
   */
  async getScrollPosition(): Promise<{
    topLine: number;
    bottomLine: number;
    totalLines: number;
    scrollPercentage: number;
  } | null> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        return null;
      }

      const visibleRanges = activeEditor.visibleRanges;
      const totalLines = activeEditor.document.lineCount;

      if (visibleRanges.length === 0) {
        return null;
      }

      const topLine = visibleRanges[0].start.line;
      const bottomLine = visibleRanges[visibleRanges.length - 1].end.line;
      const scrollPercentage = totalLines > 0 ? (topLine / totalLines) * 100 : 0;

      return {
        topLine,
        bottomLine,
        totalLines,
        scrollPercentage,
      };
    } catch (error) {
      console.error('Failed to get scroll position:', error);
      return null;
    }
  }
}
