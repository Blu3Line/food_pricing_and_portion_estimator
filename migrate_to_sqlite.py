#!/usr/bin/env python3
"""
JSON veritabanından SQLite veritabanına migration scripti
Bağımsız olarak çalıştırılabilir
"""

import os
import sys
from YOLO_SERVER.database import get_database_manager
from YOLO_SERVER.config import FOOD_DB_PATH

def main():
    """Migration işlemini gerçekleştir"""
    print("=" * 60)
    print("JSON to SQLite Migration Script")
    print("=" * 60)
    
    # JSON dosyasının varlığını kontrol et
    if not os.path.exists(FOOD_DB_PATH):
        print(f"❌ JSON dosyası bulunamadı: {FOOD_DB_PATH}")
        print("Migration yapılacak JSON dosyası mevcut değil.")
        return False
    
    print(f"📁 JSON dosyası bulundu: {FOOD_DB_PATH}")
    
    # Database manager'ı başlat
    try:
        db_manager = get_database_manager()
        print("✅ SQLite veritabanı bağlantısı başarılı")
    except Exception as e:
        print(f"❌ SQLite veritabanı hatası: {e}")
        return False
    
    # Migration işlemi
    print("🔄 Migration başlatılıyor...")
    try:
        success = db_manager.migrate_from_json(FOOD_DB_PATH)
        
        if success:
            print("✅ Migration başarıyla tamamlandı!")
            
            # SQLite veritabanından veri sayısını kontrol et
            foods = db_manager.get_all_foods()
            print(f"📊 SQLite veritabanında {len(foods)} yemek bulundu")
            
            # JSON backup oluştur
            backup_path = FOOD_DB_PATH + ".backup"
            if not os.path.exists(backup_path):
                import shutil
                shutil.copy2(FOOD_DB_PATH, backup_path)
                print(f"💾 JSON yedek dosyası oluşturuldu: {backup_path}")
            else:
                print(f"💾 JSON yedek dosyası zaten mevcut: {backup_path}")
            
            # Test: birkaç örnek yemek getir
            print("\n📋 Test - Örnek yemekler:")
            sample_foods = list(foods.keys())[:3]
            for food_id in sample_foods:
                food = db_manager.get_food_by_id(food_id)
                if food:
                    print(f"  • {food['name']} - {food['price']} ₺")
            
            print("\n🎉 Migration işlemi başarıyla tamamlandı!")
            print("Artık uygulamanız SQLite veritabanını kullanacak.")
            
        else:
            print("❌ Migration başarısız!")
            return False
            
    except Exception as e:
        print(f"❌ Migration sırasında hata: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 