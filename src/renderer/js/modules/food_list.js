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
        // Gerçek bir resim sistemi oluşturulana kadar placeholder resim kullanılır
        // Gerçek sistemde burada yemeğin adına veya ID'sine göre resim belirlenir
        const imageUrl = `https://via.placeholder.com/40?text=${food.name[0]}`;
        return imageUrl;
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
            
            // Yemek öğesi HTML'ini oluştur (resimli)
            listItem.innerHTML = `
                <div class="food-item">
                    <div class="food-item-image">
                        <img src="${getFoodImageUrl(food)}" alt="${food.name}">
                    </div>
                    <div class="food-item-info">
                        <div class="food-item-name">${food.name}</div>
                        <div class="food-item-price">${food.price.toFixed(2)} ₺</div>
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