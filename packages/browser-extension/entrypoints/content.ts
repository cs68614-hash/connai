// Content Script for ConnAI Browser Extension

// 定义上下文菜单项的类型
interface MenuAction {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
}

// 菜单项配置
const menuActions: MenuAction[] = [
  {
    id: 'explain-code',
    label: '解释代码',
    description: '解释选中的代码片段',
    shortcut: 'Ctrl+E'
  },
  {
    id: 'optimize-code',
    label: '优化代码',
    description: '优化选中的代码',
    shortcut: 'Ctrl+O'
  },
  {
    id: 'generate-comment',
    label: '生成注释',
    description: '为代码生成注释',
    shortcut: 'Ctrl+G'
  },
  {
    id: 'find-bugs',
    label: '查找错误',
    description: '检查代码中的潜在问题'
  },
  {
    id: 'generate-test',
    label: '生成测试',
    description: '为代码生成单元测试'
  },
  {
    id: 'refactor-code',
    label: '重构代码',
    description: '重构和改进代码结构'
  }
];

export default {
  matches: ['<all_urls>'],
  main() {
    console.log('ConnAI Content Script loaded');
    
    let menuContainer: HTMLElement | null = null;
    let currentInputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
    let currentMenuTriggerPosition = 0;

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
    function handleMenuAction(actionId: string) {
      if (!currentInputElement) return;

      const action = menuActions.find(a => a.id === actionId);
      if (!action) return;

      // 获取当前光标位置
      const cursorPosition = currentInputElement.selectionStart || 0;
      const currentValue = currentInputElement.value;
      
      // 移除触发的 # 符号
      const beforeTrigger = currentValue.substring(0, currentMenuTriggerPosition);
      const afterTrigger = currentValue.substring(currentMenuTriggerPosition + 1);
      
      // 插入占位文本
      const placeholderText = `[${action.label}] `;
      const newValue = beforeTrigger + placeholderText + afterTrigger;
      
      currentInputElement.value = newValue;
      
      // 设置光标位置到插入文本之后
      const newCursorPosition = currentMenuTriggerPosition + placeholderText.length;
      currentInputElement.setSelectionRange(newCursorPosition, newCursorPosition);
      
      // 触发 input 事件，通知其他脚本值已更改
      const inputEvent = new Event('input', { bubbles: true });
      currentInputElement.dispatchEvent(inputEvent);

      console.log(`ConnAI: Executed action "${action.label}"`);
      
      // TODO: 这里后续可以添加与 VS Code 扩展的通信逻辑
      // 或者调用真实的 AI 服务
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

    console.log('ConnAI Content Script initialized successfully');
  }
};