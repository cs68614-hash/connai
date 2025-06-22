# ConnAI Protocol Layer

## 🎯 设计目标

ConnAI Protocol Layer 是一个编辑器无关的通信协议抽象层，旨在为不同编辑器（VS Code、WebStorm、Sublime Text 等）与浏览器扩展之间的通信提供标准化接口。

## 🏗️ 架构设计

### 核心组件

```
@connai/protocol
├── core/           # 协议核心层
│   ├── protocol.ts      # 协议定义和版本管理
│   ├── message.ts       # 消息基础结构
│   └── transport-simple.ts # 传输层抽象
├── contracts/      # 契约层
│   ├── context.ts       # 上下文获取契约
│   ├── file.ts          # 文件操作契约
│   ├── workspace.ts     # 工作区管理契约
│   └── auth.ts          # 认证契约
└── adapters/       # 适配器层
    ├── base.ts          # 基础适配器接口
    └── vscode.ts        # VS Code 适配器
```

### 分层架构

1. **协议核心层 (Core)**
   - 定义协议版本、能力、错误码
   - 提供标准化的消息格式
   - 实现传输层抽象（WebSocket、HTTP）

2. **契约层 (Contracts)**
   - 定义编辑器功能的标准接口
   - 上下文获取、文件操作、工作区管理、认证
   - 提供类型安全的数据结构

3. **适配器层 (Adapters)**
   - 为不同编辑器实现契约接口
   - 处理编辑器特定的 API 调用
   - 提供统一的功能访问方式

## 🔌 支持的功能

### 上下文操作 (Context)
- 获取当前聚焦的文件
- 获取选中的文本
- 获取所有打开的标签页
- 获取问题/诊断信息
- 获取文件树结构
- 获取工作区信息
- 获取编辑器状态

### 文件操作 (File)
- 读取/写入文件
- 文件搜索和模式匹配
- 文件监听和变更通知
- 目录遍历和元数据获取

### 工作区管理 (Workspace)
- 多工作区支持
- 工作区切换和管理
- 设置和扩展信息获取
- 工作区统计信息

### 认证 (Authentication)
- 多种认证方式支持
- Token 管理和刷新
- 权限检查
- 用户信息管理

## 📱 使用示例

### 1. 创建 VS Code 适配器

```typescript
import { createVSCodeAdapter } from '@connai/protocol';
import * as vscode from 'vscode';

// 创建适配器
const adapter = createVSCodeAdapter(vscode);

// 初始化
await adapter.initialize();

// 获取上下文契约
const contextContract = adapter.getContextContract();
if (contextContract) {
  // 获取当前聚焦的文件
  const response = await contextContract.getContext({
    type: ContextType.FOCUSED_FILE
  });
  
  console.log('Focused file:', response.data);
}
```

### 2. 使用适配器注册表

```typescript
import { adapterRegistry, createVSCodeAdapter } from '@connai/protocol';

// 注册适配器
const vscodeAdapter = createVSCodeAdapter(vscode);
adapterRegistry.register('vscode', vscodeAdapter);

// 设置为活动适配器
adapterRegistry.setActive('vscode');

// 获取活动适配器
const activeAdapter = adapterRegistry.getActive();
```

### 3. 创建自定义传输层

```typescript
import { createTransport, TransportEvent } from '@connai/protocol';

// 创建 WebSocket 传输
const transport = createTransport('websocket', {
  endpoint: 'ws://localhost:3000',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
});

// 监听连接事件
transport.on(TransportEvent.CONNECTED, () => {
  console.log('Connected to server');
});

// 连接
await transport.connect();
```

### 4. 发送协议消息

```typescript
import { MessageFactory, MessageType } from '@connai/protocol';

// 创建请求消息
const message = MessageFactory.createRequest('get_context', {
  contextType: 'focused-file',
  options: { includeContent: true }
});

// 发送并等待响应
const response = await transport.send(message);
console.log('Response:', response);
```

## 🔧 扩展新编辑器

要为新编辑器添加支持，需要：

1. **创建适配器类**
```typescript
export class WebStormAdapter extends BaseEditorAdapter {
  protected async onInitialize() {
    // WebStorm 特定初始化
  }
  
  protected createContextContract() {
    return new WebStormContextContract(this.webstorm);
  }
  
  // 实现其他契约...
}
```

2. **实现契约接口**
```typescript
class WebStormContextContract implements ContextContract {
  async getContext(request: ContextRequest): Promise<ContextResponse> {
    // 使用 WebStorm API 获取上下文数据
  }
  
  // 实现其他方法...
}
```

3. **注册适配器**
```typescript
const webstormAdapter = new WebStormAdapter(config);
adapterRegistry.register('webstorm', webstormAdapter);
```

## 🔀 协议版本管理

协议支持版本化以确保向前兼容：

```typescript
import { PROTOCOL_VERSION, ProtocolUtils } from '@connai/protocol';

// 检查版本兼容性
const isCompatible = ProtocolUtils.isVersionCompatible(
  clientVersion, 
  serverVersion
);

// 验证协议配置
const validation = ProtocolUtils.validateConfig(config);
if (!validation.valid) {
  console.error('Invalid config:', validation.errors);
}
```

## 📊 性能和监控

协议层提供内置的性能监控：

```typescript
// 获取传输统计
const stats = transport.getStats();
console.log('Messages sent:', stats.messagesSent);
console.log('Uptime:', stats.uptime);

// 健康检查
const health = await adapter.healthCheck();
console.log('Adapter healthy:', health.healthy);
```

## 🔒 安全性

协议层支持多种安全特性：

- 消息验证和模式检查
- 传输层加密（可选）
- 多种认证方式
- 权限检查和访问控制
- 敏感数据脱敏

## 🚀 下一步计划

1. **完善 VS Code 适配器实现**
   - 实现完整的文件操作
   - 添加工作区管理功能
   - 集成认证系统

2. **添加更多编辑器支持**
   - WebStorm/IntelliJ IDEA
   - Sublime Text
   - Atom/Pulsar

3. **增强协议功能**
   - 流式数据传输
   - 批量操作支持
   - 离线缓存机制

4. **性能优化**
   - 消息压缩
   - 连接池管理
   - 智能重连策略

这个协议抽象层为 ConnAI 项目提供了强大的跨编辑器通信基础，确保了代码的可维护性、可扩展性和向前兼容性。
