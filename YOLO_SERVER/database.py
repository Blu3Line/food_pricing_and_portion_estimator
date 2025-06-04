import sqlite3
import json
import os
from typing import Dict, List, Optional, Any
from contextlib import contextmanager
from YOLO_SERVER.config import CURRENT_DIR, SQLITE_DB_PATH

class DatabaseManager:
    """
    SQLite veritabanı yöneticisi
    JSON yapısını SQLite'a taşır ve veri erişim katmanı sağlar
    """
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = SQLITE_DB_PATH
        self.db_path = db_path
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Database connection context manager"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
        finally:
            conn.close()
    
    def init_database(self):
        """Veritabanı tablolarını oluştur"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Ana yemekler tablosu
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS foods (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    price REAL NOT NULL,
                    calories INTEGER NOT NULL,
                    portion_based BOOLEAN NOT NULL DEFAULT 0,
                    food_category TEXT,
                    base_height_cm REAL,
                    density_g_per_cm3 REAL,
                    reference_mass_g REAL,
                    volume_method TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Besin değerleri tablosu (one to one ilişkisi)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS nutrition (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    food_id TEXT NOT NULL UNIQUE,
                    protein TEXT,
                    carbs TEXT,
                    fat TEXT,
                    fiber TEXT,
                    FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE CASCADE
                )
            ''')
            
            # Malzemeler tablosu
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ingredients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    food_id TEXT NOT NULL,
                    ingredient TEXT NOT NULL,
                    FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE CASCADE
                )
            ''')
            
            # Alerjenler tablosu
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS allergens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    food_id TEXT NOT NULL,
                    allergen TEXT NOT NULL,
                    FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE CASCADE
                )
            ''')
            
            # İndeksler
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_foods_name ON foods (name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_foods_portion_based ON foods (portion_based)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_nutrition_food_id ON nutrition (food_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_ingredients_food_id ON ingredients (food_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_allergens_food_id ON allergens (food_id)')
            
            conn.commit()
    
    def migrate_from_json(self, json_path: str = None):
        """JSON veritabanından SQLite'a migration"""
        if json_path is None:
            json_path = os.path.join(CURRENT_DIR, 'foodsDB.json')
        
        if not os.path.exists(json_path):
            print(f"JSON dosyası bulunamadı: {json_path}")
            return False
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                foods_data = json.load(f)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                for food_id, food_data in foods_data.items():
                    # Ana yemek bilgisini ekle
                    cursor.execute('''
                        INSERT OR REPLACE INTO foods (
                            id, name, price, calories, portion_based, food_category,
                            base_height_cm, density_g_per_cm3, reference_mass_g,
                            volume_method
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        food_id,
                        food_data.get('name', ''),
                        food_data.get('price', 0.0),
                        food_data.get('calories', 0),
                        food_data.get('portion_based', False),
                        food_data.get('food_category'),
                        food_data.get('base_height_cm'),
                        food_data.get('density_g_per_cm3'),
                        food_data.get('reference_mass_g'),
                        food_data.get('volume_method')
                    ))
                    
                    # Eski nutrition, ingredients, allergens kayıtlarını sil
                    cursor.execute('DELETE FROM nutrition WHERE food_id = ?', (food_id,))
                    cursor.execute('DELETE FROM ingredients WHERE food_id = ?', (food_id,))
                    cursor.execute('DELETE FROM allergens WHERE food_id = ?', (food_id,))
                    
                    # Besin değerlerini ekle
                    nutrition = food_data.get('nutrition', {})
                    if nutrition:
                        cursor.execute('''
                            INSERT INTO nutrition (food_id, protein, carbs, fat, fiber)
                            VALUES (?, ?, ?, ?, ?)
                        ''', (
                            food_id,
                            nutrition.get('protein'),
                            nutrition.get('carbs'),
                            nutrition.get('fat'),
                            nutrition.get('fiber')
                        ))
                    
                    # Malzemeleri ekle
                    ingredients = food_data.get('ingredients', [])
                    for ingredient in ingredients:
                        cursor.execute('''
                            INSERT INTO ingredients (food_id, ingredient)
                            VALUES (?, ?)
                        ''', (food_id, ingredient))
                    
                    # Alerjenleri ekle
                    allergens = food_data.get('allergens', [])
                    for allergen in allergens:
                        cursor.execute('''
                            INSERT INTO allergens (food_id, allergen)
                            VALUES (?, ?)
                        ''', (food_id, allergen))
                
                conn.commit()
            
            print(f"Migration başarılı: {len(foods_data)} yemek SQLite'a aktarıldı")
            return True
            
        except Exception as e:
            print(f"Migration hatası: {e}")
            return False
    
    def get_food_by_id(self, food_id: str) -> Optional[Dict[str, Any]]:
        """ID'ye göre yemek bilgisini getir"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Ana yemek bilgisi
            cursor.execute('SELECT * FROM foods WHERE id = ?', (food_id,))
            food_row = cursor.fetchone()
            
            if not food_row:
                return None
            
            food = dict(food_row)
            
            # Besin değerleri
            cursor.execute('SELECT * FROM nutrition WHERE food_id = ?', (food_id,))
            nutrition_row = cursor.fetchone()
            if nutrition_row:
                food['nutrition'] = {
                    'protein': nutrition_row['protein'],
                    'carbs': nutrition_row['carbs'],
                    'fat': nutrition_row['fat'],
                    'fiber': nutrition_row['fiber']
                }
            
            # Malzemeler
            cursor.execute('SELECT ingredient FROM ingredients WHERE food_id = ?', (food_id,))
            ingredients = [row['ingredient'] for row in cursor.fetchall()]
            food['ingredients'] = ingredients
            
            # Alerjenler
            cursor.execute('SELECT allergen FROM allergens WHERE food_id = ?', (food_id,))
            allergens = [row['allergen'] for row in cursor.fetchall()]
            food['allergens'] = allergens
            
            # Gereksiz alanları temizle
            for key in ['created_at', 'updated_at']:
                food.pop(key, None)
            
            return food
    
    def get_all_foods(self) -> Dict[str, Dict[str, Any]]:
        """Tüm yemekleri dict formatında getir (JSON uyumluluğu için)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT id FROM foods')
            food_ids = [row['id'] for row in cursor.fetchall()]
            
            foods_dict = {}
            for food_id in food_ids:
                food_data = self.get_food_by_id(food_id)
                if food_data:
                    foods_dict[food_id] = food_data
            
            return foods_dict
    
    def search_foods_by_name(self, name: str) -> List[Dict[str, Any]]:
        """İsme göre yemek ara"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id FROM foods 
                WHERE name LIKE ? OR id LIKE ?
                ORDER BY name
            ''', (f'%{name}%', f'%{name}%'))
            
            food_ids = [row['id'] for row in cursor.fetchall()]
            return [self.get_food_by_id(food_id) for food_id in food_ids]
    
    def add_food(self, food_id: str, food_data: Dict[str, Any]) -> bool:
        """Yeni yemek ekle"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Ana yemek bilgisini ekle
                cursor.execute('''
                    INSERT INTO foods (
                        id, name, price, calories, portion_based, food_category,
                        base_height_cm, density_g_per_cm3, reference_mass_g,
                        volume_method
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    food_id,
                    food_data.get('name', ''),
                    food_data.get('price', 0.0),
                    food_data.get('calories', 0),
                    food_data.get('portion_based', False),
                    food_data.get('food_category'),
                    food_data.get('base_height_cm'),
                    food_data.get('density_g_per_cm3'),
                    food_data.get('reference_mass_g'),
                    food_data.get('volume_method')
                ))
                
                # Besin değerleri
                nutrition = food_data.get('nutrition', {})
                if nutrition:
                    cursor.execute('''
                        INSERT INTO nutrition (food_id, protein, carbs, fat, fiber)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        food_id,
                        nutrition.get('protein'),
                        nutrition.get('carbs'),
                        nutrition.get('fat'),
                        nutrition.get('fiber')
                    ))
                
                # Malzemeler
                for ingredient in food_data.get('ingredients', []):
                    cursor.execute('''
                        INSERT INTO ingredients (food_id, ingredient)
                        VALUES (?, ?)
                    ''', (food_id, ingredient))
                
                # Alerjenler
                for allergen in food_data.get('allergens', []):
                    cursor.execute('''
                        INSERT INTO allergens (food_id, allergen)
                        VALUES (?, ?)
                    ''', (food_id, allergen))
                
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Yemek ekleme hatası: {e}")
            return False
    
    def update_food(self, food_id: str, food_data: Dict[str, Any]) -> bool:
        """Mevcut yemek bilgisini güncelle"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Yemek var mı kontrol et
                cursor.execute('SELECT 1 FROM foods WHERE id = ?', (food_id,))
                if not cursor.fetchone():
                    return False
                
                # Ana bilgileri güncelle
                cursor.execute('''
                    UPDATE foods SET
                        name = ?, price = ?, calories = ?, portion_based = ?,
                        food_category = ?, base_height_cm = ?, density_g_per_cm3 = ?,
                        reference_mass_g = ?, volume_method = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    food_data.get('name', ''),
                    food_data.get('price', 0.0),
                    food_data.get('calories', 0),
                    food_data.get('portion_based', False),
                    food_data.get('food_category'),
                    food_data.get('base_height_cm'),
                    food_data.get('density_g_per_cm3'),
                    food_data.get('reference_mass_g'),
                    food_data.get('volume_method'),
                    food_id
                ))
                
                # İlişkili verileri sil ve yeniden ekle
                cursor.execute('DELETE FROM nutrition WHERE food_id = ?', (food_id,))
                cursor.execute('DELETE FROM ingredients WHERE food_id = ?', (food_id,))
                cursor.execute('DELETE FROM allergens WHERE food_id = ?', (food_id,))
                
                # Besin değerleri
                nutrition = food_data.get('nutrition', {})
                if nutrition:
                    cursor.execute('''
                        INSERT INTO nutrition (food_id, protein, carbs, fat, fiber)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        food_id,
                        nutrition.get('protein'),
                        nutrition.get('carbs'),
                        nutrition.get('fat'),
                        nutrition.get('fiber')
                    ))
                
                # Malzemeler
                for ingredient in food_data.get('ingredients', []):
                    cursor.execute('''
                        INSERT INTO ingredients (food_id, ingredient)
                        VALUES (?, ?)
                    ''', (food_id, ingredient))
                
                # Alerjenler
                for allergen in food_data.get('allergens', []):
                    cursor.execute('''
                        INSERT INTO allergens (food_id, allergen)
                        VALUES (?, ?)
                    ''', (food_id, allergen))
                
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Yemek güncelleme hatası: {e}")
            return False
    
    def delete_food(self, food_id: str) -> bool:
        """Yemek sil"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM foods WHERE id = ?', (food_id,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Yemek silme hatası: {e}")
            return False

# Singleton pattern için global instance
_db_manager = None

def get_database_manager() -> DatabaseManager:
    """Database manager singleton instance"""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager

def load_food_database_from_sqlite() -> Dict[str, Dict[str, Any]]:
    """
    SQLite'dan yemek veritabanını yükle
    JSON formatında döndür (backward compatibility için)
    """
    db_manager = get_database_manager()
    return db_manager.get_all_foods()

def get_food_by_id(food_id: str) -> Optional[Dict[str, Any]]:
    """
    ID'ye göre yemek bilgisini getir (kısayol fonksiyon)
    """
    db_manager = get_database_manager()
    return db_manager.get_food_by_id(food_id)

def search_foods(name: str) -> List[Dict[str, Any]]:
    """
    İsme göre yemek ara (kısayol fonksiyon)
    """
    db_manager = get_database_manager()
    return db_manager.search_foods_by_name(name)

def add_new_food(food_id: str, food_data: Dict[str, Any]) -> bool:
    """
    Yeni yemek ekle (kısayol fonksiyon)
    """
    db_manager = get_database_manager()
    return db_manager.add_food(food_id, food_data)

def update_existing_food(food_id: str, food_data: Dict[str, Any]) -> bool:
    """
    Mevcut yemek güncelle (kısayol fonksiyon)
    """
    db_manager = get_database_manager()
    return db_manager.update_food(food_id, food_data)

def delete_existing_food(food_id: str) -> bool:
    """
    Yemek sil (kısayol fonksiyon)
    """
    db_manager = get_database_manager()
    return db_manager.delete_food(food_id)

def get_database_stats() -> Dict[str, Any]:
    """
    Veritabanı istatistiklerini getir
    """
    db_manager = get_database_manager()
    with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        
        # Toplam yemek sayısı
        cursor.execute('SELECT COUNT(*) as total FROM foods')
        total_foods = cursor.fetchone()['total']
        
        # Porsiyon bazlı yemek sayısı
        cursor.execute('SELECT COUNT(*) as portion_based FROM foods WHERE portion_based = 1')
        portion_based_foods = cursor.fetchone()['portion_based']
        
        # En pahalı ve en ucuz yemekler
        cursor.execute('SELECT MAX(price) as max_price, MIN(price) as min_price FROM foods WHERE price > 0')
        price_stats = cursor.fetchone()
        
        # Toplam kalori aralığı
        cursor.execute('SELECT MAX(calories) as max_calories, MIN(calories) as min_calories FROM foods WHERE calories > 0')
        calorie_stats = cursor.fetchone()
        
        return {
            'total_foods': total_foods,
            'portion_based_foods': portion_based_foods,
            'non_portion_foods': total_foods - portion_based_foods,
            'price_range': {
                'min': price_stats['min_price'],
                'max': price_stats['max_price']
            },
            'calorie_range': {
                'min': calorie_stats['min_calories'],
                'max': calorie_stats['max_calories']
            }
        } 