const { app } = require('electron');
const Store = require('electron-store');
const path = require('path');

const store = new Store();

async function clearWorkspaces() {
  try {
    console.log('Clearing all workspaces...');
    
    // Get app data path
    const appDataPath = app.getPath('userData');
    console.log('App data path:', appDataPath);
    
    // Clear workspaces from store
    store.delete('workspaces');
    
    console.log('✅ All workspaces cleared successfully!');
    console.log('Storage file:', store.path);
    
    app.quit();
  } catch (error) {
    console.error('❌ Error clearing workspaces:', error.message);
    app.quit();
  }
}

app.whenReady().then(() => {
  setTimeout(clearWorkspaces, 500);
});
