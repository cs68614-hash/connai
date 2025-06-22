# ConnAI 测试指南

## 🚀 快速测试步骤

### 1. 启动扩展
1. 在 VS Code 中打开 ConnAI 项目
2. 按 `F5` 启动扩展开发宿主
3. 在新的 VS Code 窗口中，扩展将自动激活

### 2. 启动服务器
1. 按 `Cmd+Shift+P` (macOS) 或 `Ctrl+Shift+P` (Windows/Linux) 打开命令面板
2. 输入 "ConnAI: Start ConnAI Server"
3. 执行命令启动服务器
4. 服务器将在端口 6718 上启动

### 3. 检查状态
1. 执行命令 "ConnAI: Show ConnAI Status"
2. 应该显示：
   ```
   ConnAI Status:
   - Server: Running
   - Port: 6718
   - Connected Clients: 0
   - Authentication: Test Mode (Any token accepted)
   ```

### 4. 测试 Web 客户端
1. 打开 `examples/demo.html` 文件
2. 在浏览器中打开它
3. 输入任意 Auth Token（例如：`test123`）
4. 点击 "Connect" 按钮
5. 应该看到连接成功消息

## 🔧 认证测试

### 当前认证设置
- **测试模式**：任何包含 token 的请求都会被接受
- **无需真实验证**：不会调用 Whop API 或其他外部服务
- **简化登录**：只需要提供任意非空字符串作为 token

### 推荐测试 Token
- `test-token-123`
- `demo-user`
- `connai-test`
- 或任何其他非空字符串

## 🌐 Web 客户端功能测试

连接成功后，可以测试以下功能：

### 1. 工作区操作
- **Get Workspace Context**: 获取当前工作区信息
- **Get Cursor Position**: 获取光标位置
- **Get Diagnostics**: 获取诊断信息

### 2. 文件操作
- **Get File Content**: 输入文件路径获取内容
- **Search Files**: 搜索 TypeScript 文件

### 3. 命令执行
- **Execute VS Code Commands**: 执行各种 VS Code 命令

### 4. 实时监控
- **Start/Stop Monitoring**: 监控工作区变化

## 🐛 故障排除

### 服务器无法启动
1. 检查端口 6718 是否被占用：
   ```bash
   lsof -i :6718
   ```
2. 如果被占用，停止占用进程或更改端口
3. 重启扩展

### 客户端连接失败
1. 确认服务器已启动（检查状态）
2. 确认使用正确端口（6718）
3. 检查浏览器控制台是否有错误
4. 确保输入了 Auth Token

### 认证失败
1. 确保 Auth Token 字段不为空
2. 尝试不同的 token 字符串
3. 检查浏览器开发者工具的网络请求

## 📊 测试场景

### 基础连接测试
1. 启动服务器
2. 使用 demo.html 连接
3. 验证连接状态

### 功能测试
1. 测试工作区上下文获取
2. 测试文件操作
3. 测试命令执行
4. 测试实时监控

### 错误处理测试
1. 不提供 token 的连接尝试
2. 服务器停止时的客户端行为
3. 无效请求的处理

## 📝 日志查看

### VS Code 输出面板
1. 打开 "View" → "Output"
2. 选择 "ConnAI" 通道
3. 查看服务器日志

### 浏览器控制台
1. 按 F12 打开开发者工具
2. 查看 Console 标签
3. 监控网络请求

## ✅ 预期结果

成功的测试应该显示：

1. **服务器状态**: Running
2. **客户端连接**: 成功认证
3. **功能响应**: 所有 API 调用返回数据
4. **实时更新**: 监控功能正常工作

## 🎯 下一步

测试成功后，可以：

1. 集成真实的 Whop.com 认证
2. 实现完整的上下文提供者
3. 添加更多 VS Code API 集成
4. 优化性能和错误处理
