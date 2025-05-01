/**
 * Ana JavaScript Dosyası - Electron Versiyonu
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
    
    // Tüm sayfalarda çalışan ortak modülleri başlat
    if (typeof TabsModule !== 'undefined') {
        TabsModule.init();
    }
    
    // Sayfa tipine göre uygun modülleri başlat
    if (pageType === 'home') {
        // Ana sayfada çalışacak modüller (kamera, yemek tanıma, vb.)
        console.log('Ana sayfa modülleri başlatılıyor...');
        
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
                        const detectedFoods = await FoodDetectionModule.detectFoodsFromImage(imageDataOrResult);
                        
                        // Tespit edilen yemekleri göster
                        if (foodListModuleReady) {
                            FoodListModule.displayFoods(detectedFoods);
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