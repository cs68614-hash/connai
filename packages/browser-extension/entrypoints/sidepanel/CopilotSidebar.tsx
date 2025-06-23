import React, { useState, useEffect, useRef } from 'react';

// Chrome 扩展 API 类型声明
declare const chrome: any;

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  serverUrl: string;
  error?: string;
}

export default function CopilotSidebar() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    serverUrl: ''
  });
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    checkConnection();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkConnection = async () => {
    try {
      // 获取存储的服务器配置
      const result = await chrome.storage.local.get(['serverUrl', 'isConnected']);
      const serverUrl = result.serverUrl || 'http://localhost:6797';
      
      const response = await fetch(`${serverUrl}/health`);
      if (response.ok) {
        setConnectionStatus({
          connected: true,
          serverUrl
        });
      } else {
        throw new Error('Server not responding');
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        serverUrl: 'http://localhost:6797',
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  };

  const startCopilotChat = async (prompt: string) => {
    if (!connectionStatus.connected) {
      addSystemMessage('❌ Not connected to VS Code. Please check your connection.');
      return;
    }

    setIsLoading(true);
    
    try {
      // 获取当前页面上下文
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      const chatRequest = {
        prompt,
        context: {
          pageUrl: currentTab?.url,
          userType: 'developer',
          stage: 'development'
        },
        streaming: {
          enabled: true
        }
      };

      // 发送聊天请求
      const response = await fetch(`${connectionStatus.serverUrl}/api/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatRequest)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      const sessionId = result.sessionId;
      setCurrentSession(sessionId);

      // 添加用户消息
      addUserMessage(prompt);

      // 开始监听流式响应
      startStreamListening(sessionId);

    } catch (error) {
      console.error('Failed to start chat:', error);
      addSystemMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startStreamListening = (sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const streamUrl = `${connectionStatus.serverUrl}/api/copilot/stream?sessionId=${sessionId}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    let currentAssistantMessage: Message | null = null;

    eventSource.onopen = () => {
      console.log('Stream connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            addSystemMessage('🤖 Connected to Copilot');
            break;
            
          case 'start':
            // 创建新的助手消息
            currentAssistantMessage = {
              id: `msg_${Date.now()}`,
              type: 'assistant',
              content: '',
              timestamp: Date.now(),
              isStreaming: true
            };
            setMessages(prev => [...prev, currentAssistantMessage!]);
            break;
            
          case 'chunk':
            // 更新流式内容
            if (currentAssistantMessage && data.data.content) {
              currentAssistantMessage.content += data.data.content;
              setMessages(prev => prev.map(msg => 
                msg.id === currentAssistantMessage!.id 
                  ? { ...currentAssistantMessage! }
                  : msg
              ));
            }
            break;
            
          case 'complete':
            // 完成流式传输
            if (currentAssistantMessage) {
              currentAssistantMessage.isStreaming = false;
              setMessages(prev => prev.map(msg => 
                msg.id === currentAssistantMessage!.id 
                  ? { ...currentAssistantMessage! }
                  : msg
              ));
            }
            eventSource.close();
            break;
            
          case 'error':
            addSystemMessage(`❌ Error: ${data.data.error || 'Unknown error'}`);
            eventSource.close();
            break;
        }
      } catch (error) {
        console.error('Failed to parse stream data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Stream error:', error);
      addSystemMessage('❌ Stream connection lost');
      eventSource.close();
    };
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, message]);
  };

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: `msg_${Date.now()}`,
      type: 'system',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading) return;
    
    const input = currentInput.trim();
    setCurrentInput('');
    startCopilotChat(input);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSession(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    
    return (
      <div
        key={message.id}
        className={`message ${isUser ? 'user' : isSystem ? 'system' : 'assistant'}`}
      >
        <div className="message-header">
          <span className="message-sender">
            {isUser ? '👤 You' : isSystem ? '🔧 System' : '🤖 Copilot'}
          </span>
          <span className="message-time">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        <div className="message-content">
          {message.isStreaming && (
            <span className="streaming-indicator">●</span>
          )}
          <div 
            className="message-text"
            dangerouslySetInnerHTML={{ 
              __html: formatMessageContent(message.content) 
            }}
          />
        </div>
      </div>
    );
  };

  const formatMessageContent = (content: string) => {
    // 简单的 Markdown 渲染
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="copilot-sidebar">
      <div className="sidebar-header">
        <div className="header-title">
          <h2>🤖 ConnAI Copilot</h2>
          <div className={`connection-status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
            {connectionStatus.connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
        <div className="header-actions">
          <button onClick={checkConnection} className="btn-secondary" title="Check Connection">
            🔄
          </button>
          <button onClick={clearChat} className="btn-secondary" title="Clear Chat">
            🗑️
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-content">
              <h3>👋 Welcome to ConnAI Copilot!</h3>
              <p>Ask me anything about your code, get explanations, or request help with development tasks.</p>
              <div className="example-prompts">
                <p><strong>Try asking:</strong></p>
                <ul>
                  <li>"Explain this function"</li>
                  <li>"How can I optimize this code?"</li>
                  <li>"Help me debug this issue"</li>
                  <li>"Write unit tests for this component"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <form onSubmit={handleSubmit} className="chat-form">
          <div className="input-group">
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder={
                connectionStatus.connected 
                  ? "Ask Copilot anything..." 
                  : "Connect to VS Code first..."
              }
              disabled={!connectionStatus.connected || isLoading}
              className="chat-input"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!connectionStatus.connected || isLoading || !currentInput.trim()}
              className="send-button"
              title="Send message (Enter)"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        </form>
        
        {!connectionStatus.connected && (
          <div className="connection-help">
            <p>💡 Make sure VS Code with ConnAI extension is running</p>
          </div>
        )}
      </div>
    </div>
  );
}
