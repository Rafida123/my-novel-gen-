import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // This tells Vite to replace these strings in your code
    // with the actual environment variables during the build.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.GROQ_API_KEY': JSON.stringify(process.env.GROQ_API_KEY)
  }
});