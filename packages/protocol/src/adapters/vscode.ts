/**
 * ConnAI Protocol VS Code Adapter
 * 
 * Implementation of the protocol for VS Code editor
 */

import { 
  BaseEditorAdapter, 
  EditorAdapterConfig, 
  AdapterEvent 
} from './base.js';
import {
  ContextContract,
  ContextRequest,
  ContextResponse,
  ContextType,
  FileContract,
  WorkspaceContract,
  AuthContract
} from '../contracts/index.js';
import { ProtocolCapability } from '../core/protocol.js';

// VS Code adapter implementation
export class VSCodeAdapter extends BaseEditorAdapter {
  private vscode: any; // VS Code API will be injected

  constructor(config: EditorAdapterConfig, vscode?: any) {
    super(config);
    this.vscode = vscode;
  }

  protected async onInitialize(): Promise<void> {
    // VS Code specific initialization
    if (!this.vscode) {
      throw new Error('VS Code API not available');
    }

    console.log('VS Code adapter initialized');
  }

  protected async onDispose(): Promise<void> {
    // VS Code specific cleanup
    console.log('VS Code adapter disposed');
  }

  protected createContextContract(): ContextContract | null {
    if (!this.vscode) return null;

    return new VSCodeContextContract(this.vscode);
  }

  protected createFileContract(): FileContract | null {
    if (!this.vscode) return null;

    return new VSCodeFileContract(this.vscode);
  }

  protected createWorkspaceContract(): WorkspaceContract | null {
    if (!this.vscode) return null;

    return new VSCodeWorkspaceContract(this.vscode);
  }

  protected createAuthContract(): AuthContract | null {
    if (!this.vscode) return null;

    return new VSCodeAuthContract(this.vscode);
  }
}

// VS Code Context Contract Implementation
class VSCodeContextContract implements ContextContract {
  constructor(private vscode: any) {}

  async getContext(request: ContextRequest): Promise<ContextResponse> {
    try {
      const data = await this.getContextData(request.type);
      
      return {
        type: request.type,
        data,
        metadata: {
          workspaceId: request.workspaceId || 'default',
          timestamp: Date.now(),
          itemCount: Array.isArray(data) ? data.length : 1,
          totalSize: JSON.stringify(data).length,
          source: 'vscode',
          version: this.vscode.version || '1.0.0'
        },
        success: true
      };
    } catch (error) {
      return {
        type: request.type,
        data: null,
        metadata: {
          workspaceId: request.workspaceId || 'default',
          timestamp: Date.now(),
          itemCount: 0,
          totalSize: 0,
          source: 'vscode',
          version: this.vscode.version || '1.0.0'
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getContextData(type: ContextType): Promise<any> {
    switch (type) {
      case ContextType.FOCUSED_FILE:
        return this.getFocusedFile();
      case ContextType.SELECTED_TEXT:
        return this.getSelectedText();
      case ContextType.ALL_OPEN_TABS:
        return this.getAllOpenTabs();
      case ContextType.PROBLEMS:
        return this.getProblems();
      case ContextType.FILE_TREE:
        return this.getFileTree();
      case ContextType.WORKSPACE_INFO:
        return this.getWorkspaceInfo();
      case ContextType.EDITOR_STATE:
        return this.getEditorState();
      default:
        throw new Error(`Unsupported context type: ${type}`);
    }
  }

  private async getFocusedFile(): Promise<any> {
    const activeEditor = this.vscode.window.activeTextEditor;
    if (!activeEditor) {
      return null;
    }

    const document = activeEditor.document;
    const selection = activeEditor.selection;

    return {
      uri: document.uri.toString(),
      name: document.fileName.split('/').pop(),
      path: document.fileName,
      content: document.getText(),
      language: document.languageId,
      size: document.getText().length,
      lastModified: Date.now(),
      cursor: {
        line: selection.active.line,
        character: selection.active.character
      },
      selection: selection.isEmpty ? undefined : {
        start: { line: selection.start.line, character: selection.start.character },
        end: { line: selection.end.line, character: selection.end.character },
        text: document.getText(selection)
      }
    };
  }

  private async getSelectedText(): Promise<any> {
    const activeEditor = this.vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.selection.isEmpty) {
      return null;
    }

    const document = activeEditor.document;
    const selection = activeEditor.selection;
    const selectedText = document.getText(selection);

    return {
      text: selectedText,
      file: {
        uri: document.uri.toString(),
        name: document.fileName.split('/').pop(),
        language: document.languageId
      },
      selection: {
        start: { line: selection.start.line, character: selection.start.character },
        end: { line: selection.end.line, character: selection.end.character }
      }
    };
  }

  private async getAllOpenTabs(): Promise<any> {
    const tabGroups = this.vscode.window.tabGroups;
    const tabs: any[] = [];
    let activeTabIndex = -1;

    tabGroups.all.forEach((group: any, groupIndex: number) => {
      group.tabs.forEach((tab: any, tabIndex: number) => {
        if (tab.input?.uri) {
          const isActive = group.isActive && tab.isActive;
          if (isActive) {
            activeTabIndex = tabs.length;
          }

          tabs.push({
            uri: tab.input.uri.toString(),
            name: tab.label,
            path: tab.input.uri.fsPath,
            language: tab.input.uri.path.split('.').pop() || 'unknown',
            isDirty: tab.isDirty,
            isActive
          });
        }
      });
    });

    return {
      tabs,
      activeTabIndex
    };
  }

  private async getProblems(): Promise<any> {
    const diagnostics = this.vscode.languages.getDiagnostics();
    const problems: any[] = [];
    let summary = { errors: 0, warnings: 0, infos: 0, hints: 0 };

    diagnostics.forEach(([uri, diagnosticArray]: [any, any[]]) => {
      diagnosticArray.forEach(diagnostic => {
        const problem = {
          file: uri.fsPath,
          line: diagnostic.range.start.line,
          character: diagnostic.range.start.character,
          severity: this.getSeverityString(diagnostic.severity),
          message: diagnostic.message,
          source: diagnostic.source,
          code: diagnostic.code
        };

        problems.push(problem);

        // Update summary
        switch (diagnostic.severity) {
          case this.vscode.DiagnosticSeverity.Error:
            summary.errors++;
            break;
          case this.vscode.DiagnosticSeverity.Warning:
            summary.warnings++;
            break;
          case this.vscode.DiagnosticSeverity.Information:
            summary.infos++;
            break;
          case this.vscode.DiagnosticSeverity.Hint:
            summary.hints++;
            break;
        }
      });
    });

    return { problems, summary };
  }

  private async getFileTree(): Promise<any> {
    // This would require implementing a file tree walker
    // For now, return a basic structure
    const workspaceFolders = this.vscode.workspace.workspaceFolders || [];
    
    if (workspaceFolders.length === 0) {
      return null;
    }

    const rootFolder = workspaceFolders[0];
    return {
      root: {
        name: rootFolder.name,
        path: rootFolder.uri.fsPath,
        type: 'directory' as const,
        children: [] // Would need to implement recursive directory reading
      },
      totalFiles: 0,
      totalDirectories: 1,
      totalSize: 0
    };
  }

  private async getWorkspaceInfo(): Promise<any> {
    const workspaceFolders = this.vscode.workspace.workspaceFolders || [];
    
    return {
      id: this.vscode.workspace.name || 'default',
      name: this.vscode.workspace.name || 'Untitled Workspace',
      rootPath: workspaceFolders[0]?.uri.fsPath || '',
      folders: workspaceFolders.map((folder: any, index: number) => ({
        name: folder.name,
        path: folder.uri.fsPath,
        index,
        isRoot: index === 0
      }))
    };
  }

  private async getEditorState(): Promise<any> {
    const activeEditor = this.vscode.window.activeTextEditor;
    const visibleEditors = this.vscode.window.visibleTextEditors;

    return {
      activeEditor: activeEditor ? {
        uri: activeEditor.document.uri.toString(),
        language: activeEditor.document.languageId,
        selection: {
          start: { 
            line: activeEditor.selection.start.line, 
            character: activeEditor.selection.start.character 
          },
          end: { 
            line: activeEditor.selection.end.line, 
            character: activeEditor.selection.end.character 
          }
        },
        visibleRange: {
          start: { 
            line: activeEditor.visibleRanges[0]?.start.line || 0, 
            character: 0 
          },
          end: { 
            line: activeEditor.visibleRanges[0]?.end.line || 0, 
            character: 0 
          }
        }
      } : undefined,
      openEditors: visibleEditors.map((editor: any, index: number) => ({
        uri: editor.document.uri.toString(),
        viewColumn: editor.viewColumn || 1,
        isActive: editor === activeEditor,
        isDirty: editor.document.isDirty
      })),
      layout: {
        editorGroups: this.vscode.window.tabGroups.all.length,
        sidebarVisible: true, // VS Code doesn't provide this info easily
        panelVisible: true
      }
    };
  }

  private getSeverityString(severity: number): string {
    switch (severity) {
      case 0: return 'error';
      case 1: return 'warning';
      case 2: return 'info';
      case 3: return 'hint';
      default: return 'info';
    }
  }

  supportsContextType(type: ContextType): boolean {
    const supportedTypes = [
      ContextType.FOCUSED_FILE,
      ContextType.SELECTED_TEXT,
      ContextType.ALL_OPEN_TABS,
      ContextType.PROBLEMS,
      ContextType.FILE_TREE,
      ContextType.WORKSPACE_INFO,
      ContextType.EDITOR_STATE
    ];

    return supportedTypes.includes(type);
  }

  getAvailableContextTypes(): ContextType[] {
    return [
      ContextType.FOCUSED_FILE,
      ContextType.SELECTED_TEXT,
      ContextType.ALL_OPEN_TABS,
      ContextType.PROBLEMS,
      ContextType.FILE_TREE,
      ContextType.WORKSPACE_INFO,
      ContextType.EDITOR_STATE
    ];
  }
}

// Placeholder implementations for other contracts
class VSCodeFileContract implements FileContract {
  constructor(private vscode: any) {}

  // Implementation would go here
  async performFileOperation(): Promise<any> {
    throw new Error('Not implemented');
  }

  async readFile(): Promise<any> {
    throw new Error('Not implemented');
  }

  async writeFile(): Promise<any> {
    throw new Error('Not implemented');
  }

  async fileExists(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async getFileMetadata(): Promise<any> {
    throw new Error('Not implemented');
  }

  async listDirectory(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async searchFiles(): Promise<any> {
    throw new Error('Not implemented');
  }

  async watchFile(): Promise<string> {
    throw new Error('Not implemented');
  }

  async unwatchFile(): Promise<void> {
    throw new Error('Not implemented');
  }

  getSupportedOperations(): any[] {
    return [];
  }
}

class VSCodeWorkspaceContract implements WorkspaceContract {
  constructor(private vscode: any) {}

  // Implementation would go here
  async performWorkspaceOperation(): Promise<any> {
    throw new Error('Not implemented');
  }

  async listWorkspaces(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async getWorkspaceInfo(): Promise<any> {
    throw new Error('Not implemented');
  }

  async getMultiWorkspaceInfo(): Promise<any> {
    throw new Error('Not implemented');
  }

  async switchWorkspace(): Promise<any> {
    throw new Error('Not implemented');
  }

  async getCurrentWorkspace(): Promise<any> {
    throw new Error('Not implemented');
  }

  async createWorkspace(): Promise<any> {
    throw new Error('Not implemented');
  }

  async deleteWorkspace(): Promise<any> {
    throw new Error('Not implemented');
  }

  async renameWorkspace(): Promise<any> {
    throw new Error('Not implemented');
  }

  async watchWorkspaces(): Promise<string> {
    throw new Error('Not implemented');
  }

  async unwatchWorkspaces(): Promise<void> {
    throw new Error('Not implemented');
  }

  async getWorkspaceSettings(): Promise<any> {
    throw new Error('Not implemented');
  }

  async updateWorkspaceSettings(): Promise<any> {
    throw new Error('Not implemented');
  }

  async getWorkspaceExtensions(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async getWorkspaceStats(): Promise<any> {
    throw new Error('Not implemented');
  }

  getSupportedOperations(): any[] {
    return [];
  }
}

class VSCodeAuthContract implements AuthContract {
  constructor(private vscode: any) {}

  // Implementation would go here
  async authenticate(): Promise<any> {
    throw new Error('Not implemented');
  }

  async getAuthInfo(): Promise<any> {
    throw new Error('Not implemented');
  }

  async refreshAuth(): Promise<any> {
    throw new Error('Not implemented');
  }

  async logout(): Promise<void> {
    throw new Error('Not implemented');
  }

  async isAuthenticated(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async checkPermission(): Promise<any> {
    throw new Error('Not implemented');
  }

  async checkPermissions(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async getUserProfile(): Promise<any> {
    throw new Error('Not implemented');
  }

  async updateUserProfile(): Promise<any> {
    throw new Error('Not implemented');
  }

  getSupportedMethods(): any[] {
    return [];
  }
}

// Factory function to create VS Code adapter
export function createVSCodeAdapter(vscode: any): VSCodeAdapter {
  const config: EditorAdapterConfig = {
    info: {
      name: 'vscode-adapter',
      version: '1.0.0',
      editorName: 'vscode',
      editorVersion: vscode.version || '1.0.0',
      platform: process.platform,
      capabilities: [
        ProtocolCapability.GET_CONTEXT,
        ProtocolCapability.READ_FILE,
        ProtocolCapability.SEARCH_FILES,
        ProtocolCapability.GET_WORKSPACE_INFO,
        ProtocolCapability.GET_EDITOR_STATE,
        ProtocolCapability.GET_DIAGNOSTICS
      ]
    },
    protocol: {
      version: '1.0.0',
      capabilities: [
        ProtocolCapability.GET_CONTEXT,
        ProtocolCapability.READ_FILE,
        ProtocolCapability.SEARCH_FILES,
        ProtocolCapability.GET_WORKSPACE_INFO,
        ProtocolCapability.GET_EDITOR_STATE,
        ProtocolCapability.GET_DIAGNOSTICS
      ],
      transport: {
        type: 'websocket',
        endpoint: 'ws://localhost:3000',
        timeout: 10000,
        retryAttempts: 3
      },
      limits: {
        maxMessageSize: 10 * 1024 * 1024,
        maxConcurrentRequests: 10,
        rateLimitPerSecond: 100
      },
      features: {
        compression: true,
        encryption: false,
        batchRequests: true
      }
    },
    features: {
      context: true,
      files: true,
      workspace: true,
      auth: true
    }
  };

  return new VSCodeAdapter(config, vscode);
}
