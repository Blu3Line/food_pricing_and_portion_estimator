/**
 * Yemek Tespitlerini Görselleştirme Modülü
 * YOLO çıktılarını görsel olarak göstermek için kullanılır
 */
const VisualizationModule = (function() {
    // Özel değişkenler
    let config = {
        boxLineWidth: 2,
        fontSize: 14,
        segmentOpacity: 0.3,
        classColors: {} // Sınıf renkleri için önbellek
    };
    
    /**
     * Modülü başlatır
     * @param {Object} options - Konfigürasyon seçenekleri
     * @returns {Object} - Modül API'si
     */
    const init = (options = {}) => {
        // Konfigürasyon seçeneklerini birleştir
        config = { ...config, ...options };
        
        return VisualizationModule;
    };
    
    /**
     * Canvas boyutlarını ayarlar
     * @param {HTMLCanvasElement} canvas - Hedef canvas
     * @param {number} width - Genişlik
     * @param {number} height - Yükseklik
     */
    const setCanvasSize = (canvas, width, height) => {
        if (!canvas) return;
        
        canvas.width = width;
        canvas.height = height;
    };
    
    /**
     * Tespit sonuçlarını canvas üzerine çizer
     * @param {HTMLCanvasElement} canvas - Hedef canvas
     * @param {Array} detections - Tespit sonuçları
     * @param {Object} options - İsteğe bağlı çizim ayarları
     */
    const renderDetections = (canvas, detections, options = {}) => {
        if (!canvas || !detections || !Array.isArray(detections)) return;
        
        // Lokal çizim ayarlarını oluştur
        const drawConfig = { ...config, ...options };
        
        const ctx = canvas.getContext('2d');
        
        // Her bir tespit için
        for (const detection of detections) {
            // Temel özellikleri çıkar
            const className = detection.class || 'unknown';
            const confidence = detection.confidence || 0;
            
            // Renk belirle
            const color = getColorForClass(className);
            
            // Bounding box çiz (bbox formatı [x1, y1, x2, y2] veya x, y, width, height formatında olabilir)
            if (detection.bbox) {
                let x, y, width, height;
                
                if (Array.isArray(detection.bbox) && detection.bbox.length === 4) {
                    // [x1, y1, x2, y2] formatı
                    const [x1, y1, x2, y2] = detection.bbox.map(v => Math.round(v));
                    x = x1;
                    y = y1;
                    width = x2 - x1;
                    height = y2 - y1;
                } else if (detection.bbox.x !== undefined) {
                    // {x, y, width, height} formatı
                    x = Math.round(detection.bbox.x);
                    y = Math.round(detection.bbox.y);
                    width = Math.round(detection.bbox.width);
                    height = Math.round(detection.bbox.height);
                } else if (detection.boundingBox) {
                    // Alternatif boundingBox prop
                    x = Math.round(detection.boundingBox.x);
                    y = Math.round(detection.boundingBox.y);
                    width = Math.round(detection.boundingBox.width);
                    height = Math.round(detection.boundingBox.height);
                } else {
                    continue; // Geçerli bbox yok
                }
                
                // Kutuyu çiz
                ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.lineWidth = drawConfig.boxLineWidth;
                ctx.strokeRect(x, y, width, height);
                
                // Sınıf etiketi çiz
                const label = `${className}: ${Math.round(confidence * 100)}%`;
                drawLabel(ctx, label, x, y, color, drawConfig);
            }
            
            // Segmentasyon poligonu çiz (eğer varsa)
            if (detection.segments && Array.isArray(detection.segments) && detection.segments.length > 2) {
                const segments = detection.segments;
                
                ctx.beginPath();
                ctx.moveTo(segments[0][0], segments[0][1]);
                
                for (let i = 1; i < segments.length; i++) {
                    ctx.lineTo(segments[i][0], segments[i][1]);
                }
                
                ctx.closePath();
                ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.lineWidth = drawConfig.boxLineWidth;
                ctx.stroke();
                
                // Yarı saydam dolgu
                ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${drawConfig.segmentOpacity})`;
                ctx.fill();
            }
        }
    };
    
    /**
     * Görüntü üzerine tespit sonuçlarını çizer
     * @param {HTMLImageElement} img - Hedef resim elementi
     * @param {Array} detections - Tespit sonuçları
     * @returns {Promise} - İşlem sonucu
     */
    const displayDetectionsOnImage = async (img, detections) => {
        return new Promise((resolve, reject) => {
            if (!img || !detections) {
                resolve(false);
                return;
            }
            
            try {
                // Orijinal boyutları al
                const width = img.naturalWidth || img.width;
                const height = img.naturalHeight || img.height;
                
                // Canvas oluştur ve resmi kopyala
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                
                // Resmin yüklü olduğundan emin ol
                if (img.complete) {
                    ctx.drawImage(img, 0, 0, width, height);
                    renderDetections(canvas, detections);
                    img.src = canvas.toDataURL('image/png');
                    resolve(true);
                } else {
                    // Resim henüz yüklenmediyse bekle
                    img.onload = function() {
                        ctx.drawImage(img, 0, 0, width, height);
                        renderDetections(canvas, detections);
                        img.src = canvas.toDataURL('image/png');
                        resolve(true);
                    };
                    
                    // Zaman aşımı için güvenlik kontrolü
                    setTimeout(() => {
                        if (!img.complete) {
                            reject(new Error('Resim yükleme zaman aşımı'));
                        }
                    }, 5000);
                }
            } catch (error) {
                console.error('Görüntüye tespit sonuçları eklenirken hata:', error);
                reject(error);
            }
        });
    };
    
    /**
     * Etiket çizer
     * @param {CanvasRenderingContext2D} ctx - Canvas bağlamı
     * @param {string} text - Etiket metni
     * @param {number} x - X koordinatı
     * @param {number} y - Y koordinatı
     * @param {Array} color - RGB renk dizisi
     * @param {Object} options - Çizim seçenekleri
     */
    const drawLabel = (ctx, text, x, y, color, options) => {
        const fontSize = options.fontSize || 14;
        ctx.font = `${fontSize}px Arial`;
        
        // Metin boyutlarını al
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize * 1.2;
        
        // Etiket arka planı
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.7)`;
        ctx.fillRect(x, y - textHeight, textWidth + 8, textHeight);
        
        // Etiket metni
        ctx.fillStyle = 'white';
        ctx.fillText(text, x + 4, y - textHeight / 3);
    };
    
    /**
     * Sınıf adına göre renk oluşturur
     * @param {string} className - Sınıf adı
     * @returns {Array} - RGB renk değerleri
     */
    const getColorForClass = (className) => {
        // Önbellekte varsa kullan
        if (config.classColors[className]) {
            return config.classColors[className];
        }
        
        // Basit hash fonksiyonu
        let hash = 0;
        for (let i = 0; i < className.length; i++) {
            hash = className.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // RGB değerleri oluştur (0-255 arası)
        const r = (hash & 0xFF);
        const g = ((hash >> 8) & 0xFF);
        const b = ((hash >> 16) & 0xFF);
        
        // Önbelleğe al
        config.classColors[className] = [r, g, b];
        
        return [r, g, b];
    };
    
    /**
     * Canvas'ı temizler
     * @param {HTMLCanvasElement} canvas - Temizlenecek canvas
     */
    const clearCanvas = (canvas) => {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    
    /**
     * Canvas'a bilgi mesajı ekler
     * @param {HTMLCanvasElement} canvas - Hedef canvas
     * @param {string} message - Gösterilecek mesaj
     * @param {Object} options - Gösterim seçenekleri
     */
    const displayMessage = (canvas, message, options = {}) => {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Varsayılan seçenekler
        const opt = {
            fontSize: options.fontSize || 16,
            color: options.color || 'white',
            bgColor: options.bgColor || 'rgba(0, 0, 0, 0.6)',
            padding: options.padding || 10,
            ...options
        };
        
        // Arka plan ekle
        ctx.fillStyle = opt.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Metni ekle
        ctx.font = `${opt.fontSize}px Arial`;
        ctx.fillStyle = opt.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    };
    
    // FPS ölçümü için değişkenler
    let lastFrameTime = 0;
    let frameCount = 0;
    let fps = 0;
    
    /**
     * FPS hesaplar ve gösterir
     * @param {HTMLCanvasElement} canvas - Hedef canvas
     */
    const calculateAndDisplayFPS = (canvas) => {
        if (!canvas) return;
        
        const currentTime = performance.now();
        frameCount++;
        
        // Her saniye FPS güncelle
        if (currentTime - lastFrameTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastFrameTime = currentTime;
        }
        
        // FPS göster
        const ctx = canvas.getContext('2d');
        ctx.font = '14px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        
        const fpsText = `FPS: ${fps}`;
        ctx.strokeText(fpsText, 10, 20);
        ctx.fillText(fpsText, 10, 20);
        
        return fps;
    };
    
    // Public API
    return {
        init,
        setCanvasSize,
        renderDetections,
        displayDetectionsOnImage,
        clearCanvas,
        displayMessage,
        calculateAndDisplayFPS,
        getColorForClass
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizationModule;
} else if (typeof window !== 'undefined') {
    window.VisualizationModule = VisualizationModule;
}