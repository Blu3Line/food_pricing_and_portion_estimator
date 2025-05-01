/**
 * Yemek Tanıma Modülü - Electron Versiyonu
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
        confidenceThreshold: 50 // Minimum güven eşiği (%)
    };

    /**
     * Modülü başlatır
     */
    const init = async () => {
        console.log("Yemek tanıma modülü başlatıldı");
        
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
        
        // Electron ortamında, doğrudan tespit sonuçları olabilir
        if (typeof imageDataOrResult === 'object' && !Array.isArray(imageDataOrResult)) {
            return imageDataOrResult; // Zaten tespit sonuçları
        }
        
        // Electron API'si varsa, tespit için kullan
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