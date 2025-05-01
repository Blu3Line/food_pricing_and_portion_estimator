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
    
    // Public API
    return {
        init,
        activateTab
    };
})();

// CommonJS modülü olarak dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabsModule;
}