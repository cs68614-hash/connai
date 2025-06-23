import * as vscode from 'vscode';
import { EventEmitter } from 'events';

// 临时类型定义，直到协议包构建完成
interface CopilotChatRequest {
  prompt: string;
  files?: string[];
  images?: string[];
  context?: {
    pageUrl?: string;
    elementInfo?: {
      tagName: string;
      className?: string;
      id?: string;
      innerText?: string;
    };
    userType?: 'developer' | 'non-developer' | 'designer';
    stage?: 'planning' | 'development' | 'review' | 'debugging';
  };
  streaming?: {
    enabled: boolean;
    chunkSize?: number;
    callbackUrl?: string;
  };
}

interface CopilotChatResponse {
  sessionId: string;
  content: string;
  isStreaming: boolean;
  isComplete: boolean;
  metadata?: {
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    timing?: {
      startTime: number;
      endTime?: number;
      duration?: number;
    };
    referencedFiles?: string[];
  };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    source?: 'web' | 'vscode' | 'system';
    files?: string[];
    tokens?: number;
  };
}

interface CopilotStreamEvent {
  type: 'start' | 'chunk' | 'complete' | 'error';
  sessionId: string;
  data: {
    content?: string;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
    metadata?: CopilotChatResponse['metadata'];
  };
  timestamp: number;
}

export class CopilotChatManager extends EventEmitter {
  private activeSessions = new Map<string, ChatSession>();
  private chatParticipant: vscode.ChatParticipant | null = null;

  constructor() {
    super();
    this.registerChatParticipant();
  }

  private registerChatParticipant() {
    try {
      // Check if Chat API is available
      if (!vscode.chat?.createChatParticipant) {
        console.warn('VS Code Chat API not available. Copilot integration disabled.');
        return;
      }

      this.chatParticipant = vscode.chat.createChatParticipant(
        'connai.webcopilot',
        this.handleChatRequest.bind(this)
      );

      this.chatParticipant.iconPath = new vscode.ThemeIcon('robot');
      // Note: followupProvider may not be available in all VS Code versions
      if ('followupProvider' in this.chatParticipant) {
        (this.chatParticipant as any).followupProvider = this.provideFollowups.bind(this);
      }

      console.log('ConnAI WebCopilot chat participant registered successfully');
    } catch (error) {
      console.error('Failed to register chat participant:', error);
    }
  }

  private async handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    try {
      // Parse the request - it might be a structured request from web
      let parsedRequest: CopilotChatRequest;
      
      try {
        // Try to parse as JSON (from web client)
        parsedRequest = JSON.parse(request.prompt);
      } catch {
        // Fallback to plain text request
        parsedRequest = {
          prompt: request.prompt,
          context: {
            userType: 'developer',
            stage: 'development'
          }
        };
      }

      const sessionId = this.generateSessionId();
      const session = new ChatSession(sessionId, parsedRequest);
      this.activeSessions.set(sessionId, session);

      // Emit start event for web client
      this.emitStreamEvent({
        type: 'start',
        sessionId,
        data: {},
        timestamp: Date.now()
      });

      stream.progress('Analyzing your request...');

      // Add context information to the stream
      if (parsedRequest.context?.pageUrl) {
        stream.markdown(`**Page Context:** ${parsedRequest.context.pageUrl}\n\n`);
      }

      if (parsedRequest.context?.userType) {
        stream.markdown(`**Optimizing response for:** ${parsedRequest.context.userType}\n\n`);
      }

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(parsedRequest);

      // Add file references if provided
      if (parsedRequest.files && parsedRequest.files.length > 0) {
        stream.progress('Including file context...');
        for (const filePath of parsedRequest.files) {
          try {
            const fileUri = vscode.Uri.file(filePath);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const content = Buffer.from(fileContent).toString('utf8');
            
            stream.reference(fileUri);
            // Add file content to context for better responses
            session.addFileContext(filePath, content);
          } catch (error) {
            console.warn(`Failed to read file ${filePath}:`, error);
          }
        }
      }

      stream.progress('Generating response...');

      // Use VS Code's language model API if available
      if (vscode.lm && typeof vscode.lm.selectChatModels === 'function') {
        await this.handleWithLanguageModel(enhancedPrompt, stream, session, token);
      } else {
        // Fallback to traditional copilot commands
        await this.handleWithCopilotCommands(enhancedPrompt, stream, session);
      }

      // Emit completion event
      this.emitStreamEvent({
        type: 'complete',
        sessionId,
        data: {
          metadata: {
            tokenUsage: session.getTokenUsage(),
            timing: session.getTiming(),
            referencedFiles: parsedRequest.files
          }
        },
        timestamp: Date.now()
      });

      return {
        metadata: {
          command: 'webcopilot',
          sessionId: sessionId
        }
      };

    } catch (error: any) {
      console.error('Chat request failed:', error);
      
      stream.markdown(`**Error:** ${error?.message || 'Unknown error'}`);
      
      // Emit error event
      this.emitStreamEvent({
        type: 'error',
        sessionId: 'unknown',
        data: {
          error: {
            code: 'CHAT_ERROR',
            message: error?.message || 'Unknown error'
          }
        },
        timestamp: Date.now()
      });

      throw error;
    }
  }

  private async handleWithLanguageModel(
    prompt: string,
    stream: vscode.ChatResponseStream,
    session: ChatSession,
    token: vscode.CancellationToken
  ) {
    try {
      // 尝试多种模型选择策略
      let models: readonly vscode.LanguageModelChat[] = [];
      
      // 策略1: 尝试 GitHub 模型
      try {
        models = await vscode.lm.selectChatModels({
          vendor: 'github'
        });
      } catch (error) {
        console.warn('Failed to select GitHub models:', error);
      }

      // 策略2: 如果没有 GitHub 模型，尝试任何可用的模型
      if (models.length === 0) {
        try {
          models = await vscode.lm.selectChatModels();
        } catch (error) {
          console.warn('Failed to select any models:', error);
        }
      }

      // 策略3: 如果仍然没有模型，使用兜底响应
      if (models.length === 0) {
        console.warn('No language models available, using fallback response');
        const fallbackResponse = this.generateFallbackResponse(prompt);
        stream.markdown(fallbackResponse);
        session.addMessage('assistant', fallbackResponse);
        
        this.emitStreamEvent({
          type: 'chunk',
          sessionId: session.id,
          data: { content: fallbackResponse },
          timestamp: Date.now()
        });
        return;
      }

      const model = models[0];
      console.log(`Using language model: ${model.vendor}/${model.family} (${model.name})`);

      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      const response = await model.sendRequest(messages, {}, token);

      let fullContent = '';
      for await (const chunk of response.text) {
        if (token.isCancellationRequested) {
          break;
        }

        fullContent += chunk;
        stream.markdown(chunk);
        
        // Emit streaming chunk
        this.emitStreamEvent({
          type: 'chunk',
          sessionId: session.id,
          data: { content: chunk },
          timestamp: Date.now()
        });
      }

      session.addMessage('assistant', fullContent);

    } catch (error) {
      console.error('Language model request failed:', error);
      
      // 使用兜底响应而不是抛出错误
      const fallbackResponse = this.generateFallbackResponse(prompt);
      stream.markdown(`*Note: Using fallback response due to language model error*\n\n${fallbackResponse}`);
      session.addMessage('assistant', fallbackResponse);
      
      this.emitStreamEvent({
        type: 'chunk',
        sessionId: session.id,
        data: { content: fallbackResponse },
        timestamp: Date.now()
      });
    }
  }

  private generateFallbackResponse(prompt: string): string {
    // 生成一个有用的兜底响应
    const responses = {
      javascript: `// 这是一个 JavaScript 示例响应
function example() {
    // 根据您的问题："${prompt}"
    // 我建议您查看以下资源：
    // 1. MDN Web Docs: https://developer.mozilla.org
    // 2. VS Code 文档: https://code.visualstudio.com/docs
    
    console.log("请确保 GitHub Copilot 扩展已正确安装和配置");
}`,
      
      general: `我理解您想要了解："${prompt}"

由于当前无法访问 GitHub Copilot 的语言模型，我提供一些通用建议：

1. **确保 GitHub Copilot 已安装**：
   - 检查 VS Code 扩展面板中是否安装了 "GitHub Copilot" 和 "GitHub Copilot Chat"
   - 确保您已登录 GitHub 账户并有有效的 Copilot 订阅

2. **重启扩展**：
   - 尝试重新加载 VS Code 窗口 (Cmd+R / Ctrl+R)
   - 或者重启 VS Code

3. **检查网络连接**：
   - 确保网络连接正常，可以访问 GitHub 服务

如果问题持续存在，请查看 VS Code 的输出面板获取更多调试信息。`
    };

    // 简单的关键词检测
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('javascript') || lowerPrompt.includes('js') || lowerPrompt.includes('function')) {
      return responses.javascript;
    }
    
    return responses.general;
  }

  private async handleWithCopilotCommands(
    prompt: string,
    stream: vscode.ChatResponseStream,
    session: ChatSession
  ) {
    // Fallback method using traditional VS Code commands
    stream.markdown('Using fallback Copilot integration...\n\n');
    
    try {
      // Try to get active editor content for context
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const selection = activeEditor.selection;
        const selectedText = activeEditor.document.getText(selection);
        
        if (selectedText) {
          stream.markdown(`**Selected Code:**\n\`\`\`${activeEditor.document.languageId}\n${selectedText}\n\`\`\`\n\n`);
        }
      }

      // Create a response using available context
      const response = `I understand you want help with: "${prompt}"\n\n` +
        `Based on your current context, here are some suggestions:\n\n` +
        `1. **Code Review**: I can help review and improve your code\n` +
        `2. **Documentation**: I can help document your functions and classes\n` +
        `3. **Debugging**: I can help identify potential issues\n` +
        `4. **Optimization**: I can suggest performance improvements\n\n` +
        `Please provide more specific code or describe what you'd like me to help with.`;

      // Stream the response
      for (const char of response) {
        stream.markdown(char);
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate streaming
        
        this.emitStreamEvent({
          type: 'chunk',
          sessionId: session.id,
          data: { content: char },
          timestamp: Date.now()
        });
      }

      session.addMessage('assistant', response);

    } catch (error) {
      console.error('Fallback copilot failed:', error);
      throw error;
    }
  }

  private buildEnhancedPrompt(request: CopilotChatRequest): string {
    let prompt = request.prompt;

    // Add context-aware instructions
    if (request.context?.userType === 'non-developer') {
      prompt = `Please explain in simple, non-technical terms. Avoid jargon and provide clear, step-by-step explanations.\n\n${prompt}`;
    } else if (request.context?.userType === 'designer') {
      prompt = `Focus on UI/UX aspects, visual design, and user experience considerations.\n\n${prompt}`;
    }

    // Add stage-specific context
    if (request.context?.stage === 'debugging') {
      prompt = `Help debug this issue. Look for common problems, suggest fixes, and explain the root cause.\n\n${prompt}`;
    } else if (request.context?.stage === 'review') {
      prompt = `Please review this code for best practices, potential issues, and improvements.\n\n${prompt}`;
    }

    // Add page context if available
    if (request.context?.pageUrl) {
      prompt += `\n\nPage context: ${request.context.pageUrl}`;
    }

    if (request.context?.elementInfo) {
      const element = request.context.elementInfo;
      prompt += `\n\nElement context: ${element.tagName}`;
      if (element.className) {
        prompt += ` (class: ${element.className})`;
      }
      if (element.id) {
        prompt += ` (id: ${element.id})`;
      }
    }

    return prompt;
  }

  private provideFollowups(
    result: vscode.ChatResult,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.ChatFollowup[]> {
    return [
      {
        prompt: 'Can you explain this in simpler terms?',
        label: '🔍 Simplify explanation'
      },
      {
        prompt: 'Show me the code implementation',
        label: '💻 Show code'
      },
      {
        prompt: 'What are the potential issues with this approach?',
        label: '⚠️ Identify issues'
      },
      {
        prompt: 'How can I test this?',
        label: '🧪 Testing suggestions'
      }
    ];
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitStreamEvent(event: CopilotStreamEvent) {
    this.emit('streamEvent', event);
  }

  // Public API methods
  public async startChatSession(request: CopilotChatRequest): Promise<string> {
    if (!this.chatParticipant) {
      throw new Error('Chat participant not available');
    }

    const sessionId = this.generateSessionId();
    const session = new ChatSession(sessionId, request);
    this.activeSessions.set(sessionId, session);

    // 立即开始处理聊天请求
    this.processChatRequest(sessionId, request);

    return sessionId;
  }

  private async processChatRequest(sessionId: string, request: CopilotChatRequest): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // 检查 Copilot 扩展状态
      const copilotStatus = this.checkCopilotStatus();
      
      // Emit start event for web client
      this.emitStreamEvent({
        type: 'start',
        sessionId,
        data: {
          content: `Copilot Status: ${JSON.stringify(copilotStatus, null, 2)}`
        },
        timestamp: Date.now()
      });

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(request);

      // Create a mock stream for handling the response
      const mockStream = {
        markdown: (text: string) => {
          this.emitStreamEvent({
            type: 'chunk',
            sessionId,
            data: { content: text },
            timestamp: Date.now()
          });
          session.addMessage('assistant', text);
        },
        progress: (text: string) => {
          this.emitStreamEvent({
            type: 'chunk', 
            sessionId,
            data: { content: `*${text}*` },
            timestamp: Date.now()
          });
        },
        reference: (uri: vscode.Uri) => {
          // Handle file references
        }
      };

      // Use VS Code's language model API if available
      if (vscode.lm && typeof vscode.lm.selectChatModels === 'function') {
        // Create a cancellation token source
        const tokenSource = new vscode.CancellationTokenSource();
        await this.handleWithLanguageModel(enhancedPrompt, mockStream as any, session, tokenSource.token);
      } else {
        // Fallback to basic response
        const response = `我理解您想要了解: "${request.prompt}"\n\n**当前状态**: ConnAI 正在尝试连接到 AI 助手...\n\n**可能的解决方案**:\n1. 确保 GitHub Copilot 扩展已安装并激活\n2. 检查 GitHub Copilot 订阅状态\n3. 重新加载 VS Code 窗口\n4. 检查网络连接\n\n如果问题持续存在，请查看 VS Code 输出面板获取更多信息。`;
        
        mockStream.markdown(response);
      }

      // Emit completion event
      this.emitStreamEvent({
        type: 'complete',
        sessionId,
        data: {
          metadata: {
            tokenUsage: session.getTokenUsage(),
            timing: session.getTiming(),
            referencedFiles: request.files
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      // Emit error event
      this.emitStreamEvent({
        type: 'error',
        sessionId,
        data: {
          error: {
            code: 'CHAT_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error
          }
        },
        timestamp: Date.now()
      });
    }
  }

  public async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.addMessage('user', message);
  }

  public async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
  }

  public getChatHistory(sessionId: string): ChatMessage[] {
    const session = this.activeSessions.get(sessionId);
    return session ? session.getMessages() : [];
  }

  public dispose() {
    if (this.chatParticipant) {
      this.chatParticipant.dispose();
    }
    this.activeSessions.clear();
  }

  /**
   * 检查 GitHub Copilot 扩展状态
   */
  private checkCopilotStatus(): { installed: boolean; active: boolean; chatAvailable: boolean } {
    const copilotExtension = vscode.extensions.getExtension('github.copilot');
    const copilotChatExtension = vscode.extensions.getExtension('github.copilot-chat');
    
    return {
      installed: !!(copilotExtension && copilotChatExtension),
      active: !!(copilotExtension?.isActive && copilotChatExtension?.isActive),
      chatAvailable: !!(vscode.lm && typeof vscode.lm.selectChatModels === 'function')
    };
  }
}

class ChatSession {
  private messages: ChatMessage[] = [];
  private startTime: number;
  private tokenCount = 0;

  constructor(
    public readonly id: string,
    public readonly initialRequest: CopilotChatRequest
  ) {
    this.startTime = Date.now();
    this.addMessage('user', initialRequest.prompt);
  }

  addMessage(type: 'user' | 'assistant' | 'system', content: string) {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      content,
      timestamp: Date.now(),
      metadata: {
        source: type === 'user' ? 'web' : 'vscode',
        tokens: this.estimateTokenCount(content)
      }
    };

    this.messages.push(message);
    this.tokenCount += message.metadata?.tokens || 0;
  }

  addFileContext(filePath: string, content: string) {
    // Add file content as system message for context
    this.addMessage('system', `File: ${filePath}\n\`\`\`\n${content}\n\`\`\``);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getTokenUsage() {
    return {
      prompt: Math.floor(this.tokenCount * 0.7), // Estimate
      completion: Math.floor(this.tokenCount * 0.3), // Estimate
      total: this.tokenCount
    };
  }

  getTiming() {
    const now = Date.now();
    return {
      startTime: this.startTime,
      endTime: now,
      duration: now - this.startTime
    };
  }

  private estimateTokenCount(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }
}
