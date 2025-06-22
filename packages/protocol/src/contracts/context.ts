/**
 * ConnAI Protocol Context Contracts
 * 
 * Defines standard contracts for context operations across different editors
 */

// Context types that can be requested
export enum ContextType {
  FOCUSED_FILE = 'focused-file',
  SELECTED_TEXT = 'selected-text',
  ALL_OPEN_TABS = 'all-open-tabs',
  PROBLEMS = 'problems',
  USER_RULES = 'user-rules',
  FILE_TREE = 'file-tree',
  FULL_CODEBASE = 'full-codebase',
  WORKSPACE_INFO = 'workspace-info',
  EDITOR_STATE = 'editor-state',
  RECENT_CHANGES = 'recent-changes',
  DIAGNOSTICS = 'diagnostics'
}

// Context request interface
export interface ContextRequest {
  type: ContextType;
  workspaceId?: string;
  options?: ContextRequestOptions;
  filters?: ContextFilters;
}

// Context request options
export interface ContextRequestOptions {
  includeContent?: boolean;
  maxItems?: number;
  maxSize?: number; // in bytes
  includeHidden?: boolean;
  depth?: number; // for file tree
  format?: 'json' | 'text' | 'markdown';
  language?: string; // for syntax highlighting
}

// Context filters
export interface ContextFilters {
  fileExtensions?: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  modifiedSince?: number; // timestamp
  author?: string;
  hasProblems?: boolean;
}

// Context response interface
export interface ContextResponse<T = any> {
  type: ContextType;
  data: T;
  metadata: ContextMetadata;
  success: boolean;
  error?: string;
}

// Context metadata
export interface ContextMetadata {
  workspaceId: string;
  timestamp: number;
  itemCount: number;
  totalSize: number; // in bytes
  tokenCount?: number;
  source: string; // editor name
  version: string; // editor version
  processingTime?: number; // in ms
}

// Specific context data interfaces

// Focused file context
export interface FocusedFileContext {
  uri: string;
  name: string;
  path: string;
  content?: string;
  language: string;
  size: number;
  lastModified: number;
  cursor?: {
    line: number;
    character: number;
  };
  selection?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
    text?: string;
  };
}

// Selected text context
export interface SelectedTextContext {
  text: string;
  file: {
    uri: string;
    name: string;
    language: string;
  };
  selection: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  surroundingContext?: {
    before: string;
    after: string;
  };
}

// Open tabs context
export interface OpenTabsContext {
  tabs: Array<{
    uri: string;
    name: string;
    path: string;
    language: string;
    isDirty: boolean;
    isActive: boolean;
    content?: string;
    size?: number;
    lastModified?: number;
  }>;
  activeTabIndex: number;
}

// Problems/diagnostics context
export interface ProblemsContext {
  problems: Array<{
    file: string;
    line: number;
    character: number;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    source?: string;
    code?: string | number;
    relatedInformation?: Array<{
      file: string;
      line: number;
      character: number;
      message: string;
    }>;
  }>;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    hints: number;
  };
}

// File tree context
export interface FileTreeContext {
  root: FileTreeNode;
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: number;
  children?: FileTreeNode[];
  language?: string; // for files
  isSymlink?: boolean;
  isHidden?: boolean;
}

// Workspace info context
export interface WorkspaceInfoContext {
  id: string;
  name: string;
  rootPath: string;
  folders: Array<{
    name: string;
    path: string;
    index: number;
  }>;
  settings?: any;
  extensions?: Array<{
    id: string;
    name: string;
    version: string;
    enabled: boolean;
  }>;
}

// Editor state context
export interface EditorStateContext {
  activeEditor?: {
    uri: string;
    language: string;
    selection: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    visibleRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
  openEditors: Array<{
    uri: string;
    viewColumn: number;
    isActive: boolean;
    isDirty: boolean;
  }>;
  layout: {
    editorGroups: number;
    sidebarVisible: boolean;
    panelVisible: boolean;
  };
}

// Recent changes context
export interface RecentChangesContext {
  changes: Array<{
    file: string;
    timestamp: number;
    type: 'added' | 'modified' | 'deleted' | 'renamed';
    author?: string;
    summary?: string;
  }>;
  since: number; // timestamp
}

// Context contract interface - to be implemented by editor adapters
export interface ContextContract {
  /**
   * Get context data for a specific type
   */
  getContext(request: ContextRequest): Promise<ContextResponse>;
  
  /**
   * Check if a context type is supported
   */
  supportsContextType(type: ContextType): boolean;
  
  /**
   * Get available context types
   */
  getAvailableContextTypes(): ContextType[];
  
  /**
   * Stream context data for large responses
   */
  streamContext?(request: ContextRequest): AsyncIterableIterator<Partial<ContextResponse>>;
}

// Context utilities
export class ContextUtils {
  /**
   * Validate context request
   */
  static validateRequest(request: ContextRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Object.values(ContextType).includes(request.type)) {
      errors.push('Invalid context type');
    }
    
    if (request.options?.maxItems && request.options.maxItems <= 0) {
      errors.push('maxItems must be positive');
    }
    
    if (request.options?.maxSize && request.options.maxSize <= 0) {
      errors.push('maxSize must be positive');
    }
    
    if (request.options?.depth && request.options.depth < 0) {
      errors.push('depth must be non-negative');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Estimate token count for context data
   */
  static estimateTokenCount(data: any): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Calculate data size in bytes
   */
  static calculateSize(data: any): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return Buffer.byteLength(text, 'utf8');
  }
  
  /**
   * Filter context data based on filters
   */
  static applyFilters<T>(data: T[], filters: ContextFilters): T[] {
    let filtered = data;
    
    // Apply file extension filters
    if (filters.fileExtensions && Array.isArray(filtered)) {
      filtered = filtered.filter((item: any) => {
        if (item.name || item.path) {
          const name = item.name || item.path;
          return filters.fileExtensions!.some(ext => 
            name.toLowerCase().endsWith(ext.toLowerCase())
          );
        }
        return true;
      });
    }
    
    // Apply exclude patterns
    if (filters.excludePatterns && Array.isArray(filtered)) {
      filtered = filtered.filter((item: any) => {
        if (item.name || item.path) {
          const name = item.name || item.path;
          return !filters.excludePatterns!.some(pattern => 
            name.includes(pattern)
          );
        }
        return true;
      });
    }
    
    // Apply include patterns
    if (filters.includePatterns && Array.isArray(filtered)) {
      filtered = filtered.filter((item: any) => {
        if (item.name || item.path) {
          const name = item.name || item.path;
          return filters.includePatterns!.some(pattern => 
            name.includes(pattern)
          );
        }
        return true;
      });
    }
    
    // Apply modification time filter
    if (filters.modifiedSince && Array.isArray(filtered)) {
      filtered = filtered.filter((item: any) => {
        if (item.lastModified) {
          return item.lastModified >= filters.modifiedSince!;
        }
        return true;
      });
    }
    
    return filtered;
  }
}
