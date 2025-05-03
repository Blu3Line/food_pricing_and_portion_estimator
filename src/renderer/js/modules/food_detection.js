/**
 * Yemek Tanıma Modülü - Sadeleştirilmiş Versiyon
 * WebSocket entegrasyonu ve SimulationModule entegrasyonu içerir
 * Gereksiz Electron API referansları kaldırıldı
 */
const FoodDetectionModule = (function() {
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
        
        // Electron ortamında ayarları yükle (sadece confidence threshold için)
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
        
        // Simülasyon modülünün hazır olduğundan emin ol
        if (typeof SimulationModule !== 'undefined') {
            SimulationModule.init({
                confidenceThreshold: settings.confidenceThreshold / 100
            });
            console.log("Simülasyon modülü başlatıldı");
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
        
        // Eğer giriş parametresi zaten işlenmiş bir sonuç ise direkt döndür
        if (typeof imageDataOrResult === 'object' && Array.isArray(imageDataOrResult)) {
            return imageDataOrResult;
        }
        
        // 1. WebSocket ile tespit dene (bağlantı varsa)
        if (settings.websocketEnabled && WebSocketManager.isConnected()) {
            try {
                console.log("WebSocket ile tespit deneniyor...");
                const response = await WebSocketManager.sendImage(
                    imageDataOrResult, 
                    'image', 
                    { confidence: settings.confidenceThreshold / 100 }
                );
                
                if (response.success) {
                    console.log("WebSocket tespiti başarılı!");
                    return processDetectionResults(response.data);
                }
            } catch (error) {
                console.warn("WebSocket ile tespit başarısız:", error.message);
            }
        }
        
        // 2. Doğrudan simülasyon modülünü kullan (WebSocket yoksa/başarısızsa)
        if (typeof SimulationModule !== 'undefined') {
            console.log("Simülasyon modülü kullanılıyor...");
            try {
                const simResult = await SimulationModule.simulateDetection({
                    confidence: settings.confidenceThreshold / 100
                });
                console.log("Simülasyon sonuçları:", simResult);
                return processDetectionResults(simResult.data);
            } catch (error) {
                console.error("Simülasyon başarısız:", error);
            }
        }
        
        // Hiçbir yöntem çalışmadıysa boş liste döndür
        console.error("Hiçbir tespit yöntemi çalışmadı!");
        return [];
    };
    
    /**
     * WebSocket ile gerçek zamanlı tespit yapar
     * @param {string} frameData - Base64 formatında görüntü verisi
     * @param {boolean} isRealtime - Gerçek zamanlı mı?
     * @returns {Promise<Object>} - Tespit sonuçları
     */
    const detectFoodsViaWebSocket = async (frameData, isRealtime = false) => {
        // 1. WebSocket bağlantısı varsa onu kullan
        if (settings.websocketEnabled && WebSocketManager.isConnected()) {
            try {
                const response = await WebSocketManager.sendImage(
                    frameData,
                    isRealtime ? 'webcam' : 'image',
                    { confidence: settings.confidenceThreshold / 100 }
                );
                
                if (response.success) {
                    return {
                        success: true,
                        data: response.data,
                        processingTime: response.processing_time || 0,
                        isSimulation: false
                    };
                }
            } catch (error) {
                console.warn("WebSocket gerçek zamanlı tespit başarısız:", error.message);
            }
        }
        
        // 2. Simülasyon modülünü kullan
        if (typeof SimulationModule !== 'undefined') {
            try {
                const response = isRealtime ? 
                    await SimulationModule.simulateRealtimeDetection({ confidence: settings.confidenceThreshold / 100 }) :
                    await SimulationModule.simulateDetection({ confidence: settings.confidenceThreshold / 100 });
                
                return {
                    success: true,
                    data: response.data,
                    processingTime: response.processing_time || 0,
                    isSimulation: true
                };
            } catch (error) {
                console.error("Simülasyon tespiti başarısız:", error);
            }
        }
        
        // Başarısız olursa hata objesi döndür
        return {
            success: false,
            error: "Tespit için desteklenen bir yöntem bulunamadı",
            data: []
        };
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
            
            // Temel özelliklerini kontrol et
            if (!detection.class || !detection.confidence || !detection.bbox) {
                console.warn('Geçersiz tespit nesnesi, atlanıyor:', detection);
                continue;
            }
            
            // Food info özelliğini kontrol et
            const foodInfo = detection.food_info || {};
            
            // Her bir tespit için bağımsız bir nesne oluştur
            const detectedFood = {
                id: `${detection.class}_${i}`, // Benzersiz tespit ID'si
                name: foodInfo.name || detection.class,
                price: foodInfo.price || 0,
                calories: foodInfo.calories || 0,
                confidence: Math.round(detection.confidence * 100), // Yüzdelik değer (0-100)
                boundingBox: {
                    x: detection.bbox[0],
                    y: detection.bbox[1],
                    width: detection.bbox[2] - detection.bbox[0],
                    height: detection.bbox[3] - detection.bbox[1]
                },
                bbox: detection.bbox, // Orijinal bbox verisini de sakla
                segments: detection.segments || [], // Segmentasyon verisi
                nutrition: foodInfo.nutrition || {
                    protein: "0g",
                    carbs: "0g",
                    fat: "0g",
                    fiber: "0g"
                },
                ingredients: foodInfo.ingredients || [],
                allergens: foodInfo.allergens || []
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
            
            // Simülasyon modülü konfigürasyonunu da güncelle
            if (typeof SimulationModule !== 'undefined') {
                SimulationModule.updateConfig({
                    confidenceThreshold: settings.confidenceThreshold / 100
                });
            }
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
        detectFoodsViaWebSocket,
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