# ConnAI Copilot 集成故障排除指南

## 🔧 当前问题：语言模型不可用

### 问题描述
错误信息：`No suitable language model available`

这个错误表示 VS Code 无法找到可用的语言模型来处理聊天请求。

## 📋 解决步骤

### 1. 检查 GitHub Copilot 扩展安装

在 VS Code 中：
1. 打开扩展面板 (Cmd+Shift+X / Ctrl+Shift+X)
2. 搜索并确保已安装：
   - **GitHub Copilot** (github.copilot)
   - **GitHub Copilot Chat** (github.copilot-chat)
3. 确保两个扩展都已启用

### 2. 检查登录状态

1. 在 VS Code 中按 `Cmd+Shift+P` (或 `Ctrl+Shift+P`)
2. 输入 "GitHub Copilot: Sign In"
3. 按照提示登录您的 GitHub 账户
4. 确保您有有效的 GitHub Copilot 订阅

### 3. 验证 Copilot Chat 可用性

1. 在 VS Code 中按 `Cmd+Shift+P` (或 `Ctrl+Shift+P`)
2. 输入 "GitHub Copilot Chat: Open Chat"
3. 尝试在 Copilot Chat 面板中发送消息
4. 如果这里工作正常，则 Copilot 本身没有问题

### 4. 检查 VS Code 版本

确保您使用的是支持 Chat API 的 VS Code 版本：
- **最低要求**: VS Code 1.85.0 或更高
- **推荐版本**: VS Code 1.90.0 或更高

### 5. 重启和重新加载

1. 完全关闭 VS Code
2. 重新打开 VS Code
3. 重新加载窗口 (`Cmd+R` / `Ctrl+R`)
4. 等待所有扩展完全加载

### 6. 检查网络连接

确保您的网络可以访问：
- `https://api.github.com`
- `https://copilot-proxy.githubusercontent.com`

## 🧪 测试改进后的代码

我已经改进了代码，现在它会：

1. **尝试多种模型选择策略**：
   - 首先尝试 GitHub 模型
   - 如果失败，尝试任何可用的模型
   - 如果都失败，提供有用的兜底响应

2. **提供详细的状态信息**：
   - 显示 Copilot 扩展安装状态
   - 显示扩展激活状态
   - 显示 Chat API 可用性

3. **优雅的错误处理**：
   - 不再因为语言模型不可用而崩溃
   - 提供有用的错误信息和建议

## 🔍 调试信息收集

如果问题持续存在，请收集以下信息：

### VS Code 输出面板
1. 查看 → 输出
2. 选择 "ConnAI" 或 "GitHub Copilot" 通道
3. 查看错误日志

### 开发者工具
1. 帮助 → 切换开发者工具
2. 查看 Console 标签页的错误信息

### 扩展信息
```bash
# 在 VS Code 集成终端中运行
code --list-extensions --show-versions | grep -i copilot
```

## 📞 获取支持

如果以上步骤都无法解决问题，请：

1. 检查 GitHub Copilot 的状态页面
2. 联系 GitHub 支持
3. 在 ConnAI 项目中提交 Issue，包含：
   - VS Code 版本
   - 操作系统信息
   - 扩展版本
   - 完整的错误日志

## 🎯 预期行为

修复后，您应该看到：
- 聊天请求正常启动
- 即使 Copilot 不可用，也会收到有用的响应
- 详细的状态信息帮助诊断问题
- 不再出现 503 错误或语言模型错误

重新测试 ConnAI 的聊天功能，现在应该有更好的体验！
