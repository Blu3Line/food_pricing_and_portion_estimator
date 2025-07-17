/**
 * Basit Uygulama Konfigürasyonu
 * Tüm modüller bu global config'i kullanır
 */
window.AppConfig = {
    // Tek confidence threshold değeri (0-1 arası)
    confidenceThreshold: 0.7,
    
    // Porsiyon hesaplama mekanizması kontrolü
    portionCalculationEnabled: true,
    
    // Config'i güncelleme fonksiyonu
    setConfidenceThreshold: function(value) {
        // Değeri sınırla (0-1)
        this.confidenceThreshold = Math.min(1, Math.max(0, value));
        console.log('🎯 AppConfig: Confidence threshold güncellendi:', this.confidenceThreshold);
        
        this.saveToElectron();
    },
    
    // Porsiyon hesaplama durumunu güncelleme fonksiyonu
    setPortionCalculationEnabled: function(enabled) {
        this.portionCalculationEnabled = Boolean(enabled);
        console.log('⚖️ AppConfig: Porsiyon hesaplama durumu güncellendi:', this.portionCalculationEnabled);
        
        this.saveToElectron();
    },
    
    // Config'i Electron'a kaydetme fonksiyonu
    saveToElectron: function() {
        if (window.environment && window.environment.isElectron && window.electronAPI) {
            window.electronAPI.saveSettings({
                confidenceThreshold: this.confidenceThreshold,
                portionCalculationEnabled: this.portionCalculationEnabled,
                darkMode: false,
                cameraSetting: 'auto'
            }).catch(err => console.error('Config kaydedilemedi:', err));
        }
    },
    
    // Config'i Electron'dan yükle
    loadFromElectron: async function() {
        if (window.environment && window.environment.isElectron && window.electronAPI) {
            try {
                const settings = await window.electronAPI.getSettings();
                if (settings) {
                    if (settings.confidenceThreshold !== undefined) {
                        this.confidenceThreshold = settings.confidenceThreshold;
                    }
                    if (settings.portionCalculationEnabled !== undefined) {
                        this.portionCalculationEnabled = settings.portionCalculationEnabled;
                    }
                    console.log('📋 AppConfig: Electron\'dan yüklendi:', {
                        confidenceThreshold: this.confidenceThreshold,
                        portionCalculationEnabled: this.portionCalculationEnabled
                    });
                    return true;
                }
            } catch (error) {
                console.error('Electron config yüklenemedi:', error);
            }
        }
        console.log('📋 AppConfig: Default değerler kullanılıyor:', {
            confidenceThreshold: this.confidenceThreshold,
            portionCalculationEnabled: this.portionCalculationEnabled
        });
        return false;
    }
}; 