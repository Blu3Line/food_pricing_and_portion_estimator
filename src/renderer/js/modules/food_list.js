/**
 * Yemek Listesi Modülü
 * Tespit edilen yemekleri UI'da gösterme ve yönetme işlemlerini yapar
 */
const FoodListModule = (function() {
    // Özel değişkenler
    let detectedFoods = [];
    let selectedFoodIndex = -1;
    let onFoodSelectCallback = null;

    /**
     * Modülü başlatır
     * @param {Function} onFoodSelect - Yemek seçildiğinde çağrılacak callback
     */
    const init = (onFoodSelect = null) => {
        onFoodSelectCallback = onFoodSelect;
    };

    /**
     * Yemek için uygun resim URL'sini oluşturur
     * @param {Object} food - Yemek nesnesi
     * @returns {string} - Resim URL'si
     */
    const getFoodImageUrl = (food) => {
        // Use food name or ID to determine the image path
        const foodName = food.name.toLowerCase().replace(/ /g, '_');
        return `assets/images/foods/${foodName}_thumb.jpg`;
    };

    /**
     * Tespit edilen yemekleri gösterir
     * @param {Array} foods - Yemek listesi
     */
    const displayFoods = (foods) => {
        detectedFoods = foods;
        
        const detectedItemsEl = document.getElementById('detectedItems');
        if (!detectedItemsEl) return;
        
        detectedItemsEl.innerHTML = '';
        
        if (foods.length === 0) {
            detectedItemsEl.innerHTML = '<li>Yemek bulunamadı</li>';
            updateTotals(foods);
            return;
        }
        
        foods.forEach((food, index) => {
            const listItem = document.createElement('li');
            
            // Confidence değerini yüzde formatına çevir
            const confidenceValue = typeof food.confidence === 'number' 
                ? Math.round(food.confidence) 
                : 0;
            
            // Confidence değerine göre renk belirleme
            const confidenceColorClass = confidenceValue >= 80 
                ? 'high-confidence' 
                : (confidenceValue >= 50 ? 'medium-confidence' : 'low-confidence');
            
            // Yemek öğesi HTML'ini oluştur (resimli ve confidence değeriyle)
            listItem.innerHTML = `
                <div class="food-item">
                    <div class="food-item-image">
                        <img src="${getFoodImageUrl(food)}" alt="${food.name}" onerror="this.onerror=null; this.src='assets/images/foods/default_thumb.jpg';">
                    </div>
                    <div class="food-item-info">
                        <div class="food-item-name">${food.name}</div>
                        <div class="food-item-details">
                            <div class="food-item-price">${food.price.toFixed(2)} ₺</div>
                            <div class="food-item-confidence ${confidenceColorClass}">${confidenceValue}%</div>
                        </div>
                    </div>
                </div>
            `;
            
            listItem.addEventListener('click', () => {
                selectFood(index);
            });
            
            detectedItemsEl.appendChild(listItem);
        });
        
        updateTotals(foods);
        
        // İlk yemeği otomatik olarak seç
        if (foods.length > 0) {
            selectFood(0);
        }
    };

    /**
     * Yemek seçme işlemi
     * @param {number} index - Seçilen yemeğin dizindeki konumu
     */
    const selectFood = (index) => {
        if (index < 0 || index >= detectedFoods.length) return;
        
        selectedFoodIndex = index;
        
        // Liste elemanlarının stillerini güncelle
        const listItems = document.querySelectorAll('#detectedItems li');
        listItems.forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Seçilen yemek bilgilerini göster
        if (onFoodSelectCallback) {
            onFoodSelectCallback(detectedFoods[index]);
        }
    };

    /**
     * Toplam fiyat ve kalori bilgilerini günceller
     * @param {Array} foods - Yemek listesi
     */
    const updateTotals = (foods) => {
        // Her yemek için tek tek hesapla (quantity dikkate alınmaz)
        const totalPrice = foods.reduce((total, food) => {
            return total + food.price;
        }, 0);
        
        const totalCalories = foods.reduce((total, food) => {
            return total + food.calories;
        }, 0);
        
        const totalPriceEl = document.getElementById('totalPrice');
        const totalCaloriesEl = document.getElementById('totalCalories');
        
        if (totalPriceEl) {
            totalPriceEl.textContent = totalPrice.toFixed(2) + ' ₺';
        }
        
        if (totalCaloriesEl) {
            totalCaloriesEl.textContent = totalCalories + ' kcal';
        }
    };

    /**
     * Yemek listesini temizler
     */
    const clearFoodList = () => {
        detectedFoods = [];
        selectedFoodIndex = -1;
        
        const detectedItemsEl = document.getElementById('detectedItems');
        if (detectedItemsEl) {
            detectedItemsEl.innerHTML = '<li>Yemek bulunamadı</li>';
        }
        
        updateTotals([]);
    };

    // Public API
    return {
        init,
        displayFoods,
        selectFood,
        clearFoodList
    };
})();

// CommonJS modülü olarak dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FoodListModule;
}