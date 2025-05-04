/**
 * Ana JavaScript Dosyası - Electron Versiyonu
 * WebSocket entegrasyonu ile güncellendi
 * SimulationModule entegrasyonu eklendi (otomatik mod)
 * Tüm modülleri birleştirir ve uygulamayı başlatır
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Yemek Tanıma Uygulaması Başlatılıyor...');
    
    // Sayfa tipini al
    const pageType = document.body.getAttribute('data-page-type');
    console.log(`Sayfa tipi: ${pageType}`);
    
    // Electron ortamı kontrolü
    const isElectron = window.environment && window.environment.isElectron;
    console.log(`Electron ortamı: ${isElectron ? 'Evet' : 'Hayır'}`);
    
    if (isElectron) {
        try {
            // Uygulama bilgilerini al
            const appInfo = await window.electronAPI.getAppInfo();
            console.log(`Uygulama versiyonu: ${appInfo.version}`, appInfo);
        } catch (error) {
            console.warn('Uygulama bilgileri alınamadı:', error);
        }
    }

    // Sayfa tipine göre uygun modülleri başlat
    if (pageType === 'home') {
        // Ana sayfada çalışacak modüller (kamera, yemek tanıma, vb.)
        console.log('Ana sayfa modülleri başlatılıyor...');

        if (typeof TabsModule !== 'undefined') {
            TabsModule.init();
        }

        // Simülasyon modülünü başlat (otomatik yedek mekanizma olarak çalışması için)
        let simulationModuleReady = false;
        if (typeof SimulationModule !== 'undefined') {
            SimulationModule.init({
                confidenceThreshold: 0.5,
                simulationDelay: 800
            });
            simulationModuleReady = true;
            console.log('Simülasyon modülü başlatıldı (otomatik yedekleme için)');
        }

        // WebSocket bağlantı durumu elementi
        const connectionStatusElement = document.getElementById('websocketStatus');
        
        // WebSocket Manager'ı başlat (varsa)
        let webSocketReady = false;
        
        if (typeof WebSocketManager !== 'undefined') {
            WebSocketManager.init({
                serverUrl: 'ws://localhost:8765',
                connectionStatusElement: connectionStatusElement,
                autoConnect: true, // Otomatik bağlanmayı dene
                onConnect: () => {
                    console.log('WebSocket bağlantısı kuruldu');
                    // Bağlantı kurulduğunda UI'ı güncelle
                    const wsConnectBtn = document.getElementById('wsConnectBtn');
                    if (wsConnectBtn) {
                        wsConnectBtn.innerHTML = '<i class="fas fa-plug"></i> Bağlantıyı Kes';
                        wsConnectBtn.classList.remove('btn-primary');
                        wsConnectBtn.classList.add('btn-danger');
                    }
                    
                    // Durum metnini güncelle
                    if (connectionStatusElement) {
                        const statusText = connectionStatusElement.querySelector('span:last-child');
                        if (statusText) {
                            statusText.textContent = 'Bağlantı Kuruldu';
                        }
                    }
                },
                onDisconnect: () => {
                    console.log('WebSocket bağlantısı kesildi');
                    // Bağlantı kesildiğinde UI'ı güncelle
                    const wsConnectBtn = document.getElementById('wsConnectBtn');
                    if (wsConnectBtn) {
                        wsConnectBtn.innerHTML = '<i class="fas fa-plug"></i> Bağlan';
                        wsConnectBtn.classList.remove('btn-danger');
                        wsConnectBtn.classList.add('btn-primary');
                    }
                    
                    // Durum metnini güncelle - simülasyon modülü hazırsa
                    if (connectionStatusElement && WebSocketManager.isSimulationReady()) {
                        const statusText = connectionStatusElement.querySelector('span:last-child');
                        if (statusText) {
                            statusText.textContent = 'Bağlantı Yok (Simülasyon Modu)';
                        }
                        connectionStatusElement.classList.remove('status-disconnected');
                        connectionStatusElement.classList.add('status-simulation');
                    }
                },
                onError: (error, type) => {
                    console.error(`WebSocket hatası (${type}):`, error);
                    
                    // Hata durumunda, eğer simülasyon modülü hazırsa bunu belirt
                    if (connectionStatusElement && WebSocketManager.isSimulationReady()) {
                        const statusText = connectionStatusElement.querySelector('span:last-child');
                        if (statusText) {
                            statusText.textContent = 'Bağlantı Hatası (Simülasyon Modu)';
                        }
                        connectionStatusElement.classList.remove('status-error');
                        connectionStatusElement.classList.add('status-simulation');
                    }
                }
            });
            
            // WebSocket bağlantı butonu
            const wsConnectBtn = document.getElementById('wsConnectBtn');
            if (wsConnectBtn) {
                wsConnectBtn.addEventListener('click', async () => {
                    if (WebSocketManager.isConnected()) {
                        await WebSocketManager.disconnect();
                    } else {
                        try {
                            await WebSocketManager.connect();
                        } catch (error) {
                            console.error('WebSocket bağlantı hatası:', error);
                            alert('WebSocket sunucusuna bağlanılamadı. Simülasyon modu otomatik olarak etkinleştirildi.');
                        }
                    }
                });
            }
            
            // Simülasyon modu butonu artık kullanılmıyor (otomatik olarak başlatılıyor kullanıcıya bırakılmıyor)
            const simulationToggleBtn = document.getElementById('simulationToggleBtn');
            if (simulationToggleBtn) {
                simulationToggleBtn.style.display = 'none';
            }
        }
        
        // Görselleştirme modülünü başlat (varsa)
        if (typeof VisualizationModule !== 'undefined') {
            VisualizationModule.init({
                boxLineWidth: 2,
                fontSize: 14,
                segmentOpacity: 0.3
            });
        }
        
        // Yemek tanıma modülünü başlat
        let foodDetectionModuleReady = false;
        if (typeof FoodDetectionModule !== 'undefined') {
            try {
                await FoodDetectionModule.init();
                foodDetectionModuleReady = true;
            } catch (error) {
                console.error('Yemek tanıma modülü başlatma hatası:', error);
            }
        }
        
        // Yemek detay modülünü başlat
        if (typeof FoodDetailsModule !== 'undefined') {
            FoodDetailsModule.init();
        }
        
        // Yemek listesi modülünü başlat ve seçim callback'i ayarla
        let foodListModuleReady = false;
        if (typeof FoodListModule !== 'undefined') {
            FoodListModule.init(function(selectedFood) {
                if (typeof FoodDetailsModule !== 'undefined') {
                    FoodDetailsModule.displayFoodDetails(selectedFood);
                }
            });
            foodListModuleReady = true;
        }
        
        // Confidence Slider modülünü başlat
        if (typeof ConfidenceSliderModule !== 'undefined') {
            // Yemek tanıma modülünden başlangıç değerini al
            let initialValue = 50; // Varsayılan değer
            
            if (foodDetectionModuleReady) {
                const settings = FoodDetectionModule.getSettings();
                initialValue = settings.confidenceThreshold;
            }
            
            // Slider modülünü başlat
            ConfidenceSliderModule.init({
                sliderId: 'confidenceSlider',
                valueId: 'thresholdValue',
                initialValue: initialValue,
                onChange: (value) => {
                    // Değer değiştiğinde yemek tanıma modülüne bildir
                    if (foodDetectionModuleReady) {
                        FoodDetectionModule.updateSettings({
                            confidenceThreshold: value
                        });
                    }
                }
            });
        }
        
        // Kamera modülünü başlat ve görüntü analiz callback'i ayarla
        if (typeof CameraModule !== 'undefined') {
            CameraModule.init(async function(imageDataOrResult) {
                // Yükleme durumunu göster
                const detectedItemsEl = document.getElementById('detectedItems');
                if (detectedItemsEl) {
                    detectedItemsEl.innerHTML = '<li class="loading-item"><div class="loading-spinner"></div> Yemekler tespit ediliyor...</li>';
                }
                
                // Yemek tespiti yap
                if (foodDetectionModuleReady) {
                    try {
                        // Doğrudan tanıma fonksiyonunu kullan
                        const detectedFoods = await FoodDetectionModule.detectFoodsFromImage(imageDataOrResult);
                        
                        // Tespit edilen yemekleri göster
                        if (foodListModuleReady) {
                            // Yemekleri göster
                            FoodListModule.displayFoods(detectedFoods);
                            
                            // Backend'den toplam değerleri kullanın
                            // Not: FoodListModule içinde public olarak updateTotals açık değil
                            // bu yüzden manuel olarak ekleyeceğiz
                            const totalPriceEl = document.getElementById('totalPrice');
                            const totalCaloriesEl = document.getElementById('totalCalories');
                            
                            if (totalPriceEl && imageDataOrResult.total_price !== undefined) {
                                totalPriceEl.textContent = imageDataOrResult.total_price.toFixed(2) + ' ₺';
                            }
                            
                            if (totalCaloriesEl && imageDataOrResult.total_calories !== undefined) {
                                totalCaloriesEl.textContent = imageDataOrResult.total_calories + ' kcal';
                            }
                        }
                    } catch (error) {
                        console.error('Yemek tespiti hatası:', error);
                        if (detectedItemsEl) {
                            detectedItemsEl.innerHTML = '<li class="error-item">Tespit sırasında bir hata oluştu. Lütfen tekrar deneyin.</li>';
                        }
                    }
                }
            }).catch(error => {
                console.error('Kamera modülü başlatma hatası:', error);
                alert('Kamera modülü başlatılamadı. Lütfen kamera erişiminizi kontrol edin.');
            });
        }
    } 
    
    // Diğer sayfa tipleri için başka koşullar eklenebilir
    
    console.log('Uygulama başlatıldı!');
    
    // Electron ortamında ek geri bildirim ve olay dinleyicileri ekle
    if (isElectron) {
        // Görüntü kaydetme butonu ekle
        const resultSection = document.getElementById('resultSection');
        if (resultSection) {
            const resultControls = resultSection.querySelector('.camera-controls');
            if (resultControls) {
                const saveButton = document.createElement('button');
                saveButton.className = 'btn btn-secondary';
                saveButton.innerHTML = '<i class="fas fa-save"></i> Görüntüyü Kaydet';
                saveButton.addEventListener('click', () => {
                    if (typeof CameraModule !== 'undefined') {
                        CameraModule.saveImage();
                    }
                });
                
                // Butonlar arasına margin ekleyelim
                saveButton.style.marginLeft = '10px';
                resultControls.appendChild(saveButton);
            }
        }
    }
});