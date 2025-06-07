/**
 * Basit Uygulama Konfigürasyonu
 * Tüm modüller bu global config'i kullanır
 */
window.AppConfig = {
    // Tek confidence threshold değeri (0-1 arası)
    confidenceThreshold: 0.7,
    
    // Config'i güncelleme fonksiyonu
    setConfidenceThreshold: function(value) {
        // Değeri sınırla (0-1)
        this.confidenceThreshold = Math.min(1, Math.max(0, value));
        console.log('🎯 AppConfig: Confidence threshold güncellendi:', this.confidenceThreshold);
        
        // Electron'a kaydet
        if (window.environment && window.environment.isElectron && window.electronAPI) {
            window.electronAPI.saveSettings({
                confidenceThreshold: this.confidenceThreshold,
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
                if (settings && settings.confidenceThreshold !== undefined) {
                    this.confidenceThreshold = settings.confidenceThreshold;
                    console.log('📋 AppConfig: Electron\'dan yüklendi:', this.confidenceThreshold);
                    return true;
                }
            } catch (error) {
                console.error('Electron config yüklenemedi:', error);
            }
        }
        console.log('📋 AppConfig: Default değer kullanılıyor:', this.confidenceThreshold);
        return false;
    }
}; 