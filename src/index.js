const { app, BrowserWindow, ipcMain, dialog, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Basit bir JSON tabanlı store implementasyonu
const store = {
  configPath: path.join(app.getPath('userData'), 'config.json'),
  data: {},
  
  // Store'u disk üzerinden yükle
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileData = fs.readFileSync(this.configPath, 'utf8');
        this.data = JSON.parse(fileData);
      }
    } catch (error) {
      console.error('Config yüklenirken hata:', error);
      this.data = {};
    }
    return this;
  },
  
  // Store'u diske kaydet
  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Config kaydedilirken hata:', error);
    }
    return this;
  },
  
  // Değer al
  get(key, defaultValue) {
    const keys = key.split('.');
    let current = this.data;
    
    for (let i = 0; i < keys.length; i++) {
      if (current === undefined || current === null) {
        return defaultValue;
      }
      if (i === keys.length - 1) {
        return current[keys[i]] !== undefined ? current[keys[i]] : defaultValue;
      }
      current = current[keys[i]];
    }
    
    return defaultValue;
  },
  
  // Değer ayarla
  set(key, value) {
    const keys = key.split('.');
    let current = this.data;
    
    for (let i = 0; i < keys.length; i++) {
      if (i === keys.length - 1) {
        current[keys[i]] = value;
      } else {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
    }
    
    this.save();
    return this;
  }
};

// Uygulama başlangıcında config'i yükle
store.load();

// Ana pencere referansı
let mainWindow;

const createWindow = () => {
  // Önceki boyut ve konum bilgilerini al
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined,
    maximized: false
  });

  // Ana pencereyi oluştur
  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Yemekhane Yemek Tanıma Sistemi'
  });

  // Pencere tam ekransa alınmışsa hatırla
  if (windowState.maximized) {
    mainWindow.maximize();
  }

  // Pencere boyutunu kaydet
  ['resize', 'move', 'close'].forEach(event => {
    mainWindow.on(event, () => {
      if (!mainWindow.isMaximized()) {
        const { x, y, width, height } = mainWindow.getBounds();
        store.set('windowState', {
          x, y, width, height,
          maximized: false
        });
      } else {
        store.set('windowState.maximized', true);
      }
    });
  });

  // HTML dosyasını yükle
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Geliştirme sırasında DevTools açık olsun
  // mainWindow.webContents.openDevTools();
};

// Bu metod, Electron başlatılması tamamlandığında çağrılır
// ve tarayıcı pencereleri oluşturmaya hazırdır.
app.whenReady().then(() => {
  // IPC olaylarını dinle
  setupIpcHandlers();
  
  createWindow();

  app.on('activate', () => {
    // macOS'te dock simgesine tıklandığında yeni pencere aç
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tüm pencereler kapatıldığında uygulamadan çık
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC olay dinleyicilerini ayarla
function setupIpcHandlers() {
  // Kamera kaynaklarını getir
  ipcMain.handle('get-video-sources', async () => {
    try {
      // Renderer process'ten MediaDevices API'yi kullanarak kamera listesi al
      // Bu işlem renderer process'te yapılacak ve sonuç buraya gönderilecek
      return [];
    } catch (error) {
      console.error('Kamera listesi alma hatası:', error);
      return [];
    }
  });

  // Medya cihazlarını numaralandır (renderer process'e MediaDevices API erişimi ver)
  ipcMain.handle('enumerate-devices', async () => {
    // Bu işlem renderer process'te MediaDevices API ile yapılacak
    return { success: true };
  });

  // Görüntüyü kaydet
  ipcMain.handle('save-image', async (event, imageData) => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Görüntüyü Kaydet',
        defaultPath: 'yemek-tepsisi.png',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }
        ]
      });

      if (filePath) {
        // Base64 formatındaki resim verisini temizle (data:image/png;base64, kısmını kaldır)
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        await writeFileAsync(filePath, buffer);
        return { success: true, filePath };
      }
      return { success: false, message: 'Kullanıcı dosya seçimini iptal etti' };
    } catch (error) {
      console.error('Dosya kaydetme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // Görüntü aç
  ipcMain.handle('open-image', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Resim Dosyası Aç',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }
        ],
        properties: ['openFile']
      });

      if (filePaths && filePaths.length > 0) {
        const imageData = fs.readFileSync(filePaths[0]).toString('base64');
        const extension = path.extname(filePaths[0]).substring(1);
        return {
          success: true,
          data: `data:image/${extension};base64,${imageData}`,
          filePath: filePaths[0]
        };
      }
      return { success: false, message: 'Kullanıcı dosya seçimini iptal etti' };
    } catch (error) {
      console.error('Dosya açma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // Uygulama ayarlarını al
  ipcMain.handle('get-settings', () => {
    return store.get('settings', {
      // Varsayılan ayarlar
      darkMode: false,
      cameraSetting: 'auto',
      confidenceThreshold: 0.7
    });
  });

  // Uygulama ayarlarını kaydet
  ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings);
    return { success: true };
  });

  // Uygulama bilgilerini al
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    };
  });
}
