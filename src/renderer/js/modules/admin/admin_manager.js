/**
 * Admin Panel Manager
 * Tüm admin modüllerini koordine eder ve bağlar
 */

class AdminManager {
    constructor() {
        this.webSocketManager = null;
        this.uiManager = null;
        this.formsManager = null;
        
        this.init();
    }
    
    init() {
        // Sayfa yüklendiğinde modülleri başlat
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeModules();
            this.bindModules();
        });
    }
    
    initializeModules() {
        // Modüllerin global instance'larını al
        this.webSocketManager = window.AdminWebSocketManager;
        this.uiManager = window.AdminUIManager;
        this.formsManager = window.AdminFormsManager;
        
        if (!this.webSocketManager || !this.uiManager || !this.formsManager) {
            console.error('Admin modülleri düzgün yüklenemedi');
            return;
        }
        
        console.log('Admin modülleri başarıyla yüklendi');
        
        // Admin panel açıldığında otomatik bağlan
        this.autoConnectOnPageLoad();
    }
    
    autoConnectOnPageLoad() {
        // Sayfa admin paneli ise otomatik bağlan
        if (document.body.getAttribute('data-page-type') === 'admin') {
            // Kısa bir gecikme ile bağlan (DOM elemanları tamamen yüklensin)
            setTimeout(() => {
                if (this.webSocketManager && !this.webSocketManager.isConnected) {
                    console.log('Admin paneli otomatik bağlantı başlatılıyor...');
                    this.webSocketManager.connect();
                }
            }, 100);
        }
    }
    
    bindModules() {
        if (!this.webSocketManager || !this.uiManager || !this.formsManager) {
            console.error('Modüller bağlanamadı - eksik modüller var');
            return;
        }
        
        // WebSocket callback'lerini UI Manager'a bağla
        this.webSocketManager.onFoodsListReceived((foods) => {
            console.log('Yemek listesi alındı:', Object.keys(foods).length, 'yemek');
            this.uiManager.updateFoodsList(foods);
        });
        
        this.webSocketManager.onFoodAdded((food) => {
            console.log('Yemek eklendi:', food);
            this.uiManager.onFoodAdded(food);
        });
        
        this.webSocketManager.onFoodUpdated((food) => {
            console.log('Yemek güncellendi:', food);
            this.uiManager.onFoodUpdated(food);
        });
        
        this.webSocketManager.onFoodDeleted((foodId) => {
            console.log('Yemek silindi:', foodId);
            this.uiManager.onFoodDeleted(foodId);
        });
        
        this.webSocketManager.onStatsReceived((stats) => {
            console.log('İstatistikler alındı:', stats);
            this.updateStatsDisplay(stats);
        });
        
        this.webSocketManager.onError((error) => {
            console.error('WebSocket hatası:', error);
            this.uiManager.showNotification('Bağlantı hatası: ' + error, 'error');
        });
        
        console.log('Admin modülleri başarıyla bağlandı');
    }
    
    updateStatsDisplay(stats) {
        // İstatistikleri UI'da güncelle
        const elements = {
            totalFoodsCount: document.getElementById('totalFoodsCount'),
            portionBasedCount: document.getElementById('portionBasedCount')
        };
        
        if (elements.totalFoodsCount && stats.total_foods !== undefined) {
            elements.totalFoodsCount.textContent = stats.total_foods;
        }
        
        if (elements.portionBasedCount && stats.portion_based_foods !== undefined) {
            elements.portionBasedCount.textContent = stats.portion_based_foods;
        }
    }
    
    // Public API metodları
    refreshData() {
        if (this.webSocketManager && this.webSocketManager.isConnected) {
            this.webSocketManager.requestFoodsList();
            this.webSocketManager.requestStats();
        } else {
            this.uiManager?.showNotification('WebSocket bağlantısı yok', 'warning');
        }
    }
    
    addNewFood() {
        if (this.formsManager) {
            this.formsManager.openAddModal();
        }
    }
    
    editFood(foodId) {
        if (this.uiManager && this.formsManager) {
            const food = this.uiManager.foodsList.find(f => f.id === foodId);
            if (food) {
                this.formsManager.openEditModal(food);
            }
        }
    }
    
    deleteFood(foodId) {
        if (this.uiManager && this.formsManager) {
            const food = this.uiManager.foodsList.find(f => f.id === foodId);
            if (food) {
                this.formsManager.openDeleteModal(food);
            }
        }
    }
    
    searchFoods(query) {
        if (this.webSocketManager && this.webSocketManager.isConnected) {
            this.webSocketManager.searchFoods(query);
        }
    }
    
    // Utility metodları
    isConnected() {
        return this.webSocketManager ? this.webSocketManager.isConnected : false;
    }
    
    getConnectionStatus() {
        if (!this.webSocketManager) return 'not_initialized';
        return this.webSocketManager.isConnected ? 'connected' : 'disconnected';
    }
    
    // Debug metodları
    debug() {
        return {
            webSocketManager: !!this.webSocketManager,
            uiManager: !!this.uiManager,
            formsManager: !!this.formsManager,
            isConnected: this.isConnected(),
            foodsCount: this.uiManager ? this.uiManager.foodsList.length : 0
        };
    }
}

// Global instance
window.AdminManager = new AdminManager();

// Global yardımcı fonksiyonlar (HTML'den çağrılabilir)
window.AdminHelpers = {
    refreshData: () => window.AdminManager?.refreshData(),
    addNewFood: () => window.AdminManager?.addNewFood(),
    editFood: (foodId) => window.AdminManager?.editFood(foodId),
    deleteFood: (foodId) => window.AdminManager?.deleteFood(foodId),
    searchFoods: (query) => window.AdminManager?.searchFoods(query),
    clearFilters: () => window.AdminUIManager?.clearFilters(),
    debug: () => window.AdminManager?.debug()
}; 