/**
 * Copilot integration contract for ConnAI protocol
 */

export interface CopilotContract {
  /**
   * Start a streaming chat session with Copilot
   */
  startCopilotChat(request: CopilotChatRequest): Promise<string>; // Returns session ID
  
  /**
   * Send a message to an existing chat session
   */
  sendChatMessage(sessionId: string, message: string): Promise<void>;
  
  /**
   * End a chat session
   */
  endChatSession(sessionId: string): Promise<void>;
  
  /**
   * Get chat history for a session
   */
  getChatHistory(sessionId: string): Promise<ChatMessage[]>;
}

export interface CopilotChatRequest {
  /** The main prompt/question */
  prompt: string;
  
  /** Optional files to include as context */
  files?: string[];
  
  /** Optional images to include */
  images?: string[];
  
  /** Page context information */
  context?: {
    /** Current page URL */
    pageUrl?: string;
    
    /** DOM element information */
    elementInfo?: {
      tagName: string;
      className?: string;
      id?: string;
      innerText?: string;
    };
    
    /** User type for response customization */
    userType?: 'developer' | 'non-developer' | 'designer';
    
    /** Development stage */
    stage?: 'planning' | 'development' | 'review' | 'debugging';
  };
  
  /** Stream configuration */
  streaming?: {
    /** Enable streaming response */
    enabled: boolean;
    
    /** Chunk size for streaming */
    chunkSize?: number;
    
    /** Callback URL for stream events */
    callbackUrl?: string;
  };
}

export interface CopilotChatResponse {
  /** Unique session ID */
  sessionId: string;
  
  /** Response content (full or partial for streaming) */
  content: string;
  
  /** Whether this is a streaming chunk */
  isStreaming: boolean;
  
  /** Whether this is the final chunk */
  isComplete: boolean;
  
  /** Response metadata */
  metadata?: {
    /** Token usage information */
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    
    /** Response timing */
    timing?: {
      startTime: number;
      endTime?: number;
      duration?: number;
    };
    
    /** Referenced files */
    referencedFiles?: string[];
    
    /** Suggested actions */
    suggestedActions?: SuggestedAction[];
  };
}

export interface ChatMessage {
  /** Message ID */
  id: string;
  
  /** Message type */
  type: 'user' | 'assistant' | 'system';
  
  /** Message content */
  content: string;
  
  /** Timestamp */
  timestamp: number;
  
  /** Optional metadata */
  metadata?: {
    /** Source of the message */
    source?: 'web' | 'vscode' | 'system';
    
    /** Associated files */
    files?: string[];
    
    /** Token count */
    tokens?: number;
  };
}

export interface SuggestedAction {
  /** Action ID */
  id: string;
  
  /** Action label */
  label: string;
  
  /** Action description */
  description?: string;
  
  /** Action type */
  type: 'command' | 'file_edit' | 'create_file' | 'external_link';
  
  /** Action payload */
  payload: {
    /** VS Code command to execute */
    command?: string;
    
    /** Arguments for the command */
    args?: any[];
    
    /** File path for file operations */
    filePath?: string;
    
    /** Content for file creation/editing */
    content?: string;
    
    /** External URL */
    url?: string;
  };
}

/**
 * Streaming event types for real-time communication
 */
export interface CopilotStreamEvent {
  /** Event type */
  type: 'start' | 'chunk' | 'complete' | 'error';
  
  /** Session ID */
  sessionId: string;
  
  /** Event data */
  data: {
    /** Content chunk (for chunk events) */
    content?: string;
    
    /** Error information (for error events) */
    error?: {
      code: string;
      message: string;
      details?: any;
    };
    
    /** Completion metadata (for complete events) */
    metadata?: CopilotChatResponse['metadata'];
  };
  
  /** Event timestamp */
  timestamp: number;
}

/**
 * Configuration for Copilot integration
 */
export interface CopilotConfig {
  /** Whether Copilot is available */
  available: boolean;
  
  /** Copilot version */
  version?: string;
  
  /** Supported features */
  features: {
    chat: boolean;
    inlineCompletion: boolean;
    codeGeneration: boolean;
    explanation: boolean;
  };
  
  /** Rate limiting information */
  rateLimits?: {
    /** Requests per minute */
    requestsPerMinute: number;
    
    /** Current usage */
    currentUsage: number;
    
    /** Reset time */
    resetTime: number;
  };
}
