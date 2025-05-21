/**
 * Sekme İşlevselliği Modülü
 */
const TabsModule = (function() {
    /**
     * Sekmeleri başlatır
     */
    const init = () => {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        if (tabButtons.length === 0) return;
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const tabContainer = this.closest('.tabs').parentElement;
                const tabId = this.dataset.tab;
                
                // Tüm sekme butonlarından active sınıfını kaldır
                tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Tüm sekme içeriklerinden active sınıfını kaldır
                tabContainer.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Tıklanan sekme butonuna ve içeriğine active sınıfı ekle
                this.classList.add('active');
                
                const targetContent = tabContainer.querySelector(`#${tabId}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    };
    
    /**
     * Belirli bir sekmeyi aktifleştirir
     * @param {string} tabId - Sekme ID'si
     * @param {Element} container - İsteğe bağlı konteyner (belirtilmezse tüm dokümanda arar)
     */
    const activateTab = (tabId, container = document) => {
        const tabButton = container.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (tabButton) {
            tabButton.click();
        }
    };
    
    /**
     * Kamera modülü için özel sekme yönetimi
     * @param {string} tabId - Tab ID ('photo', 'upload', 'realtime')
     * @param {Object} options - Sekme değiştirme seçenekleri 
     * @param {Function} options.onPhotoStreamStop - Fotoğraf akışı durduğunda çağrılacak fonksiyon
     * @param {Function} options.onRealtimeStreamStop - Gerçek zamanlı akış durduğunda çağrılacak fonksiyon
     * @param {Function} options.onTabChange - Sekme değiştiğinde çağrılacak fonksiyon
     * @returns {string} - Aktifleştirilen sekmenin element ID'si
     */
    const switchCameraTab = (tabId, options = {}) => {
        const { onPhotoStreamStop, onRealtimeStreamStop, onTabChange } = options;
        
        // Akışları durdurma fonksiyonlarını çağır (eğer varsa ve gerekiyorsa)
        if (onPhotoStreamStop) onPhotoStreamStop();
        if (onRealtimeStreamStop) onRealtimeStreamStop();
        
        // Tüm tabları ve içeriklerini gizle
        const tabs = document.querySelectorAll('.camera-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const tabContents = document.querySelectorAll('.camera-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        
        // Sonuç bölümünü gizle
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'none';
        
        // Doğru ID'yi belirle
        let tabElementId;
        switch(tabId) {
            case 'photo':
                tabElementId = 'takePhotoTab';
                break;
            case 'upload':
                tabElementId = 'uploadImageTab';
                break;
            case 'realtime':
                tabElementId = 'realTimeTab';
                break;
            default:
                tabElementId = 'takePhotoTab';
        }
        
        // Seçilen tabı ve içeriğini göster
        const selectedTab = document.getElementById(tabElementId);
        const selectedContent = document.getElementById(`${tabId}TabContent`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.style.display = 'block';
        
        // Tab değişikliği callback'ini çağır (eğer varsa)
        if (onTabChange) onTabChange(tabId);
        
        return tabElementId;
    };
    
    /**
     * Kamera sonuç bölümünü gösterir
     */
    const showCameraResult = () => {
        // Tüm tab içerikleri gizle
        const tabContents = document.querySelectorAll('.camera-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        
        // Sonuç bölümünü göster
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'block';
    };
    
    /**
     * Kamera sonuç bölümünü gizler
     */
    const hideCameraResult = () => {
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'none';
    };
    
    /**
     * Belirli bir kamera tabını gösterir
     * @param {string} tabId - Tab ID ('photo', 'upload', 'realtime')
     */
    const showCameraTab = (tabId) => {
        const tabContent = document.getElementById(`${tabId}TabContent`);
        if (tabContent) tabContent.style.display = 'block';
        
        // Doğru ID'yi belirle
        let tabElementId;
        switch(tabId) {
            case 'photo':
                tabElementId = 'takePhotoTab';
                break;
            case 'upload':
                tabElementId = 'uploadImageTab';
                break;
            case 'realtime':
                tabElementId = 'realTimeTab';
                break;
            default:
                tabElementId = 'takePhotoTab';
        }
        
        const tabButton = document.getElementById(tabElementId);
        if (tabButton) tabButton.classList.add('active');
    };
    
    // Public API
    return {
        init,
        activateTab,
        switchCameraTab,
        showCameraResult,
        hideCameraResult,
        showCameraTab
    };
})();

// CommonJS modülü olarak dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabsModule;
}