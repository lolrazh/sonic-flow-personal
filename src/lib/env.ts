/**
 * Environment variable handling for Sonic Flow
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

/**
 * Loads environment variables from .env file
 */
export function loadEnv(): void {
  try {
    // Get the path to the .env file
    const envPath = path.join(app.getAppPath(), '.env');
    
    // Check if the file exists
    if (fs.existsSync(envPath)) {
      console.log(`Loading environment variables from ${envPath}`);
      
      // Read the file
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // Parse the file
      const envVars = envContent.split('\n').filter(line => line.trim() !== '');
      
      // Set environment variables
      for (const line of envVars) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
          console.log(`Set environment variable: ${key.trim()}`);
        }
      }
    } else {
      console.warn('.env file not found');
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
} 