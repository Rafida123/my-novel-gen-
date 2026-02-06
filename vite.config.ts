
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // This tells Vite to replace 'process.env.API_KEY' in your code
    // with the actual environment variable during the build.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
