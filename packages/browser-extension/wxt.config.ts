import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: [
      'storage',
      'activeTab',
      'tabs'
    ],
    host_permissions: [
      'http://localhost/*',
      'https://localhost/*',
      '<all_urls>'
    ]
  }
});
