# ConnAI Visual Design & Branding

## 🎨 Design Elements

### Logo & Visual Identity
- **Main Logo**: `assets/logo.svg` - Full animated logo with VS Code, AI bridge, and browser elements
- **Inline Logo**: `assets/logo-inline.svg` - Compact horizontal version for headers
- **Social Preview**: `assets/social-preview.svg` - GitHub social media preview image

### Color Palette
- **Primary Blue**: `#007ACC` (VS Code Blue)
- **Accent Teal**: `#00D4AA` (AI/Connection theme)
- **Bright Teal**: `#00F5D4` (Highlights and animations)
- **GitHub Dark**: `#0D1117`, `#161B22`, `#21262D` (Background themes)
- **Text Colors**: `#F0F6FC` (primary), `#7D8590` (secondary)

### Typography & Icons
- **Font**: Arial/sans-serif for cross-platform compatibility
- **Icons**: 
  - 🖥️ VS Code / Development
  - 🌐 Browser / Web
  - 🔗 Connection / Bridge
  - 🤖 AI / Intelligence
  - 🚀 Performance / Enhancement

## 📝 ASCII Art Branding

### Header Logo
```
╭─────────────────────────────────────────────────────────────────╮
│                                                                 │
│    ╭───╮     ╭─────╮    ╭───╮    ╭───╮                        │
│   ╱     ╲   ╱       ╲  ╱     ╲  ╱     ╲                       │
│  ╱  VS   ╲ ╱  ConnAI ╲╱   AI   ╲╱ Web   ╲                      │
│  ╲ Code  ╱ ╲ Protocol╱╲ Bridge ╱╲Browser╱                      │
│   ╲_____╱   ╲_______╱  ╲_____╱  ╲_____╱                       │
│       ╲         │         │         ╱                          │
│        ╲________│_________│________╱                           │
│                 │    🔗   │                                    │
│               Real-time Bridge                                 │
│                                                                 │
╰─────────────────────────────────────────────────────────────────╯
```

### Architecture Diagram
```
📦 ConnAI Monorepo
├── 🔌 protocol/          # Core protocol layer & communication contracts
├── 🖥️ vscode-extension/  # VS Code integration & HTTP server
├── 🌐 browser-extension/ # Browser extension (Chrome/Edge) with React UI
└── 📦 shared/           # Shared utilities, types & constants
```

### Communication Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  🌐 Browser     │    │  🔗 ConnAI      │    │  🖥️ VS Code    │
│   Extension     │◄──►│   Protocol      │◄──►│   Extension     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   🔍 Auto-discovery        🚀 HTTP/WebSocket       📄 Context extraction
   🔄 Smart reconnect       ⚡ Health monitoring      🗂️ File operations
   🎨 User interface        🛡️ Error handling        📊 Workspace info
   📝 Input detection       🔧 Port management       🏗️ Multi-workspace
```

### Footer Branding
```
🖥️ ───── 🔗 ───── 🌐 ───── 🤖
VS Code   ConnAI   Browser   AI
  ↕       Protocol    ↕       ↕
Your      Bridge    Web     AI
Project             App   Assistant
```

## 🎯 Brand Messaging

### Taglines
- **Primary**: "AI-Powered Code Context Bridge"
- **Secondary**: "Seamlessly bridge VS Code with web browsers through AI-powered code context sharing"
- **Action**: "🔗 Connect • 🚀 Enhance • 🤖 Empower"
- **Mission**: "Transform your development workflow with intelligent code context sharing"

### Key Value Props
1. **🌉 Bridge**: Connects local development with web applications
2. **🤖 AI-Powered**: Optimized for AI assistant integration
3. **🏗️ Modern Architecture**: Built with Monorepo and protocol-based design
4. **⚡ Zero Configuration**: Auto-discovery and smart port management
5. **🔧 Developer-Friendly**: Rich context types and seamless integration

## 📱 Usage Guidelines

### GitHub README
- Use ASCII art header for visual impact
- Include status badges for credibility
- Center-align hero section
- Use consistent emoji mapping
- Include visual architecture diagrams

### Documentation
- Maintain consistent icon usage
- Use structured ASCII diagrams
- Include brand colors in code blocks
- Keep messaging concise and action-oriented

### Development
- SVG assets for scalability
- Consistent color palette across packages
- Professional typography choices
- Cross-platform compatibility focus
