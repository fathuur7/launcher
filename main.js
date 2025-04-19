// main.js - The main Electron process with enhanced logic
const { app, BrowserWindow, globalShortcut, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

// Config constants
const APP_CONFIG = {
  window: {
    width: 600,
    height: 400,
    shortcutKey: 'Alt+Space',
    positionOffset: 4 // Divisor for vertical positioning
  },
  paths: {
    userData: app.getPath('userData'),
    get shortcuts() { return path.join(this.userData, 'shortcuts.json') },
    get settings() { return path.join(this.userData, 'settings.json') }
  }
};

// Application state
const APP_STATE = {
  window: null,
  isVisible: false,
  shortcuts: [],
  settings: {
    theme: 'dark',
    startAtLogin: true,
    maxResults: 10
  }
};

/**
 * Data management module for handling shortcuts and settings
 */
const DataManager = {
  /**
   * Loads shortcuts from storage or initializes with defaults if none exist
   * @returns {Array} The loaded shortcuts array
   */
  loadShortcuts() {
    try {
      console.log(`Loading shortcuts from: ${APP_CONFIG.paths.shortcuts}`);
      
      if (fs.existsSync(APP_CONFIG.paths.shortcuts)) {
        const data = fs.readFileSync(APP_CONFIG.paths.shortcuts, 'utf8');
        
        try {
          const parsedShortcuts = JSON.parse(data);
          console.log(`Successfully loaded ${parsedShortcuts.length} shortcuts`);
          APP_STATE.shortcuts = parsedShortcuts;
        } catch (parseError) {
          console.error('Failed to parse shortcuts file:', parseError);
          console.warn('Creating new shortcuts file with defaults');
          this.initializeDefaultShortcuts();
        }
      } else {
        console.log('Shortcuts file not found, creating with defaults');
        this.initializeDefaultShortcuts();
      }
    } catch (err) {
      console.error('Critical error loading shortcuts:', err);
      APP_STATE.shortcuts = [];
    }
    
    return APP_STATE.shortcuts;
  },

  /**
   * Sets up default shortcuts and saves them to disk
   */
  initializeDefaultShortcuts() {
    // Create platform-specific defaults
    const defaultShortcuts = [];
    
    // Common defaults for all platforms
    defaultShortcuts.push({ 
      name: 'Google',
      path: 'https://www.google.com', 
      type: 'url',
      icon: 'G',
      createdAt: new Date().toISOString()
    });
    
    defaultShortcuts.push({ 
      name: 'GitHub',
      path: 'https://github.com', 
      type: 'url',
      icon: 'GH',
      createdAt: new Date().toISOString()
    });
    
    // Platform-specific defaults
    if (process.platform === 'win32') {
      defaultShortcuts.push({ 
        name: 'Notepad',
        path: 'notepad.exe', 
        type: 'app',
        icon: 'N',
        createdAt: new Date().toISOString()
      });
    } else if (process.platform === 'darwin') {
      defaultShortcuts.push({ 
        name: 'TextEdit',
        path: 'open -a TextEdit', 
        type: 'app',
        icon: 'T',
        createdAt: new Date().toISOString()
      });
    } else {
      // Linux default
      defaultShortcuts.push({ 
        name: 'Terminal',
        path: 'x-terminal-emulator', 
        type: 'app',
        icon: '$',
        createdAt: new Date().toISOString()
      });
    }
    
    APP_STATE.shortcuts = defaultShortcuts;
    
    // Create backup of existing file if it exists but is corrupted
    if (fs.existsSync(APP_CONFIG.paths.shortcuts)) {
      const backupPath = `${APP_CONFIG.paths.shortcuts}.bak`;
      try {
        fs.copyFileSync(APP_CONFIG.paths.shortcuts, backupPath);
        console.log(`Created backup of corrupted shortcuts at ${backupPath}`);
      } catch (backupErr) {
        console.error('Failed to create backup:', backupErr);
      }
    }
    
    this.saveShortcuts();
  },

  /**
   * Save shortcuts to file
   */
  saveShortcuts() {
    try {
      const dirPath = path.dirname(APP_CONFIG.paths.shortcuts);
      
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(
        APP_CONFIG.paths.shortcuts, 
        JSON.stringify(APP_STATE.shortcuts, null, 2)
      );
      
      console.log(`Saved ${APP_STATE.shortcuts.length} shortcuts to ${APP_CONFIG.paths.shortcuts}`);
    } catch (err) {
      console.error('Failed to save shortcuts:', err);
      dialog.showErrorBox(
        'Error Saving Shortcuts', 
        `Failed to save shortcuts: ${err.message}`
      );
    }
  },
  
  /**
   * Load application settings
   */
  loadSettings() {
    try {
      if (fs.existsSync(APP_CONFIG.paths.settings)) {
        const data = fs.readFileSync(APP_CONFIG.paths.settings, 'utf8');
        const parsedSettings = JSON.parse(data);
        APP_STATE.settings = { ...APP_STATE.settings, ...parsedSettings };
        console.log('Settings loaded successfully');
      } else {
        this.saveSettings();
        console.log('Default settings created');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  },
  
  /**
   * Save application settings
   */
  saveSettings() {
    try {
      fs.writeFileSync(
        APP_CONFIG.paths.settings, 
        JSON.stringify(APP_STATE.settings, null, 2)
      );
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  },
  
  /**
   * Add a new shortcut
   * @param {Object} shortcut - The shortcut to add
   * @returns {Array} Updated shortcuts array
   */
  addShortcut(shortcut) {
    // Add created timestamp and generate icon if not provided
    const newShortcut = {
      ...shortcut,
      createdAt: new Date().toISOString(),
      icon: shortcut.icon || shortcut.name.charAt(0).toUpperCase()
    };
    
    APP_STATE.shortcuts.push(newShortcut);
    this.saveShortcuts();
    return APP_STATE.shortcuts;
  },
  
  /**
   * Delete a shortcut
   * @param {number} index - Index of shortcut to delete
   * @returns {Array} Updated shortcuts array
   */
  deleteShortcut(index) {
    if (index >= 0 && index < APP_STATE.shortcuts.length) {
      APP_STATE.shortcuts.splice(index, 1);
      this.saveShortcuts();
    }
    return APP_STATE.shortcuts;
  },
  
  /**
   * Update a shortcut
   * @param {number} index - Index of shortcut to update
   * @param {Object} shortcutData - New shortcut data
   * @returns {Array} Updated shortcuts array
   */
  updateShortcut(index, shortcutData) {
    if (index >= 0 && index < APP_STATE.shortcuts.length) {
      APP_STATE.shortcuts[index] = {
        ...APP_STATE.shortcuts[index],
        ...shortcutData,
        updatedAt: new Date().toISOString()
      };
      this.saveShortcuts();
    }
    return APP_STATE.shortcuts;
  }
};

/**
 * Window management module
 */
const WindowManager = {
  /**
   * Create the main application window
   */
  createWindow() {
    APP_STATE.window = new BrowserWindow({
      width: APP_CONFIG.window.width,
      height: APP_CONFIG.window.height,
      frame: false,
      show: false,
      transparent: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    APP_STATE.window.loadFile('index.html');

    // Hide the window when it loses focus
    APP_STATE.window.on('blur', () => {
      this.hideWindow();
    });

    // Don't show in taskbar
    APP_STATE.window.setSkipTaskbar(true);
    
    // Debug tools in development
    if (process.env.NODE_ENV === 'development') {
      APP_STATE.window.webContents.openDevTools({ mode: 'detach' });
    }
  },

  /**
   * Toggle window visibility
   */
  toggleWindow() {
    if (APP_STATE.isVisible) {
      WindowManager.hideWindow();
    } else {
      WindowManager.showWindow();
    }
  },

  /**
   * Show the window
   */
  showWindow() {
    if (!APP_STATE.window) return;
    
    const screenBounds = require('electron').screen.getPrimaryDisplay().workAreaSize;
    const x = Math.round((screenBounds.width - APP_CONFIG.window.width) / 2);
    const y = Math.round((screenBounds.height - APP_CONFIG.window.height) / APP_CONFIG.window.positionOffset);
    
    APP_STATE.window.setPosition(x, y);
    APP_STATE.window.show();
    APP_STATE.isVisible = true;
  },

  /**
   * Hide the window
   */
  hideWindow() {
    if (!APP_STATE.window) return;
    APP_STATE.window.hide();
    APP_STATE.isVisible = false;
  }
};

/**
 * Actions module for handling shortcut execution
 */
const ActionHandler = {
  /**
   * Execute a shortcut based on its type
   * @param {Object} shortcut - The shortcut to execute
   */
  executeShortcut(shortcut) {
    console.log(`Executing shortcut: ${shortcut.name} (${shortcut.type})`);
    
    switch (shortcut.type) {
      case 'url':
        shell.openExternal(shortcut.path);
        break;
        
      case 'app':
        this.launchApplication(shortcut.path);
        break;
        
      case 'command':
        this.executeCommand(shortcut.path);
        break;
        
      case 'folder':
        this.openFolder(shortcut.path);
        break;
        
      default:
        console.error(`Unknown shortcut type: ${shortcut.type}`);
    }
    
    WindowManager.hideWindow();
  },
  
  /**
   * Launch an application
   * @param {string} appPath - Path to the application
   */
  launchApplication(appPath) {
    try {
      // Different handling for different platforms
      if (process.platform === 'win32') {
        exec(`start "" "${appPath}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${appPath}"`);
      } else {
        exec(`"${appPath}"`);
      }
    } catch (err) {
      console.error('Failed to launch application:', err);
      dialog.showErrorBox('Error', `Failed to launch ${appPath}: ${err.message}`);
    }
  },
  
  /**
   * Execute a system command
   * @param {string} command - Command to execute
   */
  executeCommand(command) {
    try {
      exec(command, (error) => {
        if (error) {
          console.error(`Command execution error: ${error}`);
          dialog.showErrorBox('Command Failed', error.message);
        }
      });
    } catch (err) {
      console.error('Failed to execute command:', err);
    }
  },
  
  /**
   * Open a folder in file explorer
   * @param {string} folderPath - Path to the folder
   */
  openFolder(folderPath) {
    try {
      shell.openPath(folderPath);
    } catch (err) {
      console.error('Failed to open folder:', err);
      dialog.showErrorBox('Error', `Failed to open ${folderPath}: ${err.message}`);
    }
  },
  
  /**
   * Search Google for the given query
   * @param {string} query - Search query
   */
  queryGoogle(query) {
    console.log('Executing Google search for:', query);
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    console.log('Opening URL:', url);
    shell.openExternal(url);
    WindowManager.hideWindow();
  }
};

/**
 * Initialize the application
 */
function initializeApp() {
  // Load data
  DataManager.loadSettings();
  DataManager.loadShortcuts();
  
  // Create window
  WindowManager.createWindow();
  
  // Register global shortcut
  globalShortcut.register(APP_CONFIG.window.shortcutKey, WindowManager.toggleWindow);
  
  // Set up auto-launch if enabled in settings
  setupAutoLaunch();
}

/**
 * Set up auto-launch at login if enabled in settings
 */
function setupAutoLaunch() {
  // Implement auto-launch functionality
  // This is platform-specific and would need additional code
  console.log(`Auto-launch at login: ${APP_STATE.settings.startAtLogin}`);
}

// Set up IPC communication
function setupIPC() {
  // Shortcuts management
  ipcMain.handle('get-shortcuts', () => {
    return APP_STATE.shortcuts;
  });

  ipcMain.handle('add-shortcut', (event, shortcut) => {
    return DataManager.addShortcut(shortcut);
  });

  ipcMain.handle('delete-shortcut', (event, index) => {
    return DataManager.deleteShortcut(index);
  });
  
  ipcMain.handle('update-shortcut', (event, index, shortcutData) => {
    return DataManager.updateShortcut(index, shortcutData);
  });

  ipcMain.handle('execute-shortcut', (event, shortcut) => {
    ActionHandler.executeShortcut(shortcut);
  });
  
  // Google search
  ipcMain.handle('query-google', (event, query) => {
    ActionHandler.queryGoogle(query);
  });

  ipcMain.on('open-url', (event, url) => {
    shell.openExternal(url);
  });

  // Settings
  ipcMain.handle('get-settings', () => {
    return APP_STATE.settings;
  });
  
  ipcMain.handle('update-settings', (event, settings) => {
    APP_STATE.settings = { ...APP_STATE.settings, ...settings };
    DataManager.saveSettings();
    return APP_STATE.settings;
  });
  
  // Window control
  ipcMain.handle('hide-window', () => {
    WindowManager.hideWindow();
  });
}

// Application lifecycle events
app.whenReady().then(() => {
  initializeApp();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    WindowManager.createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});