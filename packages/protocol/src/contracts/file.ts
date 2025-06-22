/**
 * ConnAI Protocol File Contracts
 * 
 * Defines standard contracts for file operations across different editors
 */

// File operation types
export enum FileOperation {
  READ = 'read',
  WRITE = 'write',
  CREATE = 'create',
  DELETE = 'delete',
  RENAME = 'rename',
  COPY = 'copy',
  MOVE = 'move',
  WATCH = 'watch',
  UNWATCH = 'unwatch'
}

// File request interface
export interface FileRequest {
  operation: FileOperation;
  path: string;
  workspaceId?: string;
  options?: FileRequestOptions;
}

// File request options
export interface FileRequestOptions {
  encoding?: string;
  content?: string | Buffer;
  newPath?: string; // for rename/move operations
  recursive?: boolean; // for directory operations
  overwrite?: boolean;
  backup?: boolean;
  includeMetadata?: boolean;
  watchOptions?: FileWatchOptions;
}

// File watch options
export interface FileWatchOptions {
  recursive?: boolean;
  ignorePattern?: string;
  events?: FileChangeType[];
}

// File change types
export enum FileChangeType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed'
}

// File response interface
export interface FileResponse<T = any> {
  operation: FileOperation;
  path: string;
  success: boolean;
  data?: T;
  metadata?: FileMetadata;
  error?: string;
}

// File metadata
export interface FileMetadata {
  size: number;
  lastModified: number;
  created: number;
  isDirectory: boolean;
  isSymlink: boolean;
  permissions?: string;
  encoding?: string;
  mimeType?: string;
  checksum?: string;
}

// File content interface
export interface FileContent {
  path: string;
  content: string | Buffer;
  encoding: string;
  metadata: FileMetadata;
}

// File change event interface
export interface FileChangeEvent {
  type: FileChangeType;
  path: string;
  oldPath?: string; // for rename events
  timestamp: number;
  metadata?: FileMetadata;
}

// Search request interface
export interface SearchRequest {
  query: string;
  workspaceId?: string;
  options?: SearchOptions;
}

// Search options
export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  context?: number; // lines of context around matches
  followSymlinks?: boolean;
}

// Search result interface
export interface SearchResult {
  file: string;
  matches: Array<{
    line: number;
    character: number;
    length: number;
    text: string;
    context?: {
      before: string[];
      after: string[];
    };
  }>;
  totalMatches: number;
}

// Search response interface
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalFiles: number;
  totalMatches: number;
  processingTime: number;
  limitReached?: boolean;
}

// File contract interface - to be implemented by editor adapters
export interface FileContract {
  /**
   * Perform file operation
   */
  performFileOperation(request: FileRequest): Promise<FileResponse>;
  
  /**
   * Read file content
   */
  readFile(path: string, options?: { encoding?: string; workspaceId?: string }): Promise<FileContent>;
  
  /**
   * Write file content
   */
  writeFile(
    path: string, 
    content: string | Buffer, 
    options?: { encoding?: string; workspaceId?: string; backup?: boolean }
  ): Promise<FileResponse>;
  
  /**
   * Check if file exists
   */
  fileExists(path: string, workspaceId?: string): Promise<boolean>;
  
  /**
   * Get file metadata
   */
  getFileMetadata(path: string, workspaceId?: string): Promise<FileMetadata>;
  
  /**
   * List directory contents
   */
  listDirectory(
    path: string, 
    options?: { recursive?: boolean; includeHidden?: boolean; workspaceId?: string }
  ): Promise<FileMetadata[]>;
  
  /**
   * Search files
   */
  searchFiles(request: SearchRequest): Promise<SearchResponse>;
  
  /**
   * Watch file changes
   */
  watchFile(path: string, options?: FileWatchOptions): Promise<string>; // returns watch ID
  
  /**
   * Unwatch file changes
   */
  unwatchFile(watchId: string): Promise<void>;
  
  /**
   * Get supported file operations
   */
  getSupportedOperations(): FileOperation[];
}

// File utilities
export class FileUtils {
  /**
   * Validate file path
   */
  static validatePath(path: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!path) {
      errors.push('Path is required');
    }
    
    if (path && (path.includes('..') || path.includes('\0'))) {
      errors.push('Path contains invalid characters');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get file extension
   */
  static getExtension(path: string): string {
    const lastDot = path.lastIndexOf('.');
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    
    if (lastDot > lastSlash && lastDot > 0) {
      return path.substring(lastDot + 1).toLowerCase();
    }
    
    return '';
  }
  
  /**
   * Get file name without extension
   */
  static getBaseName(path: string): string {
    const fileName = path.split(/[/\\]/).pop() || '';
    const lastDot = fileName.lastIndexOf('.');
    
    if (lastDot > 0) {
      return fileName.substring(0, lastDot);
    }
    
    return fileName;
  }
  
  /**
   * Get directory path
   */
  static getDirectory(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    
    if (lastSlash > 0) {
      return path.substring(0, lastSlash);
    }
    
    return '';
  }
  
  /**
   * Normalize path separators
   */
  static normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }
  
  /**
   * Check if path is absolute
   */
  static isAbsolute(path: string): boolean {
    // Windows: C:\ or \\server
    if (path.match(/^[a-zA-Z]:[/\\]/) || path.startsWith('\\\\')) {
      return true;
    }
    
    // Unix: /
    if (path.startsWith('/')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Join path segments
   */
  static joinPath(...segments: string[]): string {
    return segments
      .filter(segment => segment.length > 0)
      .join('/')
      .replace(/\/+/g, '/');
  }
  
  /**
   * Get relative path
   */
  static getRelativePath(from: string, to: string): string {
    const fromParts = this.normalizePath(from).split('/').filter(p => p);
    const toParts = this.normalizePath(to).split('/').filter(p => p);
    
    let commonLength = 0;
    const minLength = Math.min(fromParts.length, toParts.length);
    
    for (let i = 0; i < minLength; i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }
    
    const upSteps = fromParts.length - commonLength;
    const downSteps = toParts.slice(commonLength);
    
    const upPath = '../'.repeat(upSteps);
    const downPath = downSteps.join('/');
    
    return upPath + downPath || './';
  }
  
  /**
   * Check if file matches pattern
   */
  static matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(path);
  }
  
  /**
   * Get MIME type from file extension
   */
  static getMimeType(path: string): string {
    const ext = this.getExtension(path);
    const mimeTypes: Record<string, string> = {
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'xml': 'text/xml',
      'yaml': 'text/yaml',
      'yml': 'text/yaml',
      'py': 'text/x-python',
      'java': 'text/x-java',
      'cpp': 'text/x-c++',
      'c': 'text/x-c',
      'h': 'text/x-c',
      'php': 'text/x-php',
      'rb': 'text/x-ruby',
      'go': 'text/x-go',
      'rs': 'text/x-rust',
      'sh': 'text/x-shellscript',
      'sql': 'text/x-sql'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
