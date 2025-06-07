/**
 * WebSocket İletişim Modülü
 * YOLO sunucusuyla websocket iletişimini yöneten modül

 */
const WebSocketManager = (function() {
    // Özel değişkenler
    let socket = null;
    let isConnected = false;
    let isConnecting = false;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 3; // Maksimum yeniden bağlantı denemesi
    let reconnectInterval = 2000; // ms
    let reconnectTimeoutId = null;
    let serverUrl = 'ws://localhost:8765'; // Varsayılan URL
    
    // Event callback'leri
    let onConnectCallback = null;
    let onDisconnectCallback = null;
    let onErrorCallback = null;
    let onMessageCallback = null;
    let onReconnectCallback = null;
    
    // Bağlantı durumu göstergesi
    let connectionStatusElement = null;
    

    
    /**
     * WebSocket Manager'ı başlatır
     * @param {Object} config - Yapılandırma ayarları
     * @returns {boolean} - Başlatma başarılı mı?
     */
    const init = (config = {}) => {
        // Konfigürasyon ayarlarını uygula
        if (config.serverUrl) serverUrl = config.serverUrl;
        if (config.maxReconnectAttempts) maxReconnectAttempts = config.maxReconnectAttempts;
        if (config.reconnectInterval) reconnectInterval = config.reconnectInterval;
        
        // Callback fonksiyonlarını ayarla
        onConnectCallback = config.onConnect || null;
        onDisconnectCallback = config.onDisconnect || null;
        onErrorCallback = config.onError || null;
        onMessageCallback = config.onMessage || null;
        onReconnectCallback = config.onReconnect || null;
        
        // Bağlantı durumu göstergesi
        connectionStatusElement = config.connectionStatusElement || null;
        

        
        // Otomatik bağlantı yapılandırması
        if (config.autoConnect === true) {
            connect().catch(err => {
                console.error('Otomatik bağlantı hatası:', err);
                updateConnectionStatus('disconnected', 'Bağlantı Başarısız');
            });
        } else {
            updateConnectionStatus('disconnected', 'Bağlantı Kesildi');
        }
        
        return true;
    };
    

    
    /**
     * WebSocket sunucusuna bağlanır
     * @returns {Promise} - Bağlantı sonucu
     */
    const connect = async () => {
        // Zaten bağlı veya bağlanıyor durumunu kontrol et
        if (isConnected) {
            console.log('Zaten bağlı');
            return Promise.resolve(true);
        }
        
        if (isConnecting) {
            console.log('Bağlantı devam ediyor');
            return Promise.resolve(false);
        }
        
        // Bağlantı durumunu güncelle
        isConnecting = true;
        updateConnectionStatus('connecting', 'Bağlanıyor...');
        
        // WebSocket bağlantısı oluştur
        return new Promise((resolve, reject) => {
            try {
                socket = new WebSocket(serverUrl);
                
                // Bağlantı açıldığında
                socket.onopen = () => {
                    isConnected = true;
                    isConnecting = false;
                    reconnectAttempts = 0;
                    updateConnectionStatus('connected', 'Bağlantı Başarılı');
                    
                    if (onConnectCallback) {
                        onConnectCallback();
                    }
                    
                    resolve(true);
                };
                
                // Bağlantı kapandığında
                socket.onclose = (event) => {
                    console.log('WebSocket bağlantısı kapandı:', event);
                    isConnected = false;
                    isConnecting = false;
                    
                    updateConnectionStatus('disconnected', 'Bağlantı Kesildi');
                    
                    if (onDisconnectCallback) {
                        onDisconnectCallback(event);
                    }
                    
                    // Yeniden bağlantı dene
                    if (reconnectAttempts < maxReconnectAttempts) {
                        tryReconnect();
                    }
                };
                
                // Hata durumunda
                socket.onerror = (error) => {
                    console.error('WebSocket hatası:', error);
                    isConnecting = false;
                    
                    updateConnectionStatus('error', 'Bağlantı Hatası');
                    
                    if (onErrorCallback) {
                        onErrorCallback(error, 'connection');
                    }
                    
                    reject(error);
                };
                
                // Mesaj alındığında
                socket.onmessage = (event) => {
                    handleMessage(event);
                };
                
            } catch (error) {
                console.error('WebSocket bağlantı hatası:', error);
                isConnecting = false;
                updateConnectionStatus('failed', 'Bağlantı Başarısız');
                
                if (onErrorCallback) {
                    onErrorCallback(error, 'creation');
                }
                
                reject(error);
            }
        });
    };
    
    /**
     * WebSocket bağlantısını kapatır
     * @returns {Promise} - İşlem sonucu
     */
    const disconnect = async () => {
        // Bağlantı yoksa işlem yapma
        if (!isConnected || !socket) {
            return Promise.resolve(true);
        }
        
        return new Promise((resolve) => {
            try {
                // Reconnect işlemini iptal et
                if (reconnectTimeoutId) {
                    clearTimeout(reconnectTimeoutId);
                    reconnectTimeoutId = null;
                }
                
                // Bağlantıyı kapat
                socket.close();
                socket = null;
                isConnected = false;
                
                updateConnectionStatus('disconnected', 'Bağlantı Kapatıldı');
                
                if (onDisconnectCallback) {
                    onDisconnectCallback();
                }
                
                resolve(true);
            } catch (error) {
                console.error('Bağlantı kapatma hatası:', error);
                resolve(false);
            }
        });
    };
    
    /**
     * Yeniden bağlantı dener
     */
    const tryReconnect = () => {
        // Bağlantı varsa işlem yapma
        if (isConnected || isConnecting) return;
        
        reconnectAttempts++;
        updateConnectionStatus('reconnecting', `Yeniden bağlanıyor (${reconnectAttempts}/${maxReconnectAttempts})...`);
        
        if (onReconnectCallback) {
            onReconnectCallback(reconnectAttempts);
        }
        
        reconnectTimeoutId = setTimeout(() => {
            connect().catch(err => {
                console.error('Yeniden bağlantı hatası:', err);
                
                if (reconnectAttempts < maxReconnectAttempts) {
                    tryReconnect();
                } else {
                    updateConnectionStatus('failed', 'Bağlantı başarısız');
                }
            });
        }, reconnectInterval);
    };
    
    /**
     * Bağlantı durumunu günceller
     * @param {string} status - Durum ('connected', 'disconnected', 'connecting', 'reconnecting', 'error', 'failed')
     * @param {string} message - Durum mesajı
     */
    const updateConnectionStatus = (status, message) => {
        if (!connectionStatusElement) return;
        
        // Önceki sınıfları temizle
        connectionStatusElement.classList.remove(
            'status-connected', 
            'status-disconnected', 
            'status-connecting',
            'status-reconnecting',
            'status-error',
            'status-failed'
        );
        
        // Yeni duruma göre sınıf ekle
        connectionStatusElement.classList.add(`status-${status}`);
        
        // Mesajı güncelle
        const statusTextElement = connectionStatusElement.querySelector('span:last-child');
        if (statusTextElement) {
            statusTextElement.textContent = message;
        } else {
            connectionStatusElement.innerHTML = `<span class="status-indicator"></span><span>${message}</span>`;
        }
    };
    
    /**
     * Gelen mesajı işler
     * @param {MessageEvent} event - WebSocket mesaj olayı
     */
    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Mesaj callback'i varsa çağır
            if (onMessageCallback) {
                onMessageCallback(data);
            }
        } catch (error) {
            console.error('Mesaj işleme hatası:', error);
            
            if (onErrorCallback) {
                onErrorCallback(error, 'message');
            }
        }
    };
    
    
    /**
     * Görüntü verilerini WebSocket üzerinden gönderir ve cevap bekler
     * @param {string} imageData - Base64 formatında görüntü verisi
     * @param {string} type - Görüntü tipi ('image', 'webcam')
     * @param {Object} config - İşlem yapılandırmaları (confidence vb.)
     * @returns {Promise} - Sunucu cevabı
     */
    const sendImage = async (imageData, type = 'image', config = {}) => {
        // Bağlantı yoksa hata döndür
        if (!isConnected || !socket) {
            return Promise.reject(new Error('WebSocket bağlantısı yok'));
        }
        
        return new Promise((resolve, reject) => {
            try {
                // Base64 verilerini düzelt
                let processedImageData = imageData;
                
                // Data URL formatında geldiyse (data:image/jpeg;base64,...)
                if (processedImageData && processedImageData.indexOf('data:') === 0) {
                    // URL kısmını ve base64 kısmını ayır
                    const parts = processedImageData.split(',');
                    if (parts.length === 2) {
                        // Sadece base64 kısmını al
                        const rawBase64 = parts[1];
                        
                        // Python tarafında çalışacak JSON uyumlu bir veri oluştur
                        processedImageData = rawBase64;
                    }
                }
                
                // JSON mesajı oluştur
                const confidenceValue = config.confidence || 0.5;
                console.log("🔍 WebSocket Manager - Gelen config:", config, "Kullanılacak confidence:", confidenceValue);
                
                const message = {
                    type: type,
                    data: processedImageData,
                    config: {
                        confidence: confidenceValue,
                        ...config
                    }
                };
                
                // Message ID için listener
                const messageHandler = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        
                        // İşlem tamamlandığında listener'ı kaldır
                        socket.removeEventListener('message', messageHandler);
                        
                        resolve(response);
                    } catch (error) {
                        console.error('Cevap işleme hatası:', error);
                        reject(error);
                    }
                };
                
                // Mesaj dinleyicisini ekle
                socket.addEventListener('message', messageHandler);
                
                // İsteği gönder
                const jsonString = JSON.stringify(message);
                
                // Console için data kısmını kısaltılmış göster
                const logMessage = {
                    ...message,
                    data: message.data ? `[BASE64_DATA:${message.data.length}_chars]` : null
                };
                console.log('📤 CLIENT REQUEST JSON:', JSON.stringify(logMessage));
                
                socket.send(jsonString);
                
            } catch (error) {
                console.error('Görüntü gönderme hatası:', error);
                
                if (onErrorCallback) {
                    onErrorCallback(error, 'image');
                }
                
                reject(error);
            }
        });
    };
    
    /**
     * Gerçek zamanlı webcam modu için olan stream fonksiyonu
     * @param {Function} onFrameProcess - Her frame işlendiğinde çağrılacak callback
     * @param {number} interval - Kaç ms'de bir frame işleneceği (default: 200ms)
     * @param {Object} config - Yapılandırma ayarları
     * @returns {Object} - Stream kontrolü için fonksiyonlar
     */
    const startWebcamStream = (onFrameProcess, interval = 200, config = {}) => {
        let isActive = false;
        let processingFrame = false;
        let streamIntervalId = null;
        
        // Webcam stream'i başlat
        const start = () => {
            if (isActive) return false;
            
            // WebSocket bağlantısı kontrolü
            if (!isConnected) {
                console.error('WebSocket bağlantısı yok');
                return false;
            }
            
            isActive = true;
            
            // Frame işleme döngüsünü başlat
            streamIntervalId = setInterval(async () => {
                // Zaten bir frame işleniyorsa bekle
                if (processingFrame) return;
                
                // Frame işleme durumunu güncelle
                processingFrame = true;
                
                try {
                    // Callback'den frame al
                    const frameData = await onFrameProcess();
                    
                    // Frame yoksa, işlem yapma
                    if (!frameData) {
                        processingFrame = false;
                        return;
                    }
                    
                    // Frame'i sunucuya gönder
                    const response = await sendImage(
                        frameData,
                        'webcam',
                        { confidence: config.confidence || 0.5, ...config }
                    );
                    
                    // Frame işleme durumunu güncelle
                    processingFrame = false;
                    
                    // Callback aracılığıyla sonucu bildir
                    if (config.onResult) {
                        config.onResult(response);
                    }
                    
                } catch (error) {
                    console.error('Webcam frame işleme hatası:', error);
                    processingFrame = false;
                    
                    // Hata callback'ini çağır
                    if (config.onError) {
                        config.onError(error);
                    }
                }
            }, interval);
            
            return true;
        };
        
        // Webcam stream'i durdur
        const stop = () => {
            if (!isActive) return false;
            
            isActive = false;
            processingFrame = false;
            
            // Interval'i temizle
            if (streamIntervalId) {
                clearInterval(streamIntervalId);
                streamIntervalId = null;
            }
            
            return true;
        };
        
        // Stream durumunu al
        const getStatus = () => {
            return {
                isActive,
                isProcessing: processingFrame,
                isConnected: isConnected
            };
        };
        
        // Frame işleme durumunu güncelle
        const setProcessing = (status) => {
            processingFrame = status;
        };
        
        // Stream kontrolcüsü
        return {
            start,
            stop,
            getStatus,
            setProcessing
        };
    };
    
    /**
     * Bağlantı durumunu kontrol eder
     * @returns {boolean} - Bağlantı var mı?
     */
    const checkConnection = () => {
        return isConnected;
    };
    

    
    // Public API
    return {
        init,
        connect,
        disconnect,
        sendImage,
        startWebcamStream,
        isConnected: checkConnection
    };
})();


// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
} else if (typeof window !== 'undefined') {
    window.WebSocketManager = WebSocketManager;
}