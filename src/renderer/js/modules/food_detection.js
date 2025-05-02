/**
 * Yemek Tanıma Modülü - Electron Versiyonu
 * WebSocket entegrasyonu ile güncellendi
 */
const FoodDetectionModule = (function() {
    // Örnek yemek veritabanı - Gerçek uygulamada bunlar API'den gelecek
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
        },
        'salata': {
            name: 'Mevsim Salatası',
            price: 25.00,
            calories: 80,
            nutrition: {
                protein: "2g",
                carbs: "10g",
                fat: "4g",
                fiber: "5g"
            },
            ingredients: [
                "Domates",
                "Salatalık",
                "Marul",
                "Kırmızı soğan",
                "Zeytinyağı",
                "Limon suyu"
            ],
            allergens: [],
            confidence: 0
        },
        'makarna': {
            name: 'Napoliten Makarna',
            price: 30.00,
            calories: 320,
            nutrition: {
                protein: "10g",
                carbs: "50g",
                fat: "8g",
                fiber: "3g"
            },
            ingredients: [
                "Makarna",
                "Domates sosu",
                "Sarımsak",
                "Soğan",
                "Zeytinyağı",
                "Fesleğen"
            ],
            allergens: [
                "Gluten"
            ],
            confidence: 0
        },
        'kuru_fasulye': {
            name: 'Kuru Fasulye',
            price: 30.00,
            calories: 220,
            nutrition: {
                protein: "15g",
                carbs: "30g",
                fat: "5g",
                fiber: "8g"
            },
            ingredients: [
                "Kuru fasulye",
                "Soğan",
                "Domates salçası",
                "Zeytinyağı",
                "Baharatlar"
            ],
            allergens: [
                "Baklagiller"
            ],
            confidence: 0
        }
    };

    // Modül ayarları
    let settings = {
        confidenceThreshold: 50, // Minimum güven eşiği (%)
        websocketEnabled: false  // WebSocket entegrasyonu aktif mi?
    };

    /**
     * Modülü başlatır
     */
    const init = async () => {
        console.log("Yemek tanıma modülü başlatıldı");
        
        // WebSocket entegrasyonunu kontrol et
        settings.websocketEnabled = typeof WebSocketManager !== 'undefined';
        console.log(`WebSocket entegrasyonu: ${settings.websocketEnabled ? 'Aktif' : 'Pasif'}`);
        
        // Electron ortamında ayarları yükle
        if (window.environment && window.environment.isElectron && window.electronAPI) {
            try {
                const appSettings = await window.electronAPI.getSettings();
                if (appSettings && appSettings.confidenceThreshold) {
                    settings.confidenceThreshold = appSettings.confidenceThreshold * 100; // 0.7 -> 70
                }
                console.log("Tespit ayarları yüklendi:", settings);
            } catch (error) {
                console.error("Ayarlar yüklenirken hata:", error);
            }
        }
    };

    /**
     * Görüntüden yemekleri tespit eder
     * @param {string|Object} imageDataOrResult - Base64 formatında resim verisi veya doğrudan tespit sonuçları
     * @returns {Promise} - Tespit edilen yemekler listesi
     */
    const detectFoodsFromImage = async (imageDataOrResult) => {
        // Yükleme göstergesi
        console.log("Yemek tespit ediliyor...");
        
        // WebSocket yanıtını kontrol et (yeni entegrasyon için)
        if (settings.websocketEnabled && 
            typeof imageDataOrResult === 'object' && 
            imageDataOrResult.hasOwnProperty('success')) {
            
            // Bu bir WebSocket yanıtı, doğrudan işle
            console.log("WebSocket yanıtı işleniyor:", imageDataOrResult);
            
            if (imageDataOrResult.success) {
                return processDetectionResults(imageDataOrResult.data);
            } else {
                console.error("WebSocket tespit hatası:", imageDataOrResult.error);
                return []; // Boş liste döndür
            }
        }
        
        // Electron ortamında, doğrudan tespit sonuçları olabilir (eski yöntem)
        if (typeof imageDataOrResult === 'object' && !Array.isArray(imageDataOrResult) && !imageDataOrResult.hasOwnProperty('success')) {
            return imageDataOrResult; // Zaten işlenmiş tespit sonuçları
        }
        
        // Electron API'si varsa, tespit için kullan (WebSocket bağlantısı yoksa yedek)
        if (window.environment && window.environment.isElectron && window.electronAPI && window.electronAPI.detectFood) {
            try {
                const detectedFoods = await window.electronAPI.detectFood(imageDataOrResult);
                return detectedFoods;
            } catch (error) {
                console.error("Electron API ile tespit hatası:", error);
                return simulateDetection(); // Hata durumunda simülasyon
            }
        }
        
        // Electron yoksa veya API çağrısı başarısız olduysa, simülasyon yap
        return new Promise((resolve) => {
            setTimeout(() => {
                const detectedFoods = simulateDetection();
                resolve(detectedFoods);
            }, 1500);
        });
    };
    
    /**
     * WebSocket'ten gelen ham tespit sonuçlarını işler
     * @param {Array} detections - Ham tespit sonuçları
     * @returns {Array} - İşlenmiş yemek nesneleri
     */
    const processDetectionResults = (detections) => {
        if (!detections || !Array.isArray(detections) || detections.length === 0) {
            return [];
        }
        
        console.log(`${detections.length} tespit işleniyor`);
        
        const processedResults = [];
        
        // Her bir tespiti işle
        for (let i = 0; i < detections.length; i++) {
            const detection = detections[i];
            
            // Türkçe karakter ve boşluk problemlerini düzelt, küçük harfe dönüştür
            const normalizedClass = detection.class.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c');
            
            // Sınıfı veritabanında ara
            let foodData = foodDatabase[normalizedClass];
            
            // Veritabanında yoksa veya bulunamazsa genel bir giriş oluştur
            if (!foodData) {
                console.log(`Sınıf '${detection.class}' veritabanında bulunamadı, otomatik oluşturuluyor`);
                
                foodData = {
                    name: detection.class, // Orijinal sınıf adını kullan
                    price: Math.floor(Math.random() * 30) + 15, // Rastgele fiyat (15-45 TL)
                    calories: Math.floor(Math.random() * 200) + 100, // Rastgele kalori (100-300)
                    nutrition: {
                        protein: `${Math.floor(Math.random() * 20)}g`,
                        carbs: `${Math.floor(Math.random() * 40)}g`,
                        fat: `${Math.floor(Math.random() * 15)}g`,
                        fiber: `${Math.floor(Math.random() * 5)}g`
                    },
                    ingredients: ["İçerik bilgisi henüz eklenmedi"],
                    allergens: []
                };
            }
            
            // Her bir tespit için bağımsız bir nesne oluştur
            const detectedFood = {
                ...JSON.parse(JSON.stringify(foodData)),
                id: `${normalizedClass}_${i}`, // Benzersiz tespit ID'si
                confidence: detection.confidence * 100, // Yüzdelik değer (0-100)
                boundingBox: {
                    x: detection.bbox[0],
                    y: detection.bbox[1],
                    width: detection.bbox[2] - detection.bbox[0],
                    height: detection.bbox[3] - detection.bbox[1]
                },
                bbox: detection.bbox, // Orijinal bbox verisini de sakla
                segments: detection.segments // Segmentasyon verisi
            };
            
            // Sadece eşik değeri üzerindeki tespitleri ekle
            if (detectedFood.confidence >= settings.confidenceThreshold) {
                processedResults.push(detectedFood);
            }
        }
        
        // Güven skoruna göre sırala (yüksekten düşüğe)
        return processedResults.sort((a, b) => b.confidence - a.confidence);
    };

    /**
     * Yemek tespitini simüle eder (gerçekçi YOLO davranışını yansıtır)
     * @returns {Array} - Tespit edilen yemekler listesi
     */
    const simulateDetection = () => {
        // Rastgele 1-4 yemek tespiti yap
        const numberOfDetections = Math.floor(Math.random() * 4) + 1;
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
                // Her tespit için ayrı rastgele güven skoru (%50-98 arası)
                confidence: Math.floor(Math.random() * 48) + 50,
                // Tespitler için örnek bounding box
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
        return detectedFoods
            .filter(food => food.confidence >= settings.confidenceThreshold) // Eşik değeri üzerindeki tespitler
            .sort((a, b) => b.confidence - a.confidence);
    };

    /**
     * Tespit edilen yemeklerin toplam fiyatını hesaplar
     * @param {Array} foods - Yemek listesi
     * @returns {number} - Toplam fiyat
     */
    const calculateTotalPrice = (foods) => {
        return foods.reduce((total, food) => total + food.price, 0);
    };

    /**
     * Tespit edilen yemeklerin toplam kalorisini hesaplar
     * @param {Array} foods - Yemek listesi
     * @returns {number} - Toplam kalori
     */
    const calculateTotalCalories = (foods) => {
        return foods.reduce((total, food) => total + food.calories, 0);
    };

    /**
     * Ayarları değiştirir
     * @param {Object} newSettings - Yeni ayarlar
     */
    const updateSettings = async (newSettings) => {
        if (newSettings.confidenceThreshold !== undefined) {
            settings.confidenceThreshold = newSettings.confidenceThreshold;
        }
        
        // Electron ortamında ayarları kaydet
        if (window.environment && window.environment.isElectron && window.electronAPI) {
            try {
                await window.electronAPI.saveSettings({
                    ...settings,
                    confidenceThreshold: settings.confidenceThreshold / 100 // 70 -> 0.7
                });
            } catch (error) {
                console.error("Ayarlar kaydedilirken hata:", error);
            }
        }
    };

    // Public API
    return {
        init,
        detectFoodsFromImage,
        calculateTotalPrice,
        calculateTotalCalories,
        updateSettings,
        getSettings: () => ({ ...settings }) // Ayarların kopyasını döndür
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FoodDetectionModule;
} else if (typeof window !== 'undefined') {
    window.FoodDetectionModule = FoodDetectionModule;
}