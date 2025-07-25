/**
 * Yemek Detayları Modülü
 * Seçilen yemeğin detaylarını gösterir
 */
const FoodDetailsModule = (function() {
    /**
     * Modülü başlatır
     */
    const init = () => {
        console.log("Yemek detayları modülü başlatıldı");
    };
    
    /**
     * Yemek için uygun resim URL'sini oluşturur
     * @param {Object} food - Yemek nesnesi
     * @returns {string} - Resim URL'si
     */
    const getFoodImageUrl = (food) => {
        // Use food name or ID to determine the image path
        const foodName = food.name.toLowerCase().replace(/ /g, '_');
        return `assets/images/foods/${foodName}.jpg`;
    };

    /**
     * Seçilen yemeğin detaylarını gösterir
     * @param {Object} food - Yemek nesnesi
     */
    const displayFoodDetails = (food) => {
        if (!food) {
            resetDetails();
            return;
        }
        
        // Yemek adı - portionBased ise porsiyon bilgisini de göster (TODO: burası 1 porsiyon olunca parantez içinde yazmıyor belki düzeltilebilir burası?)
        const nameElement = document.getElementById('selectedFoodName');
        if (nameElement) {
            let nameText = food.name;
            if (food.portionBased && food.portion !== 1.0) {
                nameText += ` (${food.portion} porsiyon)`;
            }
            nameElement.textContent = nameText;
        }
        
        // Yemek resmi
        const imageElement = document.getElementById('selectedFoodImage');
        if (imageElement) {
            imageElement.onerror = function() {
                this.onerror = null; // Prevent infinite loops
                this.src = 'assets/images/foods/default.jpg';
            };

            imageElement.src = getFoodImageUrl(food);
            imageElement.alt = food.name;
        }
        
        // Güven değeri
        const confidenceBar = document.getElementById('confidenceBar');
        const detectionConfidenceValue = document.getElementById('detectionConfidenceValue');
        if (confidenceBar && detectionConfidenceValue) {
            confidenceBar.style.width = food.confidence + '%';
            detectionConfidenceValue.textContent = food.confidence + '%';
            
            // Güven değerine göre renklendirme
            if (food.confidence >= 80) {
                confidenceBar.style.backgroundColor = '#28a745'; // Yeşil
            } else if (food.confidence >= 50) {
                confidenceBar.style.backgroundColor = '#ffc107'; // Mavi
            } else {
                confidenceBar.style.backgroundColor = '#ff0000'; // Kırmızı
            }
        }
        
        // Fiyat ve kalori
        const foodPrice = document.getElementById('foodPrice');
        const foodCalories = document.getElementById('foodCalories');
        
        if (foodPrice) {
            // Porsiyon bazlı ise, birim fiyat bilgisini de göster
            if (food.portionBased && food.portion !== 1.0 && food.basePrice) {
                foodPrice.innerHTML = `${food.price.toFixed(2)} ₺<br><small>(${food.basePrice.toFixed(2)} ₺/porsiyon)</small>`;
            } else {
                foodPrice.textContent = food.price.toFixed(2) + ' ₺';
            }
        }
        
        if (foodCalories) {
            foodCalories.textContent = food.calories + ' kcal';
        }
        
        // Besin değerleri
        updateNutritionValues(food.nutrition);
        
        // İçindekiler
        updateIngredients(food.ingredients);
        
        // Alerjenler
        updateAllergens(food.allergens);
    };

    /**
     * Besin değerlerini günceller
     * @param {Object} nutrition - Besin değerleri nesnesi
     */
    const updateNutritionValues = (nutrition) => {
        if (!nutrition) return;
        
        const proteinValue = document.getElementById('proteinValue');
        const carbsValue = document.getElementById('carbsValue');
        const fatValue = document.getElementById('fatValue');
        const fiberValue = document.getElementById('fiberValue');
        
        if (proteinValue) proteinValue.textContent = nutrition.protein || '0g';
        if (carbsValue) carbsValue.textContent = nutrition.carbs || '0g';
        if (fatValue) fatValue.textContent = nutrition.fat || '0g';
        if (fiberValue) fiberValue.textContent = nutrition.fiber || '0g';
    };

    /**
     * İçindekiler listesini günceller
     * @param {Array} ingredients - İçindekiler dizisi
     */
    const updateIngredients = (ingredients) => {
        const ingredientsList = document.getElementById('ingredientsList');
        if (!ingredientsList) return;
        
        if (!ingredients || ingredients.length === 0) {
            ingredientsList.innerHTML = '<li>İçindekiler bilgisi yok</li>';
            return;
        }
        
        ingredientsList.innerHTML = '';
        ingredients.forEach(ingredient => {
            const li = document.createElement('li');
            li.textContent = ingredient;
            ingredientsList.appendChild(li);
        });
    };

    /**
     * Alerjenler listesini günceller
     * @param {Array} allergens - Alerjenler dizisi
     */
    const updateAllergens = (allergens) => {
        const allergensList = document.getElementById('allergensList');
        if (!allergensList) return;
        
        if (!allergens || allergens.length === 0) {
            allergensList.innerHTML = '<li>Alerjen tespit edilmedi</li>';
            return;
        }
        
        allergensList.innerHTML = '';
        allergens.forEach(allergen => {
            const li = document.createElement('li');
            li.textContent = allergen;
            allergensList.appendChild(li);
        });
    };

    /**
     * Detayları sıfırlar
     */
    const resetDetails = () => {
        const nameElement = document.getElementById('selectedFoodName');
        if (nameElement) {
            nameElement.textContent = 'Yemek Seçilmedi';
        }
        
        const imageElement = document.getElementById('selectedFoodImage');
        if (imageElement) {
            imageElement.src = '';
            imageElement.alt = 'Yemek Seçilmedi';
        }
        
        const confidenceBar = document.getElementById('confidenceBar');
        const detectionConfidenceValue = document.getElementById('detectionConfidenceValue');
        if (confidenceBar && detectionConfidenceValue) {
            confidenceBar.style.width = '0%';
            detectionConfidenceValue.textContent = '0%';
        }
        
        const foodPrice = document.getElementById('foodPrice');
        const foodCalories = document.getElementById('foodCalories');
        if (foodPrice) {
            foodPrice.textContent = '0.00 ₺';
        }
        if (foodCalories) {
            foodCalories.textContent = '0 kcal';
        }
        
        // Besin değerleri
        updateNutritionValues({
            protein: '0g',
            carbs: '0g',
            fat: '0g',
            fiber: '0g'
        });
        
        // İçindekiler
        updateIngredients([]);
        
        // Alerjenler
        updateAllergens([]);
    };

    // Public API
    return {
        init,
        displayFoodDetails,
        resetDetails
    };
})();

// CommonJS modülü olarak dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FoodDetailsModule;
}