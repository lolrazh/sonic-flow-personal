import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// https://vitejs.dev/config
export default defineConfig({
  define: {
    // Make the environment variable available in the main process
    'process.env.GROQ_API_KEY': JSON.stringify(process.env.GROQ_API_KEY || '')
  }
});
