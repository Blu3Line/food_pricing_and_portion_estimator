/**
 * Admin Panel UI Manager
 * Arayüz güncellemeleri ve kullanıcı etkileşimlerini yönetir
 */

class AdminUIManager {
    constructor() {
        this.foodsList = [];
        this.filteredFoodsList = [];
        this.currentView = 'list'; // 'list' or 'grid'
        this.currentFilters = {
            search: '',
            portionBased: '',
            minPrice: '',
            maxPrice: ''
        };
        
        this.elements = {
            foodsList: document.getElementById('foodsList'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            searchInput: document.getElementById('foodSearch'),

            portionFilter: document.getElementById('portionFilter'),
            minPriceInput: document.getElementById('minPrice'),
            maxPriceInput: document.getElementById('maxPrice'),
            clearFiltersBtn: document.getElementById('clearFilters'),
            refreshBtn: document.getElementById('refreshFoodsBtn'),
            listViewBtn: document.getElementById('listViewBtn'),
            gridViewBtn: document.getElementById('gridViewBtn'),
            totalFoodsCount: document.getElementById('totalFoodsCount'),
            portionBasedCount: document.getElementById('portionBasedCount'),
            filteredCount: document.getElementById('filteredCount'),
            portionCalculationToggle: document.getElementById('portionCalculationToggle')
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.showLoading();
    }
    
    bindEvents() {
        // Arama ve filtreler
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                this.debounce(() => this.handleSearchChange(), 300)
            );
        }
        

        
        if (this.elements.portionFilter) {
            this.elements.portionFilter.addEventListener('change', () => this.handleFilterChange());
        }
        
        if (this.elements.minPriceInput) {
            this.elements.minPriceInput.addEventListener('input', 
                this.debounce(() => this.handleFilterChange(), 500)
            );
        }
        
        if (this.elements.maxPriceInput) {
            this.elements.maxPriceInput.addEventListener('input', 
                this.debounce(() => this.handleFilterChange(), 500)
            );
        }
        
        if (this.elements.clearFiltersBtn) {
            this.elements.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
        
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => this.refreshFoodsList());
        }
        
        // Görünüm değiştirme
        if (this.elements.listViewBtn) {
            this.elements.listViewBtn.addEventListener('click', () => this.setView('list'));
        }
        
        if (this.elements.gridViewBtn) {
            this.elements.gridViewBtn.addEventListener('click', () => this.setView('grid'));
        }
        
        // Porsiyon hesaplama toggle
        if (this.elements.portionCalculationToggle) {
            this.elements.portionCalculationToggle.addEventListener('change', () => {
                this.handlePortionCalculationToggle();
            });
        }
    }
    
    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    showLoading() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'flex';
        }
        if (this.elements.foodsList) {
            this.elements.foodsList.innerHTML = '';
        }
    }
    
    hideLoading() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        }
    }
    
    updateFoodsList(foods) {
        this.foodsList = Object.entries(foods).map(([id, data]) => ({
            id: id,
            ...data
        }));
        
        this.applyFilters();
        this.updateStats();
        this.renderFoodsList();
        this.hideLoading();
    }
    
    applyFilters() {
        this.filteredFoodsList = this.foodsList.filter(food => {
            // Arama filtresi
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                if (!food.name.toLowerCase().includes(searchTerm) && 
                    !food.id.toLowerCase().includes(searchTerm)) {
                    return false;
                }
            }
            

            
            // Porsiyon tipi filtresi
            if (this.currentFilters.portionBased !== '') {
                const isPortionBased = this.currentFilters.portionBased === 'true';
                
                // Veri tipini normalize et: 1/0 -> true/false
                const foodPortionBased = Boolean(food.portion_based);
                
                if (foodPortionBased !== isPortionBased) {
                    return false;
                }
            }
            
            // Fiyat aralığı filtresi
            if (this.currentFilters.minPrice && 
                food.price < parseFloat(this.currentFilters.minPrice)) {
                return false;
            }
            
            if (this.currentFilters.maxPrice && 
                food.price > parseFloat(this.currentFilters.maxPrice)) {
                return false;
            }
            
            return true;
        });
    }
    
    renderFoodsList() {
        if (!this.elements.foodsList) return;
        
        // Görünüm sınıfını güncelle
        this.elements.foodsList.className = `foods-list ${this.currentView}-view`;
        
        if (this.filteredFoodsList.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        const foodsHTML = this.filteredFoodsList.map(food => this.createFoodCard(food)).join('');
        this.elements.foodsList.innerHTML = foodsHTML;
        
        // Event listener'ları ekle
        this.bindFoodCardEvents();
    }
    
    createFoodCard(food) {
        const portionBadge = food.portion_based ? 
            '<span class="food-tag portion-based">Porsiyon Bazlı</span>' : '';
        
        // Resim URL'si oluştur
        const imageUrl = this.getFoodImageUrl(food);
        
        return `
            <div class="food-card" data-food-id="${food.id}">
                <div class="food-card-image">
                    <img src="${imageUrl}" alt="${food.name}" onerror="this.onerror=null; this.src='assets/images/foods/default_thumb.jpg';">
                </div>
                <div class="food-card-content">
                    <div class="food-card-header">
                        <h3 class="food-card-title">${food.name}</h3>
                        <span class="food-card-id">${food.id}</span>
                    </div>
                    <div class="food-card-details">
                        <span class="food-card-detail">
                            <i class="fas fa-lira-sign"></i>
                            ${food.price.toFixed(2)}
                        </span>
                        <span class="food-card-detail">
                            <i class="fas fa-fire"></i>
                            ${food.calories} kcal
                        </span>
                    </div>
                    <div class="food-card-tags">
                        ${portionBadge}
                    </div>
                </div>
                <div class="food-card-actions">
                    <button class="action-btn edit" data-action="edit" data-food-id="${food.id}" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" data-action="delete" data-food-id="${food.id}" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getFoodImageUrl(food) {
        // Use food name or ID to determine the image path
        const foodName = food.name.toLowerCase().replace(/ /g, '_');
        return `assets/images/foods/${foodName}_thumb.jpg`;
    }
    
    renderEmptyState() {
        this.elements.foodsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Yemek Bulunamadı</h3>
                <p>Aradığınız kriterlere uygun yemek bulunamadı.</p>
                <button id="emptyStateClearFilters" class="btn btn-primary">
                    Filtreleri Temizle
                </button>
            </div>
        `;
        
        // Event listener ekle
        const clearBtn = document.getElementById('emptyStateClearFilters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilters());
        }
    }
    
    bindFoodCardEvents() {
        // Düzenleme butonları
        const editButtons = this.elements.foodsList.querySelectorAll('[data-action="edit"]');
        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const foodId = btn.dataset.foodId;
                this.editFood(foodId);
            });
        });
        
        // Silme butonları
        const deleteButtons = this.elements.foodsList.querySelectorAll('[data-action="delete"]');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const foodId = btn.dataset.foodId;
                this.deleteFood(foodId);
            });
        });
    }
    

    
    updateStats() {
        if (this.elements.totalFoodsCount) {
            this.elements.totalFoodsCount.textContent = this.foodsList.length;
        }
        
        if (this.elements.portionBasedCount) {
            const portionBasedCount = this.foodsList.filter(food => food.portion_based).length;
            this.elements.portionBasedCount.textContent = portionBasedCount;
        }
        
        if (this.elements.filteredCount) {
            this.elements.filteredCount.textContent = this.filteredFoodsList.length;
        }
    }
    
    handleSearchChange() {
        this.currentFilters.search = this.elements.searchInput.value;
        this.applyFilters();
        this.renderFoodsList();
        this.updateStats();
    }
    
    handleFilterChange() {
        this.currentFilters.portionBased = this.elements.portionFilter.value;
        this.currentFilters.minPrice = this.elements.minPriceInput.value;
        this.currentFilters.maxPrice = this.elements.maxPriceInput.value;
        
        this.applyFilters();
        this.renderFoodsList();
        this.updateStats();
    }
    
    clearFilters() {
        this.currentFilters = {
            search: '',
            portionBased: '',
            minPrice: '',
            maxPrice: ''
        };
        
        // Form elemanlarını temizle
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        if (this.elements.portionFilter) this.elements.portionFilter.value = '';
        if (this.elements.minPriceInput) this.elements.minPriceInput.value = '';
        if (this.elements.maxPriceInput) this.elements.maxPriceInput.value = '';
        
        this.applyFilters();
        this.renderFoodsList();
        this.updateStats();
    }
    
    refreshFoodsList() {
        this.showLoading();
        if (window.AdminWebSocketManager) {
            window.AdminWebSocketManager.requestFoodsList();
        }
    }
    
    setView(viewType) {
        this.currentView = viewType;
        
        // Buton durumlarını güncelle
        if (this.elements.listViewBtn && this.elements.gridViewBtn) {
            this.elements.listViewBtn.classList.toggle('active', viewType === 'list');
            this.elements.gridViewBtn.classList.toggle('active', viewType === 'grid');
        }
        
        this.renderFoodsList();
    }
    
    editFood(foodId) {
        const food = this.foodsList.find(f => f.id === foodId);
        if (food && window.AdminFormsManager) {
            window.AdminFormsManager.openEditModal(food);
        }
    }
    
    deleteFood(foodId) {
        const food = this.foodsList.find(f => f.id === foodId);
        if (food && window.AdminFormsManager) {
            window.AdminFormsManager.openDeleteModal(food);
        }
    }
    
    // WebSocket callback'leri için yardımcı metodlar
    onFoodAdded(food) {
        this.foodsList.push(food);
        this.applyFilters();
        this.renderFoodsList();
        this.updateStats();
        
        this.showNotification('Yemek başarıyla eklendi', 'success');
    }
    
    onFoodUpdated(food) {
        const index = this.foodsList.findIndex(f => f.id === food.id);
        if (index !== -1) {
            this.foodsList[index] = food;
            this.applyFilters();
            this.renderFoodsList();
            this.updateStats();
        }
        
        this.showNotification('Yemek başarıyla güncellendi', 'success');
    }
    
    onFoodDeleted(foodId) {
        this.foodsList = this.foodsList.filter(f => f.id !== foodId);
        this.applyFilters();
        this.renderFoodsList();
        this.updateStats();
        
        this.showNotification('Yemek başarıyla silindi', 'success');
    }
    
    showNotification(message, type = 'info') {
        // Basit notification sistemi
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    handlePortionCalculationToggle() {
        if (this.elements.portionCalculationToggle) {
            const isEnabled = this.elements.portionCalculationToggle.checked;
            
            // AppConfig'i güncelle
            if (window.AppConfig) {
                window.AppConfig.setPortionCalculationEnabled(isEnabled);
            }
            
            // Kullanıcıya bilgi ver
            this.showNotification(
                `Porsiyon hesaplama ${isEnabled ? 'aktif edildi' : 'deaktif edildi'}`, 
                'success'
            );
            
            console.log('⚖️ Porsiyon hesaplama durumu değişti:', isEnabled);
        }
    }
    
    // AppConfig'den durumu yükle
    loadPortionCalculationState() {
        if (this.elements.portionCalculationToggle && window.AppConfig) {
            this.elements.portionCalculationToggle.checked = window.AppConfig.portionCalculationEnabled;
        }
    }
}

// Global instance
window.AdminUIManager = new AdminUIManager(); 