/**
 * ConnAI Protocol Workspace Contracts
 * 
 * Defines standard contracts for workspace operations across different editors
 */

// Workspace operation types
export enum WorkspaceOperation {
  LIST = 'list',
  GET_INFO = 'get_info',
  SWITCH = 'switch',
  CREATE = 'create',
  DELETE = 'delete',
  RENAME = 'rename',
  WATCH = 'watch',
  UNWATCH = 'unwatch'
}

// Workspace request interface
export interface WorkspaceRequest {
  operation: WorkspaceOperation;
  workspaceId?: string;
  options?: WorkspaceRequestOptions;
}

// Workspace request options
export interface WorkspaceRequestOptions {
  path?: string; // for create operation
  newName?: string; // for rename operation
  includeSettings?: boolean;
  includeExtensions?: boolean;
  includeStats?: boolean;
}

// Workspace response interface
export interface WorkspaceResponse<T = any> {
  operation: WorkspaceOperation;
  success: boolean;
  data?: T;
  error?: string;
}

// Workspace info interface
export interface WorkspaceInfo {
  id: string;
  name: string;
  rootPath: string;
  folders: WorkspaceFolder[];
  isActive: boolean;
  createdAt?: number;
  lastAccessed?: number;
  settings?: WorkspaceSettings;
  extensions?: WorkspaceExtension[];
  stats?: WorkspaceStats;
}

// Workspace folder interface
export interface WorkspaceFolder {
  name: string;
  path: string;
  index: number;
  isRoot: boolean;
}

// Workspace settings interface
export interface WorkspaceSettings {
  [key: string]: any;
  // Common settings
  'editor.tabSize'?: number;
  'editor.insertSpaces'?: boolean;
  'files.encoding'?: string;
  'files.eol'?: string;
  'files.exclude'?: Record<string, boolean>;
  'search.exclude'?: Record<string, boolean>;
}

// Workspace extension interface
export interface WorkspaceExtension {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  isBuiltIn: boolean;
  publisher?: string;
  description?: string;
}

// Workspace statistics interface
export interface WorkspaceStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number; // in bytes
  filesByType: Record<string, number>; // extension -> count
  sizeByType: Record<string, number>; // extension -> total size
  lastModified: number;
  gitRepository?: {
    branch: string;
    hasChanges: boolean;
    commitCount: number;
    remotes: string[];
  };
}

// Workspace change event interface
export interface WorkspaceChangeEvent {
  type: 'added' | 'removed' | 'renamed' | 'switched' | 'settings_changed';
  workspaceId: string;
  oldWorkspaceId?: string; // for rename events
  timestamp: number;
  data?: any;
}

// Multi-workspace info interface
export interface MultiWorkspaceInfo {
  workspaces: WorkspaceInfo[];
  activeWorkspaceId?: string;
  totalWorkspaces: number;
}

// Workspace contract interface - to be implemented by editor adapters
export interface WorkspaceContract {
  /**
   * Perform workspace operation
   */
  performWorkspaceOperation(request: WorkspaceRequest): Promise<WorkspaceResponse>;
  
  /**
   * List all available workspaces
   */
  listWorkspaces(): Promise<WorkspaceInfo[]>;
  
  /**
   * Get information about a specific workspace
   */
  getWorkspaceInfo(workspaceId?: string): Promise<WorkspaceInfo>;
  
  /**
   * Get information about all workspaces
   */
  getMultiWorkspaceInfo(): Promise<MultiWorkspaceInfo>;
  
  /**
   * Switch to a different workspace
   */
  switchWorkspace(workspaceId: string): Promise<WorkspaceResponse>;
  
  /**
   * Get current active workspace
   */
  getCurrentWorkspace(): Promise<WorkspaceInfo | null>;
  
  /**
   * Create a new workspace
   */
  createWorkspace(path: string, name?: string): Promise<WorkspaceResponse<WorkspaceInfo>>;
  
  /**
   * Delete a workspace
   */
  deleteWorkspace(workspaceId: string): Promise<WorkspaceResponse>;
  
  /**
   * Rename a workspace
   */
  renameWorkspace(workspaceId: string, newName: string): Promise<WorkspaceResponse>;
  
  /**
   * Watch workspace changes
   */
  watchWorkspaces(): Promise<string>; // returns watch ID
  
  /**
   * Unwatch workspace changes
   */
  unwatchWorkspaces(watchId: string): Promise<void>;
  
  /**
   * Get workspace settings
   */
  getWorkspaceSettings(workspaceId?: string): Promise<WorkspaceSettings>;
  
  /**
   * Update workspace settings
   */
  updateWorkspaceSettings(
    settings: Partial<WorkspaceSettings>, 
    workspaceId?: string
  ): Promise<WorkspaceResponse>;
  
  /**
   * Get workspace extensions
   */
  getWorkspaceExtensions(workspaceId?: string): Promise<WorkspaceExtension[]>;
  
  /**
   * Get workspace statistics
   */
  getWorkspaceStats(workspaceId?: string): Promise<WorkspaceStats>;
  
  /**
   * Get supported workspace operations
   */
  getSupportedOperations(): WorkspaceOperation[];
}

// Workspace utilities
export class WorkspaceUtils {
  /**
   * Validate workspace ID
   */
  static validateWorkspaceId(id: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!id) {
      errors.push('Workspace ID is required');
    }
    
    if (id && id.length < 3) {
      errors.push('Workspace ID must be at least 3 characters');
    }
    
    if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) {
      errors.push('Workspace ID can only contain alphanumeric characters, underscores, and hyphens');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generate workspace ID from path
   */
  static generateWorkspaceId(path: string): string {
    const folderName = path.split(/[/\\]/).pop() || 'workspace';
    const timestamp = Date.now().toString(36);
    return `${folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
  }
  
  /**
   * Normalize workspace path
   */
  static normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+$/, '');
  }
  
  /**
   * Check if path is valid workspace root
   */
  static isValidWorkspaceRoot(path: string): boolean {
    // Basic validation - actual implementation would check if directory exists
    return path.length > 0 && !path.includes('\0');
  }
  
  /**
   * Get workspace name from path
   */
  static getWorkspaceNameFromPath(path: string): string {
    const normalized = this.normalizePath(path);
    return normalized.split('/').pop() || 'Untitled Workspace';
  }
  
  /**
   * Merge workspace settings
   */
  static mergeSettings(
    defaultSettings: WorkspaceSettings,
    userSettings: Partial<WorkspaceSettings>
  ): WorkspaceSettings {
    return { ...defaultSettings, ...userSettings };
  }
  
  /**
   * Filter workspaces by criteria
   */
  static filterWorkspaces(
    workspaces: WorkspaceInfo[],
    criteria: {
      name?: string;
      path?: string;
      hasChanges?: boolean;
      isActive?: boolean;
      createdAfter?: number;
      accessedAfter?: number;
    }
  ): WorkspaceInfo[] {
    return workspaces.filter(workspace => {
      if (criteria.name && !workspace.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      
      if (criteria.path && !workspace.rootPath.toLowerCase().includes(criteria.path.toLowerCase())) {
        return false;
      }
      
      if (criteria.isActive !== undefined && workspace.isActive !== criteria.isActive) {
        return false;
      }
      
      if (criteria.createdAfter && workspace.createdAt && workspace.createdAt < criteria.createdAfter) {
        return false;
      }
      
      if (criteria.accessedAfter && workspace.lastAccessed && workspace.lastAccessed < criteria.accessedAfter) {
        return false;
      }
      
      if (criteria.hasChanges !== undefined && workspace.stats?.gitRepository) {
        if (workspace.stats.gitRepository.hasChanges !== criteria.hasChanges) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Sort workspaces by criteria
   */
  static sortWorkspaces(
    workspaces: WorkspaceInfo[],
    sortBy: 'name' | 'path' | 'lastAccessed' | 'createdAt' | 'size' = 'name',
    ascending: boolean = true
  ): WorkspaceInfo[] {
    const sorted = [...workspaces].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'path':
          comparison = a.rootPath.localeCompare(b.rootPath);
          break;
        case 'lastAccessed':
          comparison = (a.lastAccessed || 0) - (b.lastAccessed || 0);
          break;
        case 'createdAt':
          comparison = (a.createdAt || 0) - (b.createdAt || 0);
          break;
        case 'size':
          comparison = (a.stats?.totalSize || 0) - (b.stats?.totalSize || 0);
          break;
      }
      
      return ascending ? comparison : -comparison;
    });
    
    return sorted;
  }
  
  /**
   * Get workspace statistics summary
   */
  static getStatsSummary(workspaces: WorkspaceInfo[]): {
    totalWorkspaces: number;
    activeWorkspaces: number;
    totalFiles: number;
    totalSize: number;
    mostUsedExtensions: Array<{ extension: string; count: number }>;
  } {
    const summary = {
      totalWorkspaces: workspaces.length,
      activeWorkspaces: workspaces.filter(w => w.isActive).length,
      totalFiles: 0,
      totalSize: 0,
      mostUsedExtensions: [] as Array<{ extension: string; count: number }>
    };
    
    const extensionCounts: Record<string, number> = {};
    
    workspaces.forEach(workspace => {
      if (workspace.stats) {
        summary.totalFiles += workspace.stats.totalFiles;
        summary.totalSize += workspace.stats.totalSize;
        
        Object.entries(workspace.stats.filesByType).forEach(([ext, count]) => {
          extensionCounts[ext] = (extensionCounts[ext] || 0) + count;
        });
      }
    });
    
    summary.mostUsedExtensions = Object.entries(extensionCounts)
      .map(([extension, count]) => ({ extension, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return summary;
  }
}
