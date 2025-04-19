import { app, BrowserWindow, Tray, Menu, MenuItem, MenuItemConstructorOptions, globalShortcut, nativeImage, screen, ipcMain, dialog, nativeTheme } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { loadSettings, updateSetting } from './lib/settings';
import fs from 'node:fs';

// Suppress deprecation warnings
process.noDeprecation = true;

// Set up logging to file
const LOG_FILE = path.join(app.getPath('userData'), 'sonic-flow.log');
console.log(`Logging to file: ${LOG_FILE}`);

// Create a write stream for the log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Override console.log, console.error, etc. to also write to the log file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [LOG] ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ')}`;
  
  logStream.write(message + '\n');
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [ERROR] ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ')}`;
  
  logStream.write(message + '\n');
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [WARN] ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ')}`;
  
  logStream.write(message + '\n');
  originalConsoleWarn.apply(console, args);
};

// Load environment variables first
import { loadEnv } from './lib/env';
console.log('Loading environment variables...');
loadEnv();

// Log the API key status (not the actual key)
console.log(`GROQ_API_KEY status in main.ts: ${process.env.GROQ_API_KEY ? 'set' : 'not set'}`);

// Import the transcription service after loading environment variables
import { transcribeAudio, cleanupTempFiles } from './lib/transcription';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentHotkey: string = '';
let hotkeyDialogOpen = false;
let captureWindow: BrowserWindow | null = null;
let contextMenuWindow: BrowserWindow | null = null;
let contextMenuOpen = false;

// Global variable to store the current recording state
let isRecording = false;
let recordingData: Buffer | null = null;

// Common hotkey combinations to offer as options
const HOTKEY_OPTIONS = [
  'Alt+Shift+D',
  'Alt+Shift+S',
  'Ctrl+Shift+D',
  'Ctrl+Alt+D',
  'Alt+D',
  'Ctrl+D'
];

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 120,
    height: 35,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Disable features that cause warnings
      spellcheck: false,
      enableWebSQL: false,
    },
  });

  // Handle window close event
  mainWindow.on('close', () => {
    console.log('Main window close event triggered, quitting application');
    app.quit();
  });

  // Position window at the bottom center of the screen
  const { width, height } = mainWindow.getBounds();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(Math.floor((screenWidth - width) / 2), screenHeight - height - 2);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false);

  // Make window click-through except for the pill UI
  mainWindow.setIgnoreMouseEvents(false);

  // Register global shortcut from settings
  registerGlobalShortcut();

  // Pre-create the hotkey capture window for better performance
  createHotkeyCaptureWindow();
};

// Register the global shortcut based on settings
const registerGlobalShortcut = () => {
  // Unregister any existing shortcuts
  globalShortcut.unregisterAll();
  
  // Load settings to get the hotkey
  const settings = loadSettings();
  currentHotkey = settings.hotkey;
  
  // Register the shortcut
  try {
    globalShortcut.register(currentHotkey, () => {
      if (mainWindow) {
        // Send message to renderer process to toggle dictation
        mainWindow.webContents.send('toggle-dictation');
      }
    });
    console.log(`Registered global shortcut: ${currentHotkey}`);
  } catch (error) {
    console.error(`Failed to register shortcut ${currentHotkey}:`, error);
    // Fallback to default if registration fails
    if (currentHotkey !== 'Alt+Shift+D') {
      currentHotkey = 'Alt+Shift+D';
      globalShortcut.register(currentHotkey, () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-dictation');
        }
      });
    }
  }
};

// Handle hotkey change
const handleHotkeyChange = (newHotkey: string) => {
  if (newHotkey === currentHotkey) return;
  
  updateSetting('hotkey', newHotkey);
  currentHotkey = newHotkey;
  registerGlobalShortcut();
  updateTrayMenu();
};

// Create the hotkey capture window once and reuse it
const createHotkeyCaptureWindow = () => {
  if (captureWindow) return;
  
  // Create a frameless window that looks like a menu
  captureWindow = new BrowserWindow({
    width: 200, // Reduced from 220
    height: 125,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false, // Disabled for security
    },
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    hasShadow: true
  });
  
  // HTML for key capture UI - simplified to match native context menu
  const captureHtml = `
    <html>
    <head>
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background-color: transparent;
          overflow: hidden;
        }
        
        body {
          margin: 0;
          padding: 0;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          overflow: hidden;
          user-select: none;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        .container {
          background-color: #2c2c2c;
          border: 1px solid #444444;
          border-radius: 12px;
          padding: 4px; /* Reduced container padding */
          overflow: hidden;
        }
        
        .capture-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 0; /* Reduced from 6px to 4px to match container padding */
        }
        
        .key-display {
          font-size: 13px;
          padding: 5px 8px; /* Reduced horizontal padding */
          margin: 5px 0;
          background-color: #3c3c3c;
          border-radius: 6px; /* Increased from 3px to 6px for more rounded corners */
          text-align: center;
          width: 170px; /* Reduced width */
          min-height: 18px;
        }
        
        .key-display.listening {
          border: 1px solid #555555;
        }
        
        .hint {
          font-size: 11px;
          color: #aaaaaa;
          margin-top: 3px;
          text-align: center;
        }
        
        .buttons {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
          margin-bottom: 2px;
        }
        
        button {
          background-color: transparent;
          border: none;
          color: #ffffff;
          padding: 4px 6px; /* Reduced horizontal padding to match context menu */
          font-size: 12px;
          cursor: pointer;
          border-radius: 6px; /* Increased from 4px to 6px for more rounded corners */
        }
        
        button:hover {
          background-color: #3c3c3c;
          border-radius: 6px; /* Increased from 4px to 6px to match non-hover state */
        }
        
        button.primary {
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="capture-area">
          <div id="keyDisplay" class="key-display listening">Press a key combination</div>
          <div class="hint">Press modifier + key (e.g. Alt+Shift+D)</div>
        </div>
        <div class="buttons">
          <button id="cancelBtn">Cancel</button>
          <button id="saveBtn" class="primary" disabled>Save</button>
        </div>
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        const keyDisplay = document.getElementById('keyDisplay');
        const saveBtn = document.getElementById('saveBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        
        let capturedHotkey = '';
        let currentHotkey = '';
        
        // Reset the UI when shown and display current hotkey
        ipcRenderer.on('reset-ui', (_, hotkey) => {
          currentHotkey = hotkey;
          capturedHotkey = '';
          
          // Show current hotkey
          keyDisplay.textContent = currentHotkey || 'No hotkey set';
          keyDisplay.classList.remove('listening');
          saveBtn.disabled = true;
        });
        
        // Capture key combinations
        document.addEventListener('keydown', (e) => {
          // Only capture keys if in listening mode
          if (!keyDisplay.classList.contains('listening')) return;
          
          e.preventDefault();
          
          // Get modifiers
          const modifiers = [];
          if (e.altKey) modifiers.push('Alt');
          if (e.ctrlKey) modifiers.push('Ctrl');
          if (e.shiftKey) modifiers.push('Shift');
          if (e.metaKey) modifiers.push(navigator.platform.includes('Mac') ? 'Command' : 'Super');
          
          // Get the key
          let key = e.key;
          
          // Skip if only modifier keys are pressed
          if (['Alt', 'Control', 'Shift', 'Meta'].includes(key)) {
            return;
          }
          
          // Format the key (capitalize first letter for letters)
          if (key.length === 1) {
            key = key.toUpperCase();
          }
          
          // Create the hotkey string
          if (modifiers.length > 0) {
            capturedHotkey = [...modifiers, key].join('+');
            keyDisplay.textContent = capturedHotkey;
            keyDisplay.classList.remove('listening');
            saveBtn.disabled = false;
          }
        });
        
        // Click to start capturing a new hotkey
        keyDisplay.addEventListener('click', () => {
          keyDisplay.textContent = 'Press a key combination';
          keyDisplay.classList.add('listening');
          capturedHotkey = '';
          saveBtn.disabled = true;
        });
        
        // Save button
        saveBtn.addEventListener('click', () => {
          if (capturedHotkey) {
            ipcRenderer.send('save-hotkey', capturedHotkey);
          }
        });
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
          ipcRenderer.send('cancel-hotkey');
        });
      </script>
    </body>
    </html>
  `;
  
  // Load the HTML
  captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(captureHtml)}`);
  
  // Handle blur (clicking outside)
  captureWindow.on('blur', () => {
    hideHotkeyCaptureWindow();
  });
  
  // Handle close
  captureWindow.on('closed', () => {
    captureWindow = null;
    createHotkeyCaptureWindow(); // Recreate for next use
  });
};

// Show the hotkey capture window
const showHotkeyCaptureWindow = () => {
  if (hotkeyDialogOpen || !mainWindow || !captureWindow) return;
  hotkeyDialogOpen = true;
  
  // Position above the pill
  const pillBounds = mainWindow.getBounds();
  const captureSize = captureWindow.getSize();
  
  // Position centered above the pill with a smaller gap to be closer to the pill
  captureWindow.setPosition(
    Math.floor(pillBounds.x + (pillBounds.width / 2) - (captureSize[0] / 2)),
    pillBounds.y - captureSize[1] - 2 // Reduced vertical offset from 5 to 2 to be even closer to the pill
  );
  
  // Reset the UI and pass the current hotkey
  captureWindow.webContents.send('reset-ui', currentHotkey);
  
  // Show the window
  captureWindow.show();
};

// Hide the hotkey capture window
const hideHotkeyCaptureWindow = () => {
  if (!hotkeyDialogOpen || !captureWindow) return;
  hotkeyDialogOpen = false;
  captureWindow.hide();
};

// Validate hotkey format
const isValidHotkeyFormat = (hotkey: string): boolean => {
  // Basic validation - should contain at least one modifier and a key
  const modifiers = ['Alt', 'Shift', 'Ctrl', 'Command', 'Option', 'Super'];
  return modifiers.some(modifier => hotkey.includes(modifier)) && 
         hotkey.includes('+') &&
         hotkey.split('+').length >= 2;
};

const createTray = () => {
  try {
    // Check if tray already exists
    if (tray) {
      return;
    }
    
    // Create a basic tray icon using a blank icon
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    
    // Initial tray menu
    updateTrayMenu();
    
    tray.setToolTip('Sonic Flow');
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
};

// Update the tray menu to show current hotkey
const updateTrayMenu = () => {
  if (!tray) return;
  
  try {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Account', click: () => console.log('Account clicked') },
      { label: 'Hide for 1 Hour', click: () => console.log('Hide for one hour clicked') },
      { 
        label: 'Change Hotkey',
        click: () => showHotkeyCaptureWindow()
      },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() },
    ]);
    
    tray.setContextMenu(contextMenu);
  } catch (error) {
    console.error('Failed to update tray menu:', error);
  }
};

// Create the custom context menu window
const createContextMenuWindow = () => {
  if (contextMenuWindow) return;
  
  // Create a frameless window that looks like a menu
  contextMenuWindow = new BrowserWindow({
    width: 140, // Further reduced width from 160 to 140
    height: 150,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false, // Disabled for security
    },
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    hasShadow: true
  });
  
  // HTML for context menu UI - styled to match the hotkey selection menu
  const contextMenuHtml = `
    <html>
    <head>
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background-color: transparent;
          overflow: hidden;
        }
        
        body {
          margin: 0;
          padding: 0;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          overflow: hidden;
          user-select: none;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        .container {
          background-color: #2c2c2c;
          border: 1px solid #444444;
          border-radius: 12px;
          padding: 4px; /* Reduced container padding */
          overflow: hidden;
        }
        
        .menu-items {
          display: flex;
          flex-direction: column;
          width: 100%;
          padding: 0; /* Removed vertical padding */
        }
        
        .menu-item {
          font-size: 12px;
          padding: 4px 6px; /* Changed from 6px 6px to 4px 6px to make padding consistent */
          margin: 2px 0;
          cursor: pointer;
          border-radius: 6px; /* Increased from 4px to 6px for more rounded corners */
          text-align: left;
          color: #ffffff;
          background-color: transparent;
          border: none;
          width: auto; /* Let the button size naturally */
          display: block;
        }
        
        .menu-item:hover {
          background-color: #3c3c3c;
          border-radius: 6px; /* Increased from 4px to 6px to match non-hover state */
        }
        
        .separator {
          height: 1px;
          background-color: #444444;
          margin: 4px 0; /* Consistent margin */
          width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="menu-items">
          <button id="accountBtn" class="menu-item">Account</button>
          <button id="hideBtn" class="menu-item">Hide for 1 Hour</button>
          <button id="hotkeyBtn" class="menu-item">Change Hotkey</button>
          <div class="separator"></div>
          <button id="exitBtn" class="menu-item">Exit</button>
        </div>
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        
        // Set up button click handlers
        document.getElementById('accountBtn').addEventListener('click', () => {
          ipcRenderer.send('menu-account');
        });
        
        document.getElementById('hideBtn').addEventListener('click', () => {
          ipcRenderer.send('menu-hide');
        });
        
        document.getElementById('hotkeyBtn').addEventListener('click', () => {
          ipcRenderer.send('menu-hotkey');
        });
        
        document.getElementById('exitBtn').addEventListener('click', () => {
          console.log('[Context Menu] Exit button clicked, sending menu-exit IPC...');
          ipcRenderer.send('menu-exit');
        });
      </script>
    </body>
    </html>
  `;
  
  // Load the HTML
  contextMenuWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contextMenuHtml)}`);
  
  // Handle blur (clicking outside)
  contextMenuWindow.on('blur', () => {
    hideContextMenu();
  });
  
  // Handle close
  contextMenuWindow.on('closed', () => {
    contextMenuWindow = null;
    createContextMenuWindow(); // Recreate for next use
  });
};

// Show the custom context menu
const showContextMenu = () => {
  if (contextMenuOpen || !mainWindow || !contextMenuWindow) return;
  contextMenuOpen = true;
  
  // Position above the pill
  const pillBounds = mainWindow.getBounds();
  const menuSize = contextMenuWindow.getSize();
  
  // Position centered above the pill
  contextMenuWindow.setPosition(
    Math.floor(pillBounds.x + (pillBounds.width / 2) - (menuSize[0] / 2)),
    pillBounds.y - menuSize[1] - 2 // Reduced vertical offset from 5 to 2 to be even closer to the pill
  );
  
  // Show the window
  contextMenuWindow.show();
};

// Hide the context menu
const hideContextMenu = () => {
  if (!contextMenuOpen || !contextMenuWindow) return;
  contextMenuOpen = false;
  contextMenuWindow.hide();
};

// Add a handler for insert-text-at-cursor
ipcMain.handle('insert-text-at-cursor', async (_, text) => {
  let originalClipboardText: string | undefined = undefined;
  try {
    console.log('=== TEXT INSERTION PROCESS START ===');
    console.log('Attempting to insert text at cursor:', text);
    
    // Read and store the current clipboard content (text only)
    const { clipboard } = require('electron');
    originalClipboardText = clipboard.readText();
    console.log('Original clipboard text stored.');

    // Copy the transcription text to clipboard
    const trimmedText = text.trimStart(); // Trim leading whitespace
    clipboard.writeText(trimmedText); // Use trimmed text
    console.log('Transcription text copied to clipboard');
    
    // Simulate paste keystroke using the active window
    const activeWindow = BrowserWindow.getFocusedWindow();
    let pasteSuccess = false;
    let pasteError: string | null = null;
    
    if (!activeWindow) {
      console.log('No Electron window is focused, sending paste command to OS');
      
      // Platform-specific paste simulation
      try {
        const { execSync } = require('child_process');
        if (process.platform === 'win32') {
          console.log('Executing paste command via PowerShell');
          execSync('powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'^v\')"');
        } else if (process.platform === 'darwin') {
          console.log('Executing paste command via AppleScript');
          execSync('osascript -e \'tell application "System Events" to keystroke "v" using command down\'');
        } else if (process.platform === 'linux') {
          console.log('Executing paste command via xdotool');
          execSync('xdotool key ctrl+v');
        } else {
          throw new Error('Unsupported platform for OS-level paste');
        }
        console.log('Paste command executed successfully via OS');
        pasteSuccess = true;
      } catch (err) {
        console.error('Failed to execute paste command:', err);
        pasteError = 'Unable to paste text. Please make sure a text field is focused.';
        pasteSuccess = false;
      }
    } else {
      // If an Electron window is focused, use webContents.paste()
      console.log('Electron window is focused, using webContents.paste()');
      activeWindow.webContents.paste();
      console.log('Paste command executed via webContents');
      pasteSuccess = true; // Assume success for webContents.paste
    }
    
    // Restore the original clipboard content AFTER attempting paste
    clipboard.writeText(originalClipboardText);
    console.log('Original clipboard text restored.');

    if (pasteSuccess) {
      console.log('=== TEXT INSERTION PROCESS COMPLETE ===');
      return { success: true };
    } else {
      console.log('=== TEXT INSERTION PROCESS FAILED ===');
      return { success: false, error: pasteError };
    }
    
  } catch (error) {
    console.error('=== TEXT INSERTION PROCESS FAILED ===');
    console.error('Failed to insert text at cursor:', error);
    // Restore clipboard even if there was an error before paste attempt (e.g., clipboard access)
    if (typeof originalClipboardText !== 'undefined') {
      const { clipboard } = require('electron');
      clipboard.writeText(originalClipboardText);
      console.log('Original clipboard text restored after error.');
    }
    return { 
      success: false, 
      error: 'Unable to insert text at cursor. Please make sure a text field is focused.'
    };
  }
});

// Clean up temporary files when the app quits
app.on('quit', () => {
  try {
    // Close the log stream properly - Moved to will-quit
    // if (logStream) {
    //   logStream.end();
    // }
    
    // Clean up temp files
    cleanupTempFiles();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

// Add IPC handlers for audio recording and transcription
ipcMain.handle('start-recording', async () => {
  console.log('Main process: Recording started');
  
  // Reset state
  if (isRecording) {
    console.log('Warning: Recording was already active, resetting state');
  }
  
  isRecording = true;
  recordingData = null;
  return { success: true };
});

ipcMain.handle('stop-recording', async () => {
  console.log('Main process: Recording stopped');
  
  // Check if recording was active
  if (!isRecording) {
    console.log('Warning: Recording was not active, but stop was requested');
  }
  
  // Reset state
  isRecording = false;
  
  // Clear any stored recording data to prevent memory leaks
  if (recordingData) {
    console.log('Main process: Clearing stored recording data');
    recordingData = null;
  }
  
  return { success: true };
});

ipcMain.handle('transcribe-audio', async (_, audioData) => {
  try {
    console.log('=== TRANSCRIPTION PROCESS START ===');
    console.log('Received audio data for transcription, length:', audioData?.length || 0, 'bytes');
    
    // Validate audio data
    if (!audioData || audioData.length === 0) {
      console.error('Received empty audio data');
      return { success: false, error: 'Empty audio data received' };
    }
    
    // Ensure audioData is a Buffer
    let audioBuffer;
    if (Buffer.isBuffer(audioData)) {
      console.log('Audio data is already a Buffer');
      audioBuffer = audioData;
    } else if (audioData instanceof Uint8Array || Array.isArray(audioData)) {
      console.log('Converting audio data from Uint8Array/Array to Buffer');
      audioBuffer = Buffer.from(audioData);
      console.log('Converted to Buffer, new size:', audioBuffer.length, 'bytes');
    } else {
      console.error('Received invalid audio data type');
      return { success: false, error: 'Invalid audio data format' };
    }
    
    // Store the audio data
    recordingData = audioBuffer;
    
    console.log('Sending audio to Groq API for transcription...');
    
    // Transcribe the audio
    let text;
    try {
      text = await transcribeAudio(audioBuffer);
      console.log('Transcription successful, result:', text);
    } catch (transcriptionError) {
      console.error('Transcription API error:', transcriptionError);
      return { success: false, error: `Transcription API error: ${transcriptionError.message}` };
    }
    
    if (!text || text.trim() === '') {
      console.error('Transcription returned empty text');
      return { success: false, error: 'Transcription returned empty text' };
    }
    
    console.log('Transcription result:', text);
    console.log('=== TRANSCRIPTION PROCESS COMPLETE ===');
    
    // Clear recording data after successful transcription
    recordingData = null;
    
    return { success: true, text };
  } catch (error) {
    console.error('=== TRANSCRIPTION PROCESS FAILED ===');
    console.error('Error transcribing audio:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

// Add a handler to view the log file
ipcMain.handle('view-log-file', async () => {
  try {
    console.log('Attempting to open log file');
    
    // Check if the log file exists
    if (fs.existsSync(LOG_FILE)) {
      // Open the log file in the default text editor
      const { shell } = require('electron');
      await shell.openPath(LOG_FILE);
      console.log('Log file opened successfully');
      return { success: true };
    } else {
      console.error('Log file does not exist');
      return { success: false, error: 'Log file does not exist' };
    }
  } catch (error) {
    console.error('Failed to open log file:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Set disk cache options to avoid cache errors
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-http-cache');
  
  createWindow();
  createTray();
  createContextMenuWindow();

  // Set up IPC handler for showing the custom context menu
  ipcMain.on('show-context-menu', () => {
    showContextMenu();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  try {
    // Unregister all shortcuts when the app is about to quit
    globalShortcut.unregisterAll();
    
    // Clean up any remaining windows
    if (captureWindow) {
      captureWindow.destroy();
      captureWindow = null;
    }
    
    if (contextMenuWindow) {
      contextMenuWindow.destroy();
      contextMenuWindow = null;
    }
    
    // Clean up tray icon
    if (tray) {
      tray.destroy();
      tray = null;
    }
    
    // Close the log stream properly
    if (logStream) {
      logStream.end();
    }
  } catch (error) {
    console.error('Error during will-quit cleanup:', error);
  }
});

// === IPC Handlers for Hotkey Window (Registered ONCE) ===
ipcMain.on('save-hotkey', (_, hotkey: string) => {
  if (isValidHotkeyFormat(hotkey)) {
    handleHotkeyChange(hotkey);
  }
  hideHotkeyCaptureWindow();
});

ipcMain.on('cancel-hotkey', () => {
  hideHotkeyCaptureWindow();
});
// === END IPC Handlers ===

// === IPC Handlers for Context Menu (Registered ONCE) ===
ipcMain.on('menu-account', () => {
  console.log('Account clicked');
  hideContextMenu();
});

ipcMain.on('menu-hide', () => {
  console.log('Hide for one hour clicked');
  hideContextMenu();
});

ipcMain.on('menu-hotkey', () => {
  hideContextMenu();
  showHotkeyCaptureWindow();
});

ipcMain.on('menu-exit', () => {
  console.log('[IPC Main] Received menu-exit event');
  hideContextMenu();
  console.log('[IPC Main] Calling app.quit()...');
  app.quit();
  console.log('[IPC Main] app.quit() called.');
});
// === END IPC Handlers ===

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
