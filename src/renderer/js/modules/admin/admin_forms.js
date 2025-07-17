/**
 * Admin Panel Forms Manager
 * Modal'ları ve formları yönetir
 */

class AdminFormsManager {
    constructor() {
        this.currentFood = null;
        this.isEditMode = false;
        
        this.elements = {
            // Modal'lar
            foodModal: document.getElementById('foodModal'),
            deleteModal: document.getElementById('deleteModal'),
            
            // Modal kontrolleri
            closeModal: document.getElementById('closeModal'),
            closeDeleteModal: document.getElementById('closeDeleteModal'),
            cancelBtn: document.getElementById('cancelBtn'),
            cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
            
            // Form
            foodForm: document.getElementById('foodForm'),
            modalTitle: document.getElementById('modalTitle'),
            saveFoodBtn: document.getElementById('saveFoodBtn'),
            
            // Form alanları
            foodId: document.getElementById('foodId'),
            foodName: document.getElementById('foodName'),
            foodPrice: document.getElementById('foodPrice'),
            foodCalories: document.getElementById('foodCalories'),

            portionBased: document.getElementById('portionBased'),
            
            // Porsiyon ayarları
            portionSettings: document.getElementById('portionSettings'),
            baseHeight: document.getElementById('baseHeight'),
            density: document.getElementById('density'),
            referenceMass: document.getElementById('referenceMass'),
            volumeMethod: document.getElementById('volumeMethod'),
            
            // Besin değerleri
            protein: document.getElementById('protein'),
            carbs: document.getElementById('carbs'),
            fat: document.getElementById('fat'),
            fiber: document.getElementById('fiber'),
            
            // Dinamik listeler
            ingredientsList: document.getElementById('ingredientsList'),
            allergensList: document.getElementById('allergensList'),
            addIngredient: document.getElementById('addIngredient'),
            addAllergen: document.getElementById('addAllergen'),
            
            // Yeni yemek butonu
            addNewFoodBtn: document.getElementById('addNewFoodBtn'),
            
            // Silme modal'ı
            deleteConfirmName: document.getElementById('deleteConfirmName'),
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // Modal açma/kapama
        if (this.elements.addNewFoodBtn) {
            this.elements.addNewFoodBtn.addEventListener('click', () => this.openAddModal());
        }
        
        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => this.closeFoodModal());
        }
        
        if (this.elements.cancelBtn) {
            this.elements.cancelBtn.addEventListener('click', () => this.closeFoodModal());
        }
        
        if (this.elements.closeDeleteModal) {
            this.elements.closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
        }
        
        if (this.elements.cancelDeleteBtn) {
            this.elements.cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());
        }
        
        // Modal dışına tıklama
        if (this.elements.foodModal) {
            this.elements.foodModal.addEventListener('click', (e) => {
                if (e.target === this.elements.foodModal) {
                    this.closeFoodModal();
                }
            });
        }
        
        if (this.elements.deleteModal) {
            this.elements.deleteModal.addEventListener('click', (e) => {
                if (e.target === this.elements.deleteModal) {
                    this.closeDeleteModal();
                }
            });
        }
        
        // Form gönderimi
        if (this.elements.foodForm) {
            this.elements.foodForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }
        
        // Porsiyon bazlı checkbox
        if (this.elements.portionBased) {
            this.elements.portionBased.addEventListener('change', () => {
                this.togglePortionSettings();
            });
        }
        
        // Dinamik liste butonları
        if (this.elements.addIngredient) {
            this.elements.addIngredient.addEventListener('click', () => this.addIngredientField());
        }
        
        if (this.elements.addAllergen) {
            this.elements.addAllergen.addEventListener('click', () => this.addAllergenField());
        }
        
        // Silme onayı
        if (this.elements.confirmDeleteBtn) {
            this.elements.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());
        }
        
        // Dinamik liste event delegation
        this.bindDynamicListEvents();
    }
    
    bindDynamicListEvents() {
        // Malzeme silme
        if (this.elements.ingredientsList) {
            this.elements.ingredientsList.addEventListener('click', (e) => {
                if (e.target.closest('.remove-ingredient')) {
                    this.removeIngredientField(e.target.closest('.ingredient-item'));
                }
            });
        }
        
        // Alerjen silme
        if (this.elements.allergensList) {
            this.elements.allergensList.addEventListener('click', (e) => {
                if (e.target.closest('.remove-allergen')) {
                    this.removeAllergenField(e.target.closest('.allergen-item'));
                }
            });
        }
    }
    
    openAddModal() {
        this.isEditMode = false;
        this.currentFood = null;
        
        if (this.elements.modalTitle) {
            this.elements.modalTitle.textContent = 'Yeni Yemek Ekle';
        }
        
        if (this.elements.saveFoodBtn) {
            this.elements.saveFoodBtn.innerHTML = '<i class="fas fa-plus"></i> Ekle';
        }
        
        // Form'u temizle
        this.clearForm();
        
        // Modal'ı aç
        this.showFoodModal();
    }
    
    openEditModal(food) {
        this.isEditMode = true;
        this.currentFood = food;
        
        if (this.elements.modalTitle) {
            this.elements.modalTitle.textContent = 'Yemek Düzenle';
        }
        
        if (this.elements.saveFoodBtn) {
            this.elements.saveFoodBtn.innerHTML = '<i class="fas fa-save"></i> Güncelle';
        }
        
        // Form'u doldur
        this.populateForm(food);
        
        // Modal'ı aç
        this.showFoodModal();
    }
    
    openDeleteModal(food) {
        this.currentFood = food;
        
        if (this.elements.deleteConfirmName) {
            this.elements.deleteConfirmName.textContent = food.name;
        }
        
        this.showDeleteModal();
    }
    
    showFoodModal() {
        if (this.elements.foodModal) {
            this.elements.foodModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeFoodModal() {
        if (this.elements.foodModal) {
            this.elements.foodModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Form'u temizle
        this.clearForm();
        this.currentFood = null;
        this.isEditMode = false;
    }
    
    showDeleteModal() {
        if (this.elements.deleteModal) {
            this.elements.deleteModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeDeleteModal() {
        if (this.elements.deleteModal) {
            this.elements.deleteModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        this.currentFood = null;
    }
    
    clearForm() {
        if (this.elements.foodForm) {
            this.elements.foodForm.reset();
        }
        
        // ID alanını düzenlenebilir yap
        if (this.elements.foodId) {
            this.elements.foodId.disabled = false;
        }
        
        // Porsiyon ayarlarını gizle
        this.hidePortionSettings();
        
        // Dinamik listeleri temizle
        this.clearDynamicLists();
    }
    
    populateForm(food) {
        // Temel bilgiler
        if (this.elements.foodId) {
            this.elements.foodId.value = food.id;
            this.elements.foodId.disabled = true; // Düzenleme modunda ID değiştirilemez
        }
        
        if (this.elements.foodName) {
            this.elements.foodName.value = food.name || '';
        }
        
        if (this.elements.foodPrice) {
            this.elements.foodPrice.value = food.price || '';
        }
        
        if (this.elements.foodCalories) {
            this.elements.foodCalories.value = food.calories || '';
        }
        

        
        if (this.elements.portionBased) {
            this.elements.portionBased.checked = food.portion_based || false;
            this.togglePortionSettings();
        }
        
        // Porsiyon ayarları
        if (this.elements.baseHeight) {
            this.elements.baseHeight.value = food.base_height_cm || '';
        }
        
        if (this.elements.density) {
            this.elements.density.value = food.density_g_per_cm3 || '';
        }
        
        if (this.elements.referenceMass) {
            this.elements.referenceMass.value = food.reference_mass_g || '';
        }
        
        if (this.elements.volumeMethod) {
            this.elements.volumeMethod.value = food.volume_method || '';
        }
        
        // Besin değerleri
        const nutrition = food.nutrition || {};
        if (this.elements.protein) {
            this.elements.protein.value = nutrition.protein || '';
        }
        
        if (this.elements.carbs) {
            this.elements.carbs.value = nutrition.carbs || '';
        }
        
        if (this.elements.fat) {
            this.elements.fat.value = nutrition.fat || '';
        }
        
        if (this.elements.fiber) {
            this.elements.fiber.value = nutrition.fiber || '';
        }
        
        // Malzemeler
        this.populateIngredients(food.ingredients || []);
        
        // Alerjenler
        this.populateAllergens(food.allergens || []);
    }
    
    togglePortionSettings() {
        if (this.elements.portionSettings && this.elements.portionBased) {
            if (this.elements.portionBased.checked) {
                this.elements.portionSettings.style.display = 'block';
            } else {
                this.elements.portionSettings.style.display = 'none';
            }
        }
    }
    
    hidePortionSettings() {
        if (this.elements.portionSettings) {
            this.elements.portionSettings.style.display = 'none';
        }
    }
    
    clearDynamicLists() {
        // Malzemeler
        if (this.elements.ingredientsList) {
            this.elements.ingredientsList.innerHTML = `
                <div class="ingredient-item">
                    <input type="text" placeholder="Malzeme adı..." class="ingredient-input">
                    <button type="button" class="btn btn-danger btn-sm remove-ingredient">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        
        // Alerjenler
        if (this.elements.allergensList) {
            this.elements.allergensList.innerHTML = `
                <div class="allergen-item">
                    <input type="text" placeholder="Alerjen adı..." class="allergen-input">
                    <button type="button" class="btn btn-danger btn-sm remove-allergen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
    }
    
    populateIngredients(ingredients) {
        if (!this.elements.ingredientsList) return;
        
        this.elements.ingredientsList.innerHTML = '';
        
        if (ingredients.length === 0) {
            this.addIngredientField();
            return;
        }
        
        ingredients.forEach(ingredient => {
            this.addIngredientField(ingredient);
        });
    }
    
    populateAllergens(allergens) {
        if (!this.elements.allergensList) return;
        
        this.elements.allergensList.innerHTML = '';
        
        if (allergens.length === 0) {
            this.addAllergenField();
            return;
        }
        
        allergens.forEach(allergen => {
            this.addAllergenField(allergen);
        });
    }
    
    addIngredientField(value = '') {
        if (!this.elements.ingredientsList) return;
        
        const item = document.createElement('div');
        item.className = 'ingredient-item';
        item.innerHTML = `
            <input type="text" placeholder="Malzeme adı..." class="ingredient-input" value="${value}">
            <button type="button" class="btn btn-danger btn-sm remove-ingredient">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        this.elements.ingredientsList.appendChild(item);
    }
    
    addAllergenField(value = '') {
        if (!this.elements.allergensList) return;
        
        const item = document.createElement('div');
        item.className = 'allergen-item';
        item.innerHTML = `
            <input type="text" placeholder="Alerjen adı..." class="allergen-input" value="${value}">
            <button type="button" class="btn btn-danger btn-sm remove-allergen">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        this.elements.allergensList.appendChild(item);
    }
    
    removeIngredientField(item) {
        if (item && item.parentNode) {
            item.parentNode.removeChild(item);
            
            // En az bir alan olsun
            if (this.elements.ingredientsList.children.length === 0) {
                this.addIngredientField();
            }
        }
    }
    
    removeAllergenField(item) {
        if (item && item.parentNode) {
            item.parentNode.removeChild(item);
            
            // En az bir alan olsun
            if (this.elements.allergensList.children.length === 0) {
                this.addAllergenField();
            }
        }
    }
    
    getFormData() {
        const formData = {
            id: this.elements.foodId?.value.trim(),
            name: this.elements.foodName?.value.trim(),
            price: parseFloat(this.elements.foodPrice?.value) || 0,
            calories: parseInt(this.elements.foodCalories?.value) || 0,
            portion_based: this.elements.portionBased?.checked || false
        };
        
        // Porsiyon ayarları
        if (formData.portion_based) {
            formData.base_height_cm = parseFloat(this.elements.baseHeight?.value) || null;
            formData.density_g_per_cm3 = parseFloat(this.elements.density?.value) || null;
            formData.reference_mass_g = parseFloat(this.elements.referenceMass?.value) || null;
            formData.volume_method = this.elements.volumeMethod?.value || null;
        }
        
        // Besin değerleri
        formData.nutrition = {
            protein: this.elements.protein?.value.trim() || null,
            carbs: this.elements.carbs?.value.trim() || null,
            fat: this.elements.fat?.value.trim() || null,
            fiber: this.elements.fiber?.value.trim() || null
        };
        
        // Malzemeler
        const ingredients = [];
        if (this.elements.ingredientsList) {
            const inputs = this.elements.ingredientsList.querySelectorAll('.ingredient-input');
            inputs.forEach(input => {
                const value = input.value.trim();
                if (value) {
                    ingredients.push(value);
                }
            });
        }
        formData.ingredients = ingredients;
        
        // Alerjenler
        const allergens = [];
        if (this.elements.allergensList) {
            const inputs = this.elements.allergensList.querySelectorAll('.allergen-input');
            inputs.forEach(input => {
                const value = input.value.trim();
                if (value) {
                    allergens.push(value);
                }
            });
        }
        formData.allergens = allergens;
        
        return formData;
    }
    
    validateForm(formData) {
        const errors = [];
        
        if (!formData.id) {
            errors.push('Yemek ID\'si gerekli');
        }
        
        if (!formData.name) {
            errors.push('Yemek adı gerekli');
        }
        
        if (formData.price < 0 || isNaN(formData.price)) {
            errors.push('Geçerli bir fiyat giriniz (0 veya pozitif değer)');
        }
        
        if (formData.calories < 0 || isNaN(formData.calories)) {
            errors.push('Geçerli bir kalori değeri giriniz (0 veya pozitif değer)');
        }
        
        return errors;
    }
    
    handleFormSubmit() {
        const formData = this.getFormData();
        const errors = this.validateForm(formData);
        
        if (errors.length > 0) {
            alert('Lütfen aşağıdaki hataları düzeltin:\n\n' + errors.join('\n'));
            return;
        }
        
        // WebSocket ile gönder
        if (window.AdminWebSocketManager) {
            if (this.isEditMode) {
                window.AdminWebSocketManager.updateFood(this.currentFood.id, formData);
            } else {
                window.AdminWebSocketManager.addFood(formData);
            }
        }
        
        // Modal'ı kapat
        this.closeFoodModal();
    }
    
    confirmDelete() {
        if (this.currentFood && window.AdminWebSocketManager) {
            window.AdminWebSocketManager.deleteFood(this.currentFood.id);
        }
        
        this.closeDeleteModal();
    }
}

// Global instance
window.AdminFormsManager = new AdminFormsManager(); 