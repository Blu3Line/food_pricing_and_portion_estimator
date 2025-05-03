// Electron preload script
const { contextBridge, ipcRenderer } = require('electron');

// Electron API'lerini güvenli bir şekilde frontend tarafında kullanılabilir hale getirelim
contextBridge.exposeInMainWorld('electronAPI', {
  // Kamera erişimi için
  getVideoSources: () => ipcRenderer.invoke('get-video-sources'),
  
  // Dosya sistemi işlemleri için
  saveImage: (data) => ipcRenderer.invoke('save-image', data),
  openImage: () => ipcRenderer.invoke('open-image'),
  
  // Uygulama ayarları
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Uygulama bilgileri
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
});

// Tarayıcı ortamını kontrol et
contextBridge.exposeInMainWorld('environment', {
  isElectron: true
});
