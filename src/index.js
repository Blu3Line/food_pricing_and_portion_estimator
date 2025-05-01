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
    const sources = await desktopCapturer.getSources({
      types: ['camera'],
      thumbnailSize: { width: 0, height: 0 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name
    }));
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

  // YOLO model entegrasyonu için yer tutucu
  // Gerçek uygulamada buraya YOLO modeli ile iletişim kodu eklenecek
  ipcMain.handle('detect-food', async (event, imageData) => {
    // Şimdilik test verileri döndür
    // Gerçek uygulamada burada YOLO modelini çağırarak sonuçları alacağız
    return simulateDetection();
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

// Yemek tespitini simüle et (test amaçlı)
function simulateDetection() {
  // Test için sahte yemek veritabanı
  const foodDatabase = {
    'çorba': {
      name: 'Ezogelin Çorbası',
      price: 15.00,
      calories: 120,
      nutrition: {
        protein: "3g",
        carbs: "15g",
        fat: "6g",
        fiber: "2g"
      },
      ingredients: [
        "Kırmızı mercimek",
        "Bulgur",
        "Pirinç",
        "Kuru soğan",
        "Sarımsak",
        "Domates salçası",
        "Tereyağı",
        "Baharatlar"
      ],
      allergens: [
        "Gluten",
        "Süt ürünleri (tereyağı)"
      ],
      confidence: 0
    },
    'tavuk': {
      name: 'Izgara Tavuk',
      price: 45.00,
      calories: 250,
      nutrition: {
        protein: "30g",
        carbs: "0g",
        fat: "15g",
        fiber: "0g"
      },
      ingredients: [
        "Tavuk göğsü",
        "Zeytinyağı",
        "Sarımsak",
        "Limon suyu",
        "Baharatlar"
      ],
      allergens: [
        "Kümes hayvanları"
      ],
      confidence: 0
    },
    'pilav': {
      name: 'Pirinç Pilavı',
      price: 20.00,
      calories: 180,
      nutrition: {
        protein: "3g",
        carbs: "35g",
        fat: "5g",
        fiber: "0.5g"
      },
      ingredients: [
        "Pirinç",
        "Tereyağı",
        "Şehriye",
        "Tuz"
      ],
      allergens: [
        "Gluten (şehriye)",
        "Süt ürünleri (tereyağı)"
      ],
      confidence: 0
    }
  };

  // Rastgele 1-3 yemek tespiti yap
  const numberOfDetections = Math.floor(Math.random() * 3) + 1;
  const foodKeys = Object.keys(foodDatabase);
  const detectedFoods = [];
  
  for (let i = 0; i < numberOfDetections; i++) {
    // Rastgele bir yemek türü seç
    const randomIndex = Math.floor(Math.random() * foodKeys.length);
    const foodKey = foodKeys[randomIndex];
    
    // Yemek veritabanından bilgileri al
    const foodData = foodDatabase[foodKey];
    
    // Her bir tespit için bağımsız bir nesne oluştur
    const detectedFood = { 
      ...JSON.parse(JSON.stringify(foodData)), 
      id: `${foodKey}_${i}`, // Benzersiz tespit ID'si
      // Her tespit için ayrı rastgele güven skoru (%70-98 arası)
      confidence: Math.floor(Math.random() * 28) + 70,
      // Tespitler için örnek bounding box (gerçek koordinatlar yerine)
      boundingBox: {
        x: Math.floor(Math.random() * 400),
        y: Math.floor(Math.random() * 300),
        width: Math.floor(Math.random() * 100) + 50,
        height: Math.floor(Math.random() * 100) + 50
      }
    };
    
    detectedFoods.push(detectedFood);
  }
  
  // Güven skoruna göre sırala (yüksekten düşüğe)
  return detectedFoods.sort((a, b) => b.confidence - a.confidence);
}
