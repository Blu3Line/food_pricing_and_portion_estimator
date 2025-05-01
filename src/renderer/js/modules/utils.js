/**
 * Yardımcı İşlevler Modülü
 */
const Utils = (function() {
    /**
     * DOM elementini seçer
     * @param {string} selector - CSS seçici
     * @returns {Element} - DOM elementi
     */
    const select = (selector) => document.querySelector(selector);

    /**
     * Tüm eşleşen DOM elementlerini seçer
     * @param {string} selector - CSS seçici
     * @returns {NodeList} - DOM elementleri listesi
     */
    const selectAll = (selector) => document.querySelectorAll(selector);

    /**
     * Para birimi formatı
     * @param {number} price - Formatlanacak fiyat
     * @returns {string} - Formatlanmış fiyat
     */
    const formatCurrency = (price) => {
        return price.toFixed(2) + ' ₺';
    };

    /**
     * Rastgele sayı üretir
     * @param {number} min - Minimum değer
     * @param {number} max - Maximum değer
     * @returns {number} - Rastgele tam sayı
     */
    const randomInt = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1) + min);
    };

    /**
     * Rastgele ondalıklı sayı üretir
     * @param {number} min - Minimum değer
     * @param {number} max - Maximum değer
     * @param {number} decimalPlaces - Ondalık basamak sayısı
     * @returns {number} - Rastgele ondalıklı sayı
     */
    const randomFloat = (min, max, decimalPlaces = 2) => {
        const rand = Math.random() * (max - min) + min;
        const power = Math.pow(10, decimalPlaces);
        return Math.round(rand * power) / power;
    };

    /**
     * Dizideki elemanı rastgele seçer
     * @param {Array} array - Dizi
     * @returns {*} - Rastgele seçilen eleman
     */
    const randomArrayElement = (array) => {
        return array[Math.floor(Math.random() * array.length)];
    };

    /**
     * DOM elementine event listener ekler
     * @param {string|Element} element - Element veya CSS seçici
     * @param {string} event - Event tipi
     * @param {Function} callback - Callback fonksiyonu
     */
    const addEventToElement = (element, event, callback) => {
        const el = typeof element === 'string' ? select(element) : element;
        if (el) {
            el.addEventListener(event, callback);
        }
    };

    /**
     * Belirli CSS sınıfı içeren tüm elementlere event listener ekler
     * @param {string} className - CSS sınıf adı
     * @param {string} event - Event tipi
     * @param {Function} callback - Callback fonksiyonu
     */
    const addEventToClass = (className, event, callback) => {
        const elements = selectAll('.' + className);
        elements.forEach(element => {
            element.addEventListener(event, callback);
        });
    };

    /**
     * HTML içeriği güvenli bir şekilde ayarlar (XSS önleme)
     * @param {Element} element - DOM elementi
     * @param {string} html - HTML içeriği
     */
    const setHTML = (element, html) => {
        element.innerHTML = DOMPurify ? DOMPurify.sanitize(html) : html;
    };

    /**
     * DOM elementini gösterir
     * @param {Element} element - DOM elementi
     * @param {string} displayType - display özelliği
     */
    const showElement = (element, displayType = 'block') => {
        element.style.display = displayType;
    };

    /**
     * DOM elementini gizler
     * @param {Element} element - DOM elementi
     */
    const hideElement = (element) => {
        element.style.display = 'none';
    };

    // Public API
    return {
        select,
        selectAll,
        formatCurrency,
        randomInt,
        randomFloat,
        randomArrayElement,
        addEventToElement,
        addEventToClass,
        setHTML,
        showElement,
        hideElement
    };
})();

// CommonJS modülü olarak dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}