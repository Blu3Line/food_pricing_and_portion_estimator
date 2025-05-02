/**
 * Görselleştirme Modülü
 * YOLO tespit sonuçlarını görselleştirmek için kullanılır
 */
const VisualizationModule = (function() {
    // Özel değişkenler
    let settings = {
        boxLineWidth: 2,
        fontFamily: 'Arial',
        fontSize: 14,
        segmentOpacity: 0.3,
        showBoxes: true,
        showSegments: true,
        showLabels: true
    };

    /**
     * Modülü başlatır
     * @param {Object} options - Görselleştirme ayarları
     */
    const init = (options = {}) => {
        // Ayarları güncelle
        Object.assign(settings, options);
        console.log('Görselleştirme modülü başlatıldı', settings);
        return true;
    };

    /**
     * Tespit sonuçlarını canvas üzerinde görselleştirir
     * @param {HTMLCanvasElement|string} canvas - Canvas elementi veya ID'si
     * @param {Array} detections - Tespit sonuçları listesi
     * @param {Object} options - Görselleştirme seçenekleri
     */
    const renderDetections = (canvas, detections, options = {}) => {
        // Canvas elementini al
        if (typeof canvas === 'string') {
            canvas = document.getElementById(canvas);
            if (!canvas) {
                console.error(`Canvas elementi bulunamadı: #${canvas}`);
                return false;
            }
        }

        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            console.error('Geçerli bir canvas elementi belirtilmedi');
            return false;
        }

        if (!detections || !Array.isArray(detections) || detections.length === 0) {
            console.log('Görselleştirilecek tespit bulunamadı');
            return false;
        }

        // Canvas context'ini al
        const ctx = canvas.getContext('2d');
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Geçici ayarları birleştir
        const renderSettings = { ...settings, ...options };
        
        // Her bir tespiti çiz
        detections.forEach(detection => {
            drawDetection(ctx, detection, renderSettings);
        });
        
        return true;
    };
    
    /**
     * Bir görüntü üzerine tespit sonuçlarını çizer ve görüntüyü döndürür
     * @param {HTMLImageElement|string} image - Görüntü elementi veya kaynak URL'si
     * @param {Array} detections - Tespit sonuçları listesi
     * @param {Object} options - Görselleştirme seçenekleri
     * @returns {Promise<string>} - İşlenmiş görüntünün dataURL'si
     */
    const renderDetectionsOnImage = (image, detections, options = {}) => {
        return new Promise((resolve, reject) => {
            try {
                // Görüntü elementini al veya oluştur
                let imgElement;
                
                if (typeof image === 'string') {
                    // String ise, bu bir URL veya data URL'dir
                    imgElement = new Image();
                    imgElement.onload = () => continueProcessing(imgElement);
                    imgElement.onerror = () => reject(new Error('Görüntü yüklenemedi'));
                    imgElement.src = image;
                } else if (image instanceof HTMLImageElement) {
                    // Zaten bir görüntü elementi ise
                    imgElement = image;
                    
                    // Görüntü yüklü mü kontrol et
                    if (imgElement.complete) {
                        continueProcessing(imgElement);
                    } else {
                        imgElement.onload = () => continueProcessing(imgElement);
                        imgElement.onerror = () => reject(new Error('Görüntü yüklenemedi'));
                    }
                } else {
                    reject(new Error('Geçerli bir görüntü elementi belirtilmedi'));
                }
                
                // Görüntü yüklendikten sonra işleme devam et
                function continueProcessing(img) {
                    // Geçici canvas oluştur
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    // Görüntüyü canvas'a çiz
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Geçici ayarları birleştir
                    const renderSettings = { ...settings, ...options };
                    
                    // Her bir tespiti çiz
                    if (detections && detections.length > 0) {
                        detections.forEach(detection => {
                            drawDetection(ctx, detection, renderSettings);
                        });
                    }
                    
                    // İşlenmiş canvas'ı dataURL olarak döndür
                    resolve(canvas.toDataURL('image/png'));
                }
            } catch (error) {
                reject(error);
            }
        });
    };
    
    /**
     * Bir görüntü üzerine tespit sonuçlarını çizer ve görüntüyü bir elementte gösterir
     * @param {HTMLImageElement} targetElement - Hedef görüntü elementi
     * @param {Array} detections - Tespit sonuçları listesi
     * @param {Object} options - Görselleştirme seçenekleri
     */
    const displayDetectionsOnImage = async (targetElement, detections, options = {}) => {
        try {
            if (!targetElement || !(targetElement instanceof HTMLImageElement)) {
                console.error('Geçerli bir görüntü elementi belirtilmedi');
                return false;
            }
            
            // Görüntüyü işle
            const dataUrl = await renderDetectionsOnImage(targetElement.src, detections, options);
            
            // Görüntüyü güncelle
            targetElement.src = dataUrl;
            
            return true;
        } catch (error) {
            console.error('Görüntü işlenirken hata oluştu:', error);
            return false;
        }
    };
    
    /**
     * Tespit nesnesi üzerinde tek bir tespiti çizer
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     * @param {Object} detection - Tespit nesnesi
     * @param {Object} options - Görselleştirme seçenekleri
     */
    const drawDetection = (ctx, detection, options) => {
        // Tespitte gerekli bilgiler var mı kontrol et
        if (!detection || !detection.class) return;
        
        // Tüm göstergeleri gizlemek istersek
        if (!options.showBoxes && !options.showSegments && !options.showLabels) return;
        
        // Renk oluştur
        const color = getColorForClass(detection.class);
        
        // Bounding box'ı çiz
        if (options.showBoxes && detection.bbox && detection.bbox.length === 4) {
            drawBoundingBox(ctx, detection.bbox, color, options);
        }
        
        // Segmentasyon polygon'unu çiz
        if (options.showSegments && detection.segments && detection.segments.length > 2) {
            drawSegmentPolygon(ctx, detection.segments, color, options);
        }
        
        // Etiketi çiz
        if (options.showLabels && detection.bbox && detection.bbox.length === 4) {
            drawLabel(ctx, detection, color, options);
        }
    };
    
    /**
     * Bounding box çizer
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     * @param {Array} bbox - Bounding box koordinatları [x1, y1, x2, y2]
     * @param {Array} color - RGB renk değerleri [r, g, b]
     * @param {Object} options - Görselleştirme seçenekleri
     */
    const drawBoundingBox = (ctx, bbox, color, options) => {
        const [x1, y1, x2, y2] = bbox;
        
        ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.lineWidth = options.boxLineWidth;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    };
    
    /**
     * Segmentasyon polygonunu çizer
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     * @param {Array} segments - Segment noktaları [[x1, y1], [x2, y2], ...]
     * @param {Array} color - RGB renk değerleri [r, g, b]
     * @param {Object} options - Görselleştirme seçenekleri
     */
    const drawSegmentPolygon = (ctx, segments, color, options) => {
        if (segments.length < 3) return; // En az 3 nokta gerekli
        
        ctx.beginPath();
        
        // İlk noktaya git
        ctx.moveTo(segments[0][0], segments[0][1]);
        
        // Diğer noktaları dolaş
        for (let i = 1; i < segments.length; i++) {
            ctx.lineTo(segments[i][0], segments[i][1]);
        }
        
        // Poligonu kapat
        ctx.closePath();
        
        // Kenar çizgisi
        ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.lineWidth = options.boxLineWidth;
        ctx.stroke();
        
        // Dolgu
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${options.segmentOpacity})`;
        ctx.fill();
    };
    
    /**
     * Tespit etiketi çizer
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     * @param {Object} detection - Tespit nesnesi
     * @param {Array} color - RGB renk değerleri [r, g, b]
     * @param {Object} options - Görselleştirme seçenekleri
     */
    const drawLabel = (ctx, detection, color, options) => {
        const [x1, y1] = detection.bbox;
        
        // Etiket bilgisini hazırla
        const confidence = detection.confidence || 0;
        const label = `${detection.class}: ${confidence.toFixed(1)}%`;
        
        // Metin stili
        ctx.font = `${options.fontSize}px ${options.fontFamily}`;
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        
        // Etiketin konumu (sanal boyutları aşmaması için kontrol et)
        const y = y1 > 20 ? y1 - 5 : y1 + 20;
        
        // Metni çiz
        ctx.fillText(label, x1, y);
    };
    
    /**
     * Bir sınıf adı için renk oluşturur
     * @param {string} className - Sınıf adı
     * @returns {Array} - RGB renk değerleri [r, g, b]
     */
    const getColorForClass = (className) => {
        // Basit hash fonksiyonu
        let hash = 0;
        for (let i = 0; i < className.length; i++) {
            hash = className.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // RGB değerleri oluştur (0-255 arası)
        const r = (hash & 0xFF);
        const g = ((hash >> 8) & 0xFF);
        const b = ((hash >> 16) & 0xFF);
        
        return [r, g, b];
    };
    
    /**
     * Canvas'ı temizler
     * @param {HTMLCanvasElement|string} canvas - Canvas elementi veya ID'si
     */
    const clearCanvas = (canvas) => {
        // Canvas elementini al
        if (typeof canvas === 'string') {
            canvas = document.getElementById(canvas);
            if (!canvas) {
                console.error(`Canvas elementi bulunamadı: #${canvas}`);
                return false;
            }
        }

        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            console.error('Geçerli bir canvas elementi belirtilmedi');
            return false;
        }
        
        // Canvas'ı temizle
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        return true;
    };
    
    /**
     * Canvas boyutunu ayarlar
     * @param {HTMLCanvasElement|string} canvas - Canvas elementi veya ID'si
     * @param {number} width - Genişlik
     * @param {number} height - Yükseklik
     */
    const setCanvasSize = (canvas, width, height) => {
        // Canvas elementini al
        if (typeof canvas === 'string') {
            canvas = document.getElementById(canvas);
            if (!canvas) {
                console.error(`Canvas elementi bulunamadı: #${canvas}`);
                return false;
            }
        }

        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            console.error('Geçerli bir canvas elementi belirtilmedi');
            return false;
        }
        
        // Canvas boyutlarını ayarla
        canvas.width = width;
        canvas.height = height;
        
        return true;
    };

    // Public API
    return {
        init,
        renderDetections,
        renderDetectionsOnImage,
        displayDetectionsOnImage,
        clearCanvas,
        setCanvasSize,
        getColorForClass
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizationModule;
} else if (typeof window !== 'undefined') {
    window.VisualizationModule = VisualizationModule;
}