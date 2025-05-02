/**
 * Confidence Slider Modülü
 * Tespit hassasiyeti için slider yönetimi ve ayarlarını içerir
 */
const ConfidenceSliderModule = (function() {
    // Module private variables
    let sliderElement = null;
    let valueElement = null;
    let settings = {
        confidenceThreshold: 50 // Default value (%)
    };
    let onChangeCallback = null;

    /**
     * Modülü belirtilen elementler ve callback ile başlatır
     * @param {Object} config - Yapılandırma ayarları
     * @param {string} config.sliderId - Slider elementinin ID'si 
     * @param {string} config.valueId - Değer gösteren elementin ID'si
     * @param {number} config.initialValue - Başlangıç değeri (%)
     * @param {Function} config.onChange - Değişim callback fonksiyonu
     */
    const init = (config = {}) => {
        const { 
            sliderId = 'confidenceSlider', 
            valueId = 'thresholdValue',
            initialValue = 50,
            onChange = null
        } = config;

        // HTML elementlerini al
        sliderElement = document.getElementById(sliderId);
        valueElement = document.getElementById(valueId);
        
        // Callback fonksiyonunu kaydet
        onChangeCallback = onChange;

        if (!sliderElement || !valueElement) {
            console.error('Confidence slider: HTML elements not found!');
            return;
        }

        // Başlangıç değerini ayarla (% değerini 0-1 arasına çevir)
        settings.confidenceThreshold = initialValue;
        sliderElement.value = initialValue / 100;
        updateValueDisplay(initialValue);

        // Event listener ekle
        sliderElement.addEventListener('input', handleSliderChange);

        console.log('Confidence slider initialized with value:', initialValue);
    };

    /**
     * Slider değeri değiştiğinde çağrılır
     * @param {Event} event - Input event
     */
    const handleSliderChange = (event) => {
        const value = parseFloat(event.target.value);
        const percentValue = Math.round(value * 100);
        
        // Değeri güncelle
        settings.confidenceThreshold = percentValue;
        updateValueDisplay(percentValue);
        
        // Callback fonksiyonunu çağır
        if (typeof onChangeCallback === 'function') {
            onChangeCallback(percentValue);
        }
    };

    /**
     * Görüntülenen değeri günceller
     * @param {number} value - Gösterilecek değer (%)
     */
    const updateValueDisplay = (value) => {
        if (valueElement) {
            valueElement.textContent = `${value}%`;
        }
    };

    /**
     * Slider değerini programatik olarak günceller
     * @param {number} value - Yeni değer (%)
     */
    const setValue = (value) => {
        if (!sliderElement) return;
        
        // Değeri sınırla (0-100)
        const limitedValue = Math.min(100, Math.max(0, value));
        
        // Slider ve gösterge değerini güncelle
        settings.confidenceThreshold = limitedValue;
        sliderElement.value = limitedValue / 100;
        updateValueDisplay(limitedValue);
    };

    /**
     * Mevcut ayarları döndürür
     * @returns {Object} - Mevcut ayarlar
     */
    const getSettings = () => {
        return { ...settings };
    };

    // Public API
    return {
        init,
        setValue,
        getSettings
    };
})();

// CommonJS modülü olarak dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfidenceSliderModule;
} else if (typeof window !== 'undefined') {
    window.ConfidenceSliderModule = ConfidenceSliderModule;
}