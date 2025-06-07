/**
 * Yemek Tanıma Modülü - Sadeleştirilmiş Versiyon
 * WebSocket entegrasyonu içerir
 * Gereksiz Electron API referansları kaldırıldı
 */
const FoodDetectionModule = (function() {
    // WebSocket entegrasyonu ayarı
    let websocketEnabled = false;

    // Backend'den gelen toplam değerleri saklayan değişkenler
    let backendTotals = {
        totalPrice: 0,
        totalCalories: 0
    };

    /**
     * Modülü başlatır
     */
    const init = async () => {
        console.log("🍽️ FoodDetectionModule başlatıldı");
        
        // WebSocket entegrasyonunu kontrol et
        websocketEnabled = typeof WebSocketManager !== 'undefined';
        console.log(`WebSocket entegrasyonu: ${websocketEnabled ? 'Aktif' : 'Pasif'}`);
        

        
        return true;
    };

    /**
     * Görüntüden yemekleri tespit eder
     * @param {string|Object} imageDataOrResult - Base64 formatında resim verisi veya doğrudan tespit sonuçları
     * @returns {Promise} - Tespit edilen yemekler listesi ve backend toplam değerleri
     */
    const detectFoodsFromImage = async (imageDataOrResult) => {
        // Yükleme göstergesi
        console.log("Yemek tespit ediliyor...");
        
        // Gelen veri zaten işlenmiş bir sonuç mu kontrol et
        if (typeof imageDataOrResult === 'object' && imageDataOrResult !== null) {
            if (imageDataOrResult.success && Array.isArray(imageDataOrResult.data)) {
                console.log("Veri zaten işlenmiş, sonuçları doğrudan döndürüyorum");
                
                // Backend'den gelen toplam değerleri kaydet
                if (imageDataOrResult.total_price !== undefined) {
                    backendTotals.totalPrice = imageDataOrResult.total_price;
                }
                if (imageDataOrResult.total_calories !== undefined) {
                    backendTotals.totalCalories = imageDataOrResult.total_calories;
                }
                
                return processDetectionResults(imageDataOrResult.data);
            }
            else if (Array.isArray(imageDataOrResult)) {
                return imageDataOrResult;
            }
        }
        
        // 1. WebSocket ile tespit dene (bağlantı varsa)
        if (websocketEnabled && WebSocketManager.isConnected()) {
            try {
                console.log("WebSocket ile tespit deneniyor...");
                console.log("🎯 Gönderilecek confidence değeri:", AppConfig.confidenceThreshold);
                const response = await WebSocketManager.sendImage(
                    imageDataOrResult, 
                    'image', 
                    { confidence: AppConfig.confidenceThreshold }
                );
                
                if (response.success) {
                    console.log("WebSocket tespiti başarılı!");
                    
                    // Backend'den gelen toplam değerleri kaydet
                    if (response.total_price !== undefined) {
                        backendTotals.totalPrice = response.total_price;
                    }
                    if (response.total_calories !== undefined) {
                        backendTotals.totalCalories = response.total_calories;
                    }
                    
                    return processDetectionResults(response.data);
                }
            } catch (error) {
                console.warn("WebSocket ile tespit başarısız:", error.message);
            }
        }
        
        // WebSocket çalışmadıysa hata döndür
        console.error("WebSocket bağlantısı gerekli!");
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
        if (websocketEnabled && WebSocketManager.isConnected()) {
            try {
                const response = await WebSocketManager.sendImage(
                    frameData,
                    isRealtime ? 'webcam' : 'image',
                    { confidence: AppConfig.confidenceThreshold }
                );
                
                if (response.success) {
                    // Backend'den gelen toplam değerleri kaydet
                    if (response.total_price !== undefined) {
                        backendTotals.totalPrice = response.total_price;
                    }
                    if (response.total_calories !== undefined) {
                        backendTotals.totalCalories = response.total_calories;
                    }
                    
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
        
        // WebSocket çalışmadıysa hata döndür
        return {
            success: false,
            error: "WebSocket bağlantısı gerekli",
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
                // Dinamik porsiyon desteği - porsiyon bazlı ise portion_price, değilse price kullan
                price: foodInfo.portion_price || foodInfo.price || 0,
                basePrice: foodInfo.base_price || foodInfo.price || 0, // Temel fiyat (porsiyon=1 için)
                calories: foodInfo.calories || 0,
                confidence: Math.round(detection.confidence * 100), // Yüzdelik değer (0-100)
                // Porsiyon bilgileri
                portionBased: foodInfo.portion_based || false,
                portion: foodInfo.portion || 1.0,
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
            const confidenceThresholdPercent = AppConfig.confidenceThreshold * 100; // 0.7 -> 70
            if (detectedFood.confidence >= confidenceThresholdPercent) {
                processedResults.push(detectedFood);
            }
        }
        
        // Güven skoruna göre sırala (yüksekten düşüğe)
        return processedResults.sort((a, b) => b.confidence - a.confidence);
    };

    /**
     * Backend'den alınan toplam değerleri döndürür
     * @returns {Object} - Toplam fiyat ve kalori
     */
    const getBackendTotals = () => {
        return { ...backendTotals };
    };

    // Public API (artık kendi settings'i yok, ConfigManager kullanıyor)
    return {
        init,
        detectFoodsFromImage,
        detectFoodsViaWebSocket,
        getBackendTotals
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FoodDetectionModule;
} else if (typeof window !== 'undefined') {
    window.FoodDetectionModule = FoodDetectionModule;
}