import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'sidePanel'
    ],
    host_permissions: [
      'http://localhost/*',
      'https://localhost/*',
      '<all_urls>'
    ],
    action: {
      default_popup: 'popup/index.html',
      default_title: 'ConnAI'
    },
    side_panel: {
      default_path: 'sidepanel/index.html'
    }
  }
});
