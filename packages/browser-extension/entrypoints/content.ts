// Content Script for ConnAI Browser Extension
import { browser } from 'wxt/browser';
import type { BrowserToVSCodeMessage, VSCodeToBrowserMessage, MessageResponse } from '../src/types/messages';

// 定义上下文菜单项的类型
interface MenuAction {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  contextType?: string;
}

// 菜单项配置 - 对应截图中的功能
const menuActions: MenuAction[] = [
  {
    id: 'focused-file',
    label: '📄 Focused File',
    description: '获取当前聚焦的文件内容',
    shortcut: 'Ctrl+F',
    contextType: 'focused-file'
  },
  {
    id: 'selected-text',
    label: '🎯 Selected Text / Cursor',
    description: '获取选中文本或光标位置',
    shortcut: 'Ctrl+S',
    contextType: 'selected-text'
  },
  {
    id: 'all-open-tabs',
    label: '📑 All Open Tabs',
    description: '获取所有打开的标签页',
    shortcut: 'Ctrl+T',
    contextType: 'all-open-tabs'
  },
  {
    id: 'problems',
    label: '⚠️ Problems',
    description: '获取当前问题和错误',
    contextType: 'problems'
  },
  {
    id: 'user-rules',
    label: '⚖️ User Rules for AI',
    description: '获取用户AI规则设置',
    contextType: 'user-rules'
  },
  {
    id: 'file-tree',
    label: '🌲 File Tree',
    description: '获取文件树结构',
    contextType: 'file-tree'
  },
  {
    id: 'full-codebase',
    label: '📚 Full Codebase',
    description: '获取完整代码库',
    contextType: 'full-codebase'
  }
];

export default {
  matches: ['<all_urls>'],
  main() {
    console.log('ConnAI Content Script loaded');
    
    let menuContainer: HTMLElement | null = null;
    let currentInputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
    let currentMenuTriggerPosition = 0;
    let isConnectedToVSCode = false;

    /**
     * Send message to background script
     */
    const sendMessageToBackground = async (message: BrowserToVSCodeMessage): Promise<MessageResponse> => {
      try {
        const response = await browser.runtime.sendMessage(message);
        return response as MessageResponse;
      } catch (error) {
        console.error('ConnAI Content: Failed to send message to background:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Communication error',
          timestamp: Date.now()
        };
      }
    };

    /**
     * Generate unique message ID
     */
    const generateMessageId = (): string => {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    // 创建菜单 DOM 元素
    function createMenu(): HTMLElement {
      const menu = document.createElement('div');
      menu.id = 'connai-context-menu';
      menu.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        min-width: 250px;
        max-height: 300px;
        overflow-y: auto;
        display: none;
      `;

      menuActions.forEach((action, index) => {
        const item = document.createElement('div');
        item.className = 'connai-menu-item';
        item.dataset.actionId = action.id;
        item.style.cssText = `
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s;
        `;
        
        if (index === menuActions.length - 1) {
          item.style.borderBottom = 'none';
        }

        const content = document.createElement('div');
        content.innerHTML = `
          <div style="font-weight: 500; color: #333;">${action.label}</div>
          <div style="font-size: 12px; color: #666; margin-top: 2px;">${action.description}</div>
        `;

        if (action.shortcut) {
          const shortcut = document.createElement('div');
          shortcut.textContent = action.shortcut;
          shortcut.style.cssText = `
            font-size: 11px;
            color: #999;
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
          `;
          item.appendChild(content);
          item.appendChild(shortcut);
        } else {
          item.appendChild(content);
        }

        // 鼠标悬停效果
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = '#f8f9fa';
        });
        
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = 'transparent';
        });

        // 点击事件
        item.addEventListener('click', () => {
          handleMenuAction(action.id);
          hideMenu();
        });

        menu.appendChild(item);
      });

      return menu;
    }

    // 显示菜单
    function showMenu(x: number, y: number) {
      if (!menuContainer) {
        menuContainer = createMenu();
        document.body.appendChild(menuContainer);
      }

      menuContainer.style.left = `${x}px`;
      menuContainer.style.top = `${y}px`;
      menuContainer.style.display = 'block';

      // 确保菜单在视口内
      const rect = menuContainer.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuContainer.style.left = `${viewportWidth - rect.width - 10}px`;
      }

      if (rect.bottom > viewportHeight) {
        menuContainer.style.top = `${y - rect.height - 5}px`;
      }
    }

    // 隐藏菜单
    function hideMenu() {
      if (menuContainer) {
        menuContainer.style.display = 'none';
      }
    }

    // 处理菜单动作
    async function handleMenuAction(actionId: string) {
      if (!currentInputElement) return;

      const action = menuActions.find(a => a.id === actionId);
      if (!action) return;

      // 检查是否连接到VS Code，并尝试自动连接
      if (!isConnectedToVSCode) {
        console.log('ConnAI: Not connected, attempting auto-connect...');
        insertLoadingMessage('Connecting to VS Code');
        
        try {
          // 首先尝试触发背景脚本的自动连接
          const connectResponse = await sendMessageToBackground({
            id: generateMessageId(),
            type: 'Connect',
            timestamp: Date.now(),
            payload: { force: false }
          });

          if (!connectResponse.success) {
            console.warn('ConnAI: Initial connect failed, trying force connect...');
            
            // 如果失败，尝试强制连接
            const forceConnectResponse = await sendMessageToBackground({
              id: generateMessageId(),
              type: 'Connect',
              timestamp: Date.now(),
              payload: { force: true }
            });

            if (!forceConnectResponse.success) {
              console.error('ConnAI: All connection attempts failed:', forceConnectResponse.error);
              insertErrorMessage(`❌ Cannot connect to VS Code. Please ensure:\n1. VS Code is running\n2. ConnAI extension is installed and active\n3. Check if port is accessible (usually 6797 or 8080)`);
              return;
            }
          }

          isConnectedToVSCode = true;
          console.log('ConnAI: Auto-connect successful');
          
          // 短暂延迟以确保连接稳定
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error('ConnAI: Connection error:', error);
          insertErrorMessage(`❌ Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
      }

      // 插入加载状态
      insertLoadingMessage(action.label);

      // 发送上下文请求到VS Code
      if (action.contextType) {
        try {
          const contextResponse = await sendMessageToBackground({
            id: generateMessageId(),
            type: 'GetContext',
            timestamp: Date.now(),
            payload: {
              contextType: action.contextType as any,
              options: {},
              workspaceId: undefined
            }
          });

          if (contextResponse.success) {
            console.log(`ConnAI: Context request sent for ${action.contextType}`);
            // 实际的上下文数据会通过VS Code消息异步返回
            insertPendingMessage(action.label);
          } else {
            console.error('ConnAI: Failed to request context:', contextResponse.error);
            insertErrorMessage(`❌ Failed to get ${action.label}: ${contextResponse.error}`);
          }
        } catch (error) {
          console.error('ConnAI: Context request error:', error);
          insertErrorMessage(`❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // 对于不需要VS Code数据的操作，直接插入占位符
        insertPlaceholderText(action.label);
      }
    }

    // 插入加载消息
    function insertLoadingMessage(actionLabel: string) {
      insertTextAtCursor(`⏳ Loading ${actionLabel}...`);
    }

    // 插入待处理消息
    function insertPendingMessage(actionLabel: string) {
      insertTextAtCursor(`🔄 Waiting for ${actionLabel} data...`);
    }

    // 插入错误消息
    function insertErrorMessage(message: string) {
      insertTextAtCursor(message);
    }

    // 插入占位符文本
    function insertPlaceholderText(actionLabel: string) {
      insertTextAtCursor(`[${actionLabel}] `);
    }

    // 在光标位置插入文本
    function insertTextAtCursor(text: string) {
      if (!currentInputElement) return;

      // 获取当前光标位置
      const cursorPosition = currentInputElement.selectionStart || 0;
      const currentValue = currentInputElement.value;
      
      // 移除触发的 # 符号
      const beforeTrigger = currentValue.substring(0, currentMenuTriggerPosition);
      const afterTrigger = currentValue.substring(currentMenuTriggerPosition + 1);
      
      // 插入文本
      const newValue = beforeTrigger + text + afterTrigger;
      
      currentInputElement.value = newValue;
      
      // 设置光标位置到插入文本之后
      const newCursorPosition = currentMenuTriggerPosition + text.length;
      currentInputElement.setSelectionRange(newCursorPosition, newCursorPosition);
      
      // 触发 input 事件，通知其他脚本值已更改
      const inputEvent = new Event('input', { bubbles: true });
      currentInputElement.dispatchEvent(inputEvent);
    }

    // 检查元素是否为输入框
    function isInputElement(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'textarea') return true;
      if (tagName === 'input') {
        const type = (element as HTMLInputElement).type.toLowerCase();
        return ['text', 'search', 'url', 'email'].includes(type);
      }
      return element.getAttribute('contenteditable') === 'true';
    }

    // 绑定输入框事件
    function attachInputEvents(element: HTMLInputElement | HTMLTextAreaElement) {
      if (element.dataset.connaiAttached === 'true') {
        return; // 已经绑定过事件
      }

      element.dataset.connaiAttached = 'true';
      console.log('ConnAI: Attached events to input element', element);

      // 键盘事件处理
      element.addEventListener('keydown', (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'Escape') {
          hideMenu();
        }
      });

      // 输入事件处理
      element.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        const value = target.value;
        const cursorPosition = target.selectionStart || 0;
        
        // 检查是否输入了 # 符号
        if (value[cursorPosition - 1] === '#') {
          currentInputElement = target;
          currentMenuTriggerPosition = cursorPosition - 1;
          
          // 计算菜单显示位置
          const rect = target.getBoundingClientRect();
          const x = rect.left + 10;
          const y = rect.bottom + 5;
          
          showMenu(x, y);
        } else {
          hideMenu();
        }
      });

      // 失去焦点时隐藏菜单
      element.addEventListener('blur', () => {
        // 延迟隐藏，允许用户点击菜单
        setTimeout(() => {
          hideMenu();
        }, 200);
      });
    }

    // 查找并绑定输入框
    function findAndAttachInputs() {
      const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
      inputs.forEach(input => {
        if (isInputElement(input) && input.dataset.connaiAttached !== 'true') {
          attachInputEvents(input);
        }
      });
    }

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (isInputElement(element)) {
                shouldCheck = true;
              } else if (element.querySelector && element.querySelector('input, textarea, [contenteditable="true"]')) {
                shouldCheck = true;
              }
            }
          });
        }
      });
      
      if (shouldCheck) {
        findAndAttachInputs();
      }
    });

    // 开始观察
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 初始化：查找现有的输入框
    findAndAttachInputs();

    // 点击其他地方时隐藏菜单
    document.addEventListener('click', (event) => {
      if (menuContainer && !menuContainer.contains(event.target as Node)) {
        hideMenu();
      }
    });

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      if (menuContainer && menuContainer.parentNode) {
        menuContainer.parentNode.removeChild(menuContainer);
      }
    });

    // 监听来自VS Code的消息
    browser.runtime.onMessage.addListener((message: VSCodeToBrowserMessage) => {
      handleVSCodeMessage(message);
    });

    /**
     * Handle messages from VS Code server via background script
     */
    function handleVSCodeMessage(message: VSCodeToBrowserMessage) {
      console.log('ConnAI Content: Received message from VS Code:', message.type);

      try {
        switch (message.type) {
          case 'ContextResponse':
            handleContextResponse(message);
            break;

          case 'UpdatedFile':
            handleUpdatedFile(message);
            break;

          case 'SentFileTree':
            handleSentFileTree(message);
            break;

          case 'ConnectionStatus':
            handleConnectionStatus(message);
            break;

          default:
            console.warn('ConnAI Content: Unknown VS Code message type:', (message as any).type);
        }
      } catch (error) {
        console.error('ConnAI Content: Error handling VS Code message:', error);
      }
    }

    /**
     * Handle context response from VS Code
     */
    function handleContextResponse(message: VSCodeToBrowserMessage & { type: 'ContextResponse' }) {
      if (!currentInputElement) return;

      const { contextType, data, metadata, error } = message.payload;
      
      if (error) {
        console.error('ConnAI: Context response error:', error);
        replaceLastMessage(`❌ Error getting ${contextType}: ${error}`);
        return;
      }

      // 格式化上下文数据
      let formattedData = '';
      try {
        if (contextType === 'focused-file') {
          formattedData = `📄 Current file: ${data.fileName}\n\`\`\`${data.language}\n${data.content}\n\`\`\``;
        } else if (contextType === 'selected-text') {
          formattedData = `🎯 Selected: "${data.text}" (line ${data.line})`;
        } else if (contextType === 'file-tree') {
          formattedData = `🌲 Project structure:\n${formatFileTree(data)}`;
        } else if (contextType === 'problems') {
          formattedData = `⚠️ Problems (${data.length}):\n${data.map((p: any) => `- ${p.message} (${p.file}:${p.line})`).join('\n')}`;
        } else {
          // 通用格式化
          formattedData = `${getContextIcon(contextType)} ${contextType}:\n${JSON.stringify(data, null, 2)}`;
        }

        // 添加token信息
        if (metadata.tokenCount) {
          formattedData += `\n💡 ${metadata.tokenCount} tokens`;
        }

        replaceLastMessage(formattedData);
        
      } catch (formatError) {
        console.error('ConnAI: Error formatting context data:', formatError);
        replaceLastMessage(`📋 ${contextType} data received (${metadata.tokenCount} tokens)`);
      }
    }

    /**
     * Handle file update from VS Code
     */
    function handleUpdatedFile(message: VSCodeToBrowserMessage & { type: 'UpdatedFile' }) {
      console.log('ConnAI: File updated:', message.payload.filePath);
      // 可以在这里添加文件更新通知的UI
    }

    /**
     * Handle file tree from VS Code
     */
    function handleSentFileTree(message: VSCodeToBrowserMessage & { type: 'SentFileTree' }) {
      console.log('ConnAI: File tree received:', message.payload.tree.length, 'items');
      // 文件树数据已通过ContextResponse处理
    }

    /**
     * Handle connection status change
     */
    function handleConnectionStatus(message: VSCodeToBrowserMessage & { type: 'ConnectionStatus' }) {
      isConnectedToVSCode = message.payload.connected;
      console.log('ConnAI: Connection status updated:', isConnectedToVSCode);
      
      if (!isConnectedToVSCode && message.payload.error) {
        console.error('ConnAI: Connection error:', message.payload.error);
      }
    }

    /**
     * Replace the last inserted message
     */
    function replaceLastMessage(newText: string) {
      if (!currentInputElement) return;

      // 简化实现：替换光标前的"等待"消息
      const currentValue = currentInputElement.value;
      const cursorPosition = currentInputElement.selectionStart || 0;
      
      // 查找最近的等待消息模式
      const waitingPatterns = [
        /⏳ Loading .+\.\.\./g,
        /🔄 Waiting for .+ data\.\.\./g,
        /❌ .+/g
      ];

      let updatedValue = currentValue;
      let newCursorPosition = cursorPosition;

      for (const pattern of waitingPatterns) {
        const matches = [...currentValue.matchAll(pattern)];
        const lastMatch = matches[matches.length - 1];
        
        if (lastMatch && lastMatch.index !== undefined) {
          const matchStart = lastMatch.index;
          const matchEnd = matchStart + lastMatch[0].length;
          
          // 只替换在光标位置之前的匹配
          if (matchEnd <= cursorPosition) {
            updatedValue = updatedValue.substring(0, matchStart) + newText + updatedValue.substring(matchEnd);
            newCursorPosition = matchStart + newText.length;
            break;
          }
        }
      }

      if (updatedValue !== currentValue) {
        currentInputElement.value = updatedValue;
        currentInputElement.setSelectionRange(newCursorPosition, newCursorPosition);
        
        // 触发 input 事件
        const inputEvent = new Event('input', { bubbles: true });
        currentInputElement.dispatchEvent(inputEvent);
      }
    }

    /**
     * Format file tree data
     */
    function formatFileTree(tree: any[]): string {
      const formatNode = (node: any, indent = ''): string => {
        const icon = node.type === 'directory' ? '📁' : '📄';
        let result = `${indent}${icon} ${node.name}\n`;
        
        if (node.children && node.children.length > 0) {
          result += node.children.map((child: any) => formatNode(child, indent + '  ')).join('');
        }
        
        return result;
      };

      return tree.map(node => formatNode(node)).join('');
    }

    /**
     * Get icon for context type
     */
    function getContextIcon(contextType: string): string {
      const icons: Record<string, string> = {
        'focused-file': '📄',
        'selected-text': '🎯',
        'all-open-tabs': '📑',
        'problems': '⚠️',
        'user-rules': '⚖️',
        'file-tree': '🌲',
        'full-codebase': '📚'
      };
      return icons[contextType] || '📋';
    }

    console.log('ConnAI Content Script initialized successfully');
  }
};