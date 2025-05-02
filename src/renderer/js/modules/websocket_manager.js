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
    let maxReconnectAttempts = 5;
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
        try {
            // Ayarları güncelle
            if (config.serverUrl) serverUrl = config.serverUrl;
            if (config.maxReconnectAttempts !== undefined) maxReconnectAttempts = config.maxReconnectAttempts;
            if (config.reconnectInterval !== undefined) reconnectInterval = config.reconnectInterval;
            
            // Event callback'lerini ayarla
            if (config.onConnect) onConnectCallback = config.onConnect;
            if (config.onDisconnect) onDisconnectCallback = config.onDisconnect;
            if (config.onError) onErrorCallback = config.onError;
            if (config.onMessage) onMessageCallback = config.onMessage;
            if (config.onReconnect) onReconnectCallback = config.onReconnect;
            
            // UI element referansı
            if (config.connectionStatusElement) {
                connectionStatusElement = typeof config.connectionStatusElement === 'string' 
                    ? document.getElementById(config.connectionStatusElement)
                    : config.connectionStatusElement;
            }
            
            // Otomatik bağlantı kur (varsayılan olarak kapalı)
            if (config.autoConnect) {
                connect();
            }
            
            return true;
        } catch (error) {
            console.error('WebSocketManager başlatma hatası:', error);
            return false;
        }
    };
    
    /**
     * WebSocket bağlantısını kurar
     * @returns {Promise<boolean>} - Bağlantı başarılı mı?
     */
    const connect = () => {
        return new Promise((resolve, reject) => {
            if (isConnected) {
                resolve(true);
                return;
            }
            
            if (isConnecting) {
                reject(new Error('Bağlantı zaten kurulmaya çalışılıyor'));
                return;
            }
            
            isConnecting = true;
            updateConnectionStatus('connecting');
            
            try {
                socket = new WebSocket(serverUrl);
                
                // Bağlantı açıldığında
                socket.onopen = () => {
                    isConnected = true;
                    isConnecting = false;
                    reconnectAttempts = 0;
                    updateConnectionStatus('connected');
                    
                    if (onConnectCallback) onConnectCallback();
                    resolve(true);
                };
                
                // Mesaj alındığında
                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (onMessageCallback) onMessageCallback(data);
                    } catch (error) {
                        console.error('WebSocket mesaj işleme hatası:', error);
                        if (onErrorCallback) onErrorCallback(error, 'message-parsing');
                    }
                };
                
                // Hata oluştuğunda
                socket.onerror = (error) => {
                    console.error('WebSocket hatası:', error);
                    if (onErrorCallback) onErrorCallback(error, 'socket-error');
                    
                    if (isConnecting) {
                        isConnecting = false;
                        reject(error);
                    }
                };
                
                // Bağlantı kapandığında
                socket.onclose = (event) => {
                    const wasConnected = isConnected;
                    isConnected = false;
                    isConnecting = false;
                    updateConnectionStatus('disconnected');
                    
                    if (wasConnected && onDisconnectCallback) {
                        onDisconnectCallback(event);
                    }
                    
                    // Otomatik yeniden bağlantı
                    if (wasConnected && maxReconnectAttempts > 0) {
                        scheduleReconnect();
                    }
                    
                    if (isConnecting) {
                        reject(new Error('Bağlantı kurulurken kapandı'));
                    }
                };
                
            } catch (error) {
                isConnecting = false;
                updateConnectionStatus('error');
                console.error('WebSocket bağlantı hatası:', error);
                if (onErrorCallback) onErrorCallback(error, 'connection-error');
                reject(error);
            }
        });
    };
    
    /**
     * WebSocket bağlantısını kapatır
     * @returns {Promise<boolean>} - Kapatma başarılı mı?
     */
    const disconnect = () => {
        return new Promise((resolve) => {
            if (!isConnected || !socket) {
                resolve(true);
                return;
            }
            
            try {
                // Yeniden bağlanma denemelerini iptal et
                if (reconnectTimeoutId) {
                    clearTimeout(reconnectTimeoutId);
                    reconnectTimeoutId = null;
                }
                
                // Bağlantıyı kapat
                socket.close(1000, 'Kullanıcı tarafından kapatıldı');
                isConnected = false;
                updateConnectionStatus('disconnected');
                
                resolve(true);
            } catch (error) {
                console.error('WebSocket bağlantı kapatma hatası:', error);
                resolve(false);
            }
        });
    };
    
    /**
     * Yeniden bağlanma işlemini planlar
     */
    const scheduleReconnect = () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.warn(`Maksimum yeniden bağlanma denemesi (${maxReconnectAttempts}) aşıldı`);
            updateConnectionStatus('failed');
            return;
        }
        
        reconnectAttempts++;
        
        const delay = reconnectInterval * Math.pow(1.5, reconnectAttempts - 1);
        console.log(`Yeniden bağlanma denemesi ${reconnectAttempts}/${maxReconnectAttempts} (${delay}ms sonra)`);
        updateConnectionStatus('reconnecting');
        
        if (onReconnectCallback) {
            onReconnectCallback(reconnectAttempts, maxReconnectAttempts);
        }
        
        reconnectTimeoutId = setTimeout(() => {
            connect().catch(() => {
                // Başarısız bağlantı durumunda bir şey yapma
                // Zaten scheduleReconnect otomatik olarak çağrılacak
            });
        }, delay);
    };
    
    /**
     * Mesaj gönderir
     * @param {Object|string} data - Gönderilecek veri (JSON formatına dönüştürülür)
     * @returns {Promise<boolean>} - Gönderim başarılı mı?
     */
    const sendMessage = (data) => {
        return new Promise((resolve, reject) => {
            if (!isConnected || !socket) {
                reject(new Error('WebSocket bağlantısı aktif değil'));
                return;
            }
            
            try {
                const message = typeof data === 'string' ? data : JSON.stringify(data);
                socket.send(message);
                resolve(true);
            } catch (error) {
                console.error('WebSocket mesaj gönderme hatası:', error);
                if (onErrorCallback) onErrorCallback(error, 'send-error');
                reject(error);
            }
        });
    };
    
    /**
     * Görüntü gönderir
     * @param {string} imageData - Base64 formatındaki görüntü verisi
     * @param {string} imageType - Görüntü türü ('image' veya 'webcam')
     * @param {Object} config - Ek yapılandırma parametreleri
     * @returns {Promise<Object>} - Sunucu yanıtı
     */
    const sendImage = (imageData, imageType = 'image', config = {}) => {
        return new Promise((resolve, reject) => {
            if (!isConnected || !socket) {
                reject(new Error('WebSocket bağlantısı aktif değil'));
                return;
            }
            
            try {
                // Base64 görüntü verisini ayıkla (data:image/jpeg;base64, kısmını kaldır)
                let base64Data = imageData;
                if (base64Data.startsWith('data:')) {
                    base64Data = base64Data.split(',')[1];
                }
                
                // Mesaj oluştur
                const message = {
                    type: imageType,
                    data: base64Data,
                    config: {
                        confidence: config.confidence || 0.5,
                        classes: config.classes || []
                    }
                };
                
                // Mesajı gönder
                socket.send(JSON.stringify(message));
                
                // Yanıt için bir kerelik event listener ekle
                const messageHandler = (event) => {
                    socket.removeEventListener('message', messageHandler);
                    
                    try {
                        const response = JSON.parse(event.data);
                        resolve(response);
                    } catch (error) {
                        console.error('Yanıt işleme hatası:', error);
                        reject(error);
                    }
                };
                
                socket.addEventListener('message', messageHandler);
                
                // 15 saniye timeout ekle
                setTimeout(() => {
                    socket.removeEventListener('message', messageHandler);
                    reject(new Error('Yanıt zaman aşımı'));
                }, 15000);
                
            } catch (error) {
                console.error('Görüntü gönderme hatası:', error);
                if (onErrorCallback) onErrorCallback(error, 'send-image-error');
                reject(error);
            }
        });
    };
    
    /**
     * Bağlantı durumunu günceller ve UI'ı yeniler
     * @param {string} status - Bağlantı durumu
     */
    const updateConnectionStatus = (status) => {
        if (!connectionStatusElement) return;
        
        // CSS sınıflarını temizle
        connectionStatusElement.classList.remove(
            'status-connected', 
            'status-connecting', 
            'status-disconnected', 
            'status-error',
            'status-reconnecting',
            'status-failed'
        );
        
        // Durum metni
        let statusText = '';
        let statusClass = '';
        
        switch (status) {
            case 'connected':
                statusText = 'Bağlı';
                statusClass = 'status-connected';
                break;
            case 'connecting':
                statusText = 'Bağlanıyor...';
                statusClass = 'status-connecting';
                break;
            case 'disconnected':
                statusText = 'Bağlantı Kesildi';
                statusClass = 'status-disconnected';
                break;
            case 'error':
                statusText = 'Bağlantı Hatası';
                statusClass = 'status-error';
                break;
            case 'reconnecting':
                statusText = `Yeniden Bağlanıyor (${reconnectAttempts}/${maxReconnectAttempts})...`;
                statusClass = 'status-reconnecting';
                break;
            case 'failed':
                statusText = 'Bağlantı Başarısız';
                statusClass = 'status-failed';
                break;
            default:
                statusText = 'Bilinmeyen Durum';
        }
        
        // UI güncelle
        connectionStatusElement.textContent = statusText;
        connectionStatusElement.classList.add(statusClass);
    };
    
    /**
     * Bağlantı durumunu döndürür
     * @returns {boolean} - Bağlantı durumu
     */
    const isSocketConnected = () => {
        return isConnected;
    };
    
    /**
     * Bağlantı URL'sini değiştirir
     * @param {string} url - Yeni WebSocket URL'si
     */
    const setServerUrl = (url) => {
        if (isConnected) {
            console.warn('URL değiştirilmeden önce bağlantı kesilmeli');
            return false;
        }
        
        serverUrl = url;
        return true;
    };
    
    // Public API
    return {
        init,
        connect,
        disconnect,
        sendMessage,
        sendImage,
        isConnected: isSocketConnected,
        setServerUrl
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
} else if (typeof window !== 'undefined') {
    window.WebSocketManager = WebSocketManager;
}