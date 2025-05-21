/**
 * Simülasyon Modülü
 * WebSocket sunucusu olmadığında, sunucu yanıtlarını simüle eder
 * server_response_ex.json formatına uygun yanıtlar üretir
 */
const SimulationModule = (function() {
    // Yemek veritabanı
    const foodDatabase = {
        'çorba': {
            name: 'Ezogelin Çorbası',
            price: 15.00,
            calories: 120,
            portion_based: true,
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
            ]
        },
        'tavuk': {
            name: 'Izgara Tavuk',
            price: 45.00,
            calories: 250,
            portion_based: true,
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
            ]
        },
        'pilav': {
            name: 'Pirinç Pilavı',
            price: 20.00,
            calories: 180,
            portion_based: true,
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
            ]
        },
        'salata': {
            name: 'Mevsim Salatası',
            price: 25.00,
            calories: 80,
            portion_based: true,
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
            allergens: []
        },
        'makarna': {
            name: 'Napoliten Makarna',
            price: 30.00,
            calories: 320,
            portion_based: true,
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
            ]
        },
        'kuru_fasulye': {
            name: 'Kuru Fasulye',
            price: 30.00,
            calories: 220,
            portion_based: true,
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
            ]
        },
        'bulgur_pilav': {
            name: 'Bulgur Pilavı',
            price: 18.00,
            calories: 170,
            portion_based: true,
            nutrition: {
                protein: "4g",
                carbs: "32g",
                fat: "3g",
                fiber: "4g"
            },
            ingredients: [
                "Bulgur",
                "Soğan",
                "Domates salçası",
                "Zeytinyağı",
                "Baharatlar"
            ],
            allergens: [
                "Gluten"
            ]
        },
        'catal': {
            name: 'Çatal',
            price: 0.50,
            calories: 0,
            portion_based: false,
            nutrition: {
                protein: "0g",
                carbs: "0g",
                fat: "0g",
                fiber: "0g"
            },
            ingredients: [],
            allergens: []
        },
        'kasik': {
            name: 'Kaşık',
            price: 0.50,
            calories: 0,
            portion_based: false,
            nutrition: {
                protein: "0g",
                carbs: "0g",
                fat: "0g",
                fiber: "0g"
            },
            ingredients: [],
            allergens: []
        }
    };

    // Varsayılan konfigürasyon
    let config = {
        confidenceThreshold: 0.5,
        simulationDelay: 800 // ms cinsinden simülasyon gecikmesi
    };

    /**
     * Modülü başlatır
     * @param {Object} options - Konfigürasyon seçenekleri
     * @returns {Object} - Modül API'si
     */
    const init = (options = {}) => {
        // Konfigürasyon ayarlarını birleştir
        config = { ...config, ...options };
        
        console.log("Simülasyon Modülü başlatıldı:", config);
        
        return SimulationModule;
    };

    /**
     * Yapay tespit yanıtı oluşturur - server_response_ex.json formatına uyumlu
     * @param {Object} params - Tespit parametreleri
     * @returns {Promise<Object>} - Simüle edilmiş tespit yanıtı
     */
    const simulateDetection = (params = {}) => {
        return new Promise((resolve) => {
            // Simülasyon gecikmesi ekle
            setTimeout(() => {
                // Rastgele 1-4 yemek tespiti yap
                const numberOfDetections = Math.floor(Math.random() * 4) + 1;
                const foodKeys = Object.keys(foodDatabase);
                const detectedItems = [];
                let totalPrice = 0;
                let totalCalories = 0;
                
                // Her bir tespit için
                for (let i = 0; i < numberOfDetections; i++) {
                    // Rastgele bir yemek türü seç
                    const randomIndex = Math.floor(Math.random() * foodKeys.length);
                    const foodKey = foodKeys[randomIndex];
                    const foodData = { ...foodDatabase[foodKey] }; // Kopyasını al, orijinali değiştirme
                    
                    // Rastgele güven skoru (%70-97 arası)
                    const confidence = (Math.floor(Math.random() * 28) + 70) / 100;
                    
                    // Confidence threshold kontrolü
                    if (confidence < config.confidenceThreshold) {
                        continue; // Eşik değerin altındaki tespitleri atla
                    }
                    
                    // Rastgele bounding box oluştur
                    const x1 = Math.floor(Math.random() * 800) + 100;
                    const y1 = Math.floor(Math.random() * 400) + 100;
                    const width = Math.floor(Math.random() * 200) + 100;
                    const height = Math.floor(Math.random() * 150) + 100;
                    const x2 = x1 + width;
                    const y2 = y1 + height;
                    
                    // Simüle edilmiş segmentasyon (basit köşe noktaları)
                    const segments = [
                        [x1, y1],
                        [x2, y1],
                        [x2, y2],
                        [x1, y2],
                        [x1, y1]
                    ];
                    
                    // Dinamik porsiyon hesaplaması
                    let foodInfo = {};
                    if (foodData.portion_based) {
                        // Rastgele porsiyon - 0.5, 1.0, 1.5, 2.0, 2.5, 3.0 arasından
                        const portionValues = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
                        const portion = portionValues[Math.floor(Math.random() * portionValues.length)];
                        
                        // Temel fiyat
                        const basePrice = foodData.price;
                        
                        // Porsiyon fiyatı
                        const portionPrice = basePrice * portion;
                        
                        // Kalori de porsiyon bazlı değişir
                        const portionCalories = Math.round(foodData.calories * portion);
                        
                        // Besin değerlerini porsiyona göre ölçeklendir
                        const scaledNutrition = {};
                        for (const [key, value] of Object.entries(foodData.nutrition)) {
                            // "10g" formatındaki değeri sayı ve birim olarak parçala
                            const match = value.match(/^([\d.]+)(.*)$/);
                            if (match) {
                                const numValue = parseFloat(match[1]);
                                const unit = match[2];
                                // Sayısal değeri porsiyon ile çarp ve formatla
                                scaledNutrition[key] = (numValue * portion).toFixed(1) + unit;
                            } else {
                                scaledNutrition[key] = value; // Parçalanamıyorsa orijinali kullan
                            }
                        }
                        
                        // Food info objesini oluştur
                        foodInfo = {
                            name: foodData.name,
                            portion_based: true,
                            portion: portion,
                            base_price: basePrice,
                            portion_price: portionPrice,
                            price: portionPrice, // Eski API uyumluluğu için
                            calories: portionCalories,
                            nutrition: scaledNutrition,
                            ingredients: foodData.ingredients,
                            allergens: foodData.allergens
                        };
                        
                        // Toplam hesaplamalar için porsiyon fiyatını kullan
                        totalPrice += portionPrice;
                        totalCalories += portionCalories;
                    } else {
                        // Porsiyon bazlı olmayan ürünler için normal bilgileri kullan
                        foodInfo = {
                            name: foodData.name,
                            portion_based: false,
                            portion: 1.0,
                            price: foodData.price,
                            calories: foodData.calories,
                            nutrition: foodData.nutrition,
                            ingredients: foodData.ingredients,
                            allergens: foodData.allergens
                        };
                        
                        // Toplam hesaplamalar
                        totalPrice += foodData.price;
                        totalCalories += foodData.calories;
                    }
                    
                    // Her bir tespit için nesne oluştur
                    const detectedItem = {
                        class: foodKey.replace(/_/g, ' '),
                        confidence: confidence,
                        bbox: [x1, y1, x2, y2],
                        segments: segments,
                        food_info: foodInfo
                    };
                    
                    detectedItems.push(detectedItem);
                }
                
                // İşleme süresini simüle et (gerçekçi değerler - 0.05-0.2 saniye arası)
                const processingTime = Math.random() * 0.15 + 0.05;
                
                // WebSocket yanıt formatına uygun yanıt
                const response = {
                    success: true,
                    data: detectedItems,
                    total_price: Math.round(totalPrice * 100) / 100,
                    total_calories: totalCalories,
                    processing_time: processingTime
                };
                
                resolve(response);
            }, config.simulationDelay);
        });
    };

    /**
     * Gerçek zamanlı kamera akışı için simülasyon
     * @param {Object} params - Tespit parametreleri
     * @returns {Promise<Object>} - Simüle edilmiş tespit yanıtı
     */
    const simulateRealtimeDetection = (params = {}) => {
        // Gerçek zamanlı tespitte güvenlik skorları genelde daha düşük olur
        // ve daha az nesne tespit edilir
        return new Promise((resolve) => {
            setTimeout(() => {
                // Gerçek zamanlı modda daha az tespit
                const numberOfDetections = Math.floor(Math.random() * 2) + 1;
                const foodKeys = Object.keys(foodDatabase);
                const detectedItems = [];
                let totalPrice = 0;
                let totalCalories = 0;
                
                for (let i = 0; i < numberOfDetections; i++) {
                    const randomIndex = Math.floor(Math.random() * foodKeys.length);
                    const foodKey = foodKeys[randomIndex];
                    const foodData = foodDatabase[foodKey];
                    
                    // Gerçek zamanlı modda güven skorları daha düşük
                    const confidence = (Math.floor(Math.random() * 20) + 60) / 100;
                    
                    if (confidence < config.confidenceThreshold) {
                        continue; // Eşik değerin altındaki tespitleri atla
                    }
                    
                    // Rastgele bounding box oluştur - gerçek zamanlıda daha fazla değişkenlik
                    const x1 = Math.floor(Math.random() * 800) + 100;
                    const y1 = Math.floor(Math.random() * 400) + 100;
                    const width = Math.floor(Math.random() * 200) + 100;
                    const height = Math.floor(Math.random() * 150) + 100;
                    const x2 = x1 + width;
                    const y2 = y1 + height;
                    
                    // Basit segmentasyon
                    const segments = [
                        [x1, y1],
                        [x2, y1],
                        [x2, y2],
                        [x1, y2],
                        [x1, y1]
                    ];
                    
                    // Her bir tespit için nesne oluştur
                    const detectedItem = {
                        class: foodKey.replace(/_/g, ' '),
                        confidence: confidence,
                        bbox: [x1, y1, x2, y2],
                        segments: segments,
                        food_info: {
                            name: foodData.name,
                            price: foodData.price,
                            calories: foodData.calories,
                            nutrition: foodData.nutrition,
                            ingredients: foodData.ingredients,
                            allergens: foodData.allergens
                        }
                    };
                    
                    detectedItems.push(detectedItem);
                    
                    totalPrice += foodData.price;
                    totalCalories += foodData.calories;
                }
                
                // Gerçek zamanlı işleme daha hızlı olur genelde
                const processingTime = Math.random() * 0.08 + 0.02;
                
                const response = {
                    success: true,
                    data: detectedItems,
                    total_price: totalPrice,
                    total_calories: totalCalories,
                    processing_time: processingTime
                };
                
                resolve(response);
            }, config.simulationDelay / 2); // Gerçek zamanlı için daha kısa gecikme
        });
    };

    /**
     * WebSocket bağlantısını simüle eder
     * @returns {Promise<Object>} - Bağlantı sonucu
     */
    const simulateConnection = () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.1; // %90 başarı olasılığı
                
                if (success) {
                    resolve({
                        success: true,
                        message: "Simüle edilmiş WebSocket bağlantısı kuruldu",
                        server_info: {
                            version: "1.0.0",
                            model: "yolov8n.pt",
                            supported_formats: ["jpg", "jpeg", "png"],
                            max_image_size: 1920
                        }
                    });
                } else {
                    resolve({
                        success: false,
                        error: "Bağlantı hatası: Simüle edilmiş sunucu yanıt vermiyor"
                    });
                }
            }, 500); // Bağlantı gecikme simülasyonu
        });
    };

    /**
     * WebSocket bağlantısı kesmeyi simüle eder
     * @returns {Promise<Object>} - Bağlantıyı kesme sonucu
     */
    const simulateDisconnection = () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    message: "Bağlantı başarıyla kesildi"
                });
            }, 200);
        });
    };

    /**
     * Konfigürasyonu günceller
     * @param {Object} newConfig - Yeni konfigürasyon ayarları
     */
    const updateConfig = (newConfig = {}) => {
        config = { ...config, ...newConfig };
        console.log("Simülasyon konfigürasyonu güncellendi:", config);
    };

    // Public API
    return {
        init,
        simulateDetection,
        simulateRealtimeDetection,
        simulateConnection,
        simulateDisconnection,
        updateConfig,
        getConfig: () => ({ ...config })
    };
})();

// CommonJS ve ES module uyumluluğu sağla
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationModule;
} else if (typeof window !== 'undefined') {
    window.SimulationModule = SimulationModule;
}