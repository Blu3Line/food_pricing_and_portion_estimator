/**
 * Admin Panel WebSocket Manager
 * Veritabanı CRUD işlemleri için WebSocket iletişimi yönetir
 */

class AdminWebSocketManager {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.statusElement = document.getElementById('adminWebsocketStatus');
        this.connectBtn = document.getElementById('adminWsConnectBtn');
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        this.callbacks = {
            onFoodsListReceived: null,
            onFoodUpdated: null,
            onFoodAdded: null,
            onFoodDeleted: null,
            onStatsReceived: null,
            onError: null
        };
        
        this.init();
    }
    
    init() {
        if (this.connectBtn) {
            this.connectBtn.addEventListener('click', () => {
                if (this.isConnected) {
                    this.disconnect();
                } else {
                    this.connect();
                }
            });
        }
    }
    
    connect() {
        try {
            this.updateStatus('connecting', 'Bağlanıyor...');
            
            // Ana WebSocket yöneticisinden konfigürasyonu al
            const config = window.AppConfig?.websocket || {
                host: 'localhost',
                port: 8765
            };
            
            this.websocket = new WebSocket(`ws://${config.host}:${config.port}`);
            
            this.websocket.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateStatus('connected', 'Bağlandı');
                this.updateConnectButton();
                
                console.log('Admin WebSocket bağlantısı başarılı');
                
                // Başlangıçta yemek listesini ve istatistikleri yükle
                this.requestFoodsList();
                this.requestStats();
            };
            
            this.websocket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.websocket.onclose = () => {
                this.isConnected = false;
                this.updateStatus('disconnected', 'Bağlantı Kesildi');
                this.updateConnectButton();
                
                console.log('Admin WebSocket bağlantısı kapandı');
                
                // Otomatik yeniden bağlanma
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('Admin WebSocket hatası:', error);
                this.updateStatus('error', 'Bağlantı Hatası');
                
                if (this.callbacks.onError) {
                    this.callbacks.onError('WebSocket bağlantı hatası');
                }
            };
            
        } catch (error) {
            console.error('WebSocket bağlantı hatası:', error);
            this.updateStatus('error', 'Bağlantı Hatası');
        }
    }
    
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        this.updateStatus('disconnected', 'Bağlantı Kesildi');
        this.updateConnectButton();
    }
    
    scheduleReconnect() {
        this.reconnectAttempts++;
        this.updateStatus('reconnecting', `Yeniden bağlanıyor... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }
    
    updateStatus(status, message) {
        if (this.statusElement) {
            this.statusElement.className = `websocket-status status-${status}`;
            this.statusElement.querySelector('span:last-child').textContent = message;
        }
    }
    
    updateConnectButton() {
        if (this.connectBtn) {
            if (this.isConnected) {
                this.connectBtn.innerHTML = '<i class="fas fa-unlink"></i> Bağlantıyı Kes';
                this.connectBtn.className = 'btn btn-danger btn-sm';
            } else {
                this.connectBtn.innerHTML = '<i class="fas fa-plug"></i> Bağlan';
                this.connectBtn.className = 'btn btn-primary btn-sm';
            }
        }
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            console.log('Admin WebSocket mesajı alındı:', message);
            
            switch (message.type) {
                case 'foods_list':
                    if (this.callbacks.onFoodsListReceived) {
                        this.callbacks.onFoodsListReceived(message.data);
                    }
                    break;
                    
                case 'food_updated':
                    if (this.callbacks.onFoodUpdated) {
                        this.callbacks.onFoodUpdated(message.data);
                    }
                    break;
                    
                case 'food_added':
                    if (this.callbacks.onFoodAdded) {
                        this.callbacks.onFoodAdded(message.data);
                    }
                    break;
                    
                case 'food_deleted':
                    if (this.callbacks.onFoodDeleted) {
                        this.callbacks.onFoodDeleted(message.data);
                    }
                    break;
                    
                case 'stats':
                    if (this.callbacks.onStatsReceived) {
                        this.callbacks.onStatsReceived(message.data);
                    }
                    break;
                    
                case 'error':
                    console.error('Sunucu hatası:', message.message);
                    if (this.callbacks.onError) {
                        this.callbacks.onError(message.message);
                    }
                    break;
                    
                default:
                    console.warn('Bilinmeyen mesaj türü:', message.type);
            }
            
        } catch (error) {
            console.error('Mesaj ayrıştırma hatası:', error);
        }
    }
    
    sendMessage(message) {
        if (!this.isConnected || !this.websocket) {
            console.error('WebSocket bağlantısı yok');
            if (this.callbacks.onError) {
                this.callbacks.onError('WebSocket bağlantısı yok');
            }
            return false;
        }
        
        try {
            this.websocket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Mesaj gönderme hatası:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError('Mesaj gönderme hatası');
            }
            return false;
        }
    }
    
    // Admin API Metodları
    requestFoodsList(filters = {}) {
        return this.sendMessage({
            type: 'get_foods',
            filters: filters
        });
    }
    
    addFood(foodData) {
        return this.sendMessage({
            type: 'add_food',
            data: foodData
        });
    }
    
    updateFood(foodId, foodData) {
        return this.sendMessage({
            type: 'update_food',
            food_id: foodId,
            data: foodData
        });
    }
    
    deleteFood(foodId) {
        return this.sendMessage({
            type: 'delete_food',
            food_id: foodId
        });
    }
    
    searchFoods(query) {
        return this.sendMessage({
            type: 'search_foods',
            query: query
        });
    }
    
    requestStats() {
        return this.sendMessage({
            type: 'get_stats'
        });
    }
    
    // Callback Metodları
    onFoodsListReceived(callback) {
        this.callbacks.onFoodsListReceived = callback;
    }
    
    onFoodUpdated(callback) {
        this.callbacks.onFoodUpdated = callback;
    }
    
    onFoodAdded(callback) {
        this.callbacks.onFoodAdded = callback;
    }
    
    onFoodDeleted(callback) {
        this.callbacks.onFoodDeleted = callback;
    }
    
    onStatsReceived(callback) {
        this.callbacks.onStatsReceived = callback;
    }
    
    onError(callback) {
        this.callbacks.onError = callback;
    }
}

// Global instance
window.AdminWebSocketManager = new AdminWebSocketManager(); 