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
