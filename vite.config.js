import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: '.',
    publicDir: 'public',
    build: {
      outDir: 'dist'
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        // Proxy /api/sf/* → Salesforce REST API
        '/api/sf': {
          target: env.SF_INSTANCE_URL,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/sf/, '/services/apexrest'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.SF_ACCESS_TOKEN}`);
            });
          }
        },
        // Proxy /api/ai/* → Google Gemini API (streaming)
        '/api/ai': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/ai/, '/v1beta'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-goog-api-key', env.GEMINI_API_KEY);
            });
          }
        }
      }
    }
  };
});
