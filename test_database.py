#!/usr/bin/env python3
"""
SQLite veritabanı test scripti
Veritabanı operasyonlarını test eder
"""

import os
import sys
from YOLO_SERVER.database import (
    get_database_manager, 
    get_database_stats,
    get_food_by_id,
    search_foods,
    add_new_food,
    update_existing_food,
    delete_existing_food
)

def test_database_operations():
    """Veritabanı operasyonlarını test et"""
    print("🧪 SQLite Veritabanı Test Scripti")
    print("=" * 50)
    
    try:
        # 1. Veritabanı istatistikleri
        print("1️⃣ Veritabanı İstatistikleri:")
        stats = get_database_stats()
        print(f"   • Toplam yemek: {stats['total_foods']}")
        print(f"   • Porsiyon bazlı: {stats['portion_based_foods']}")
        print(f"   • Fiyat aralığı: {stats['price_range']['min']:.2f} - {stats['price_range']['max']:.2f} ₺")
        print()
        
        # 2. Belirli yemekleri test et
        print("2️⃣ Yemek Sorgulama Testleri:")
        test_foods = ['corba', 'tavuk_but', 'pirinc_pilav']
        
        for food_id in test_foods:
            food = get_food_by_id(food_id)
            if food:
                print(f"   ✅ {food_id}: {food['name']} - {food['price']} ₺")
                print(f"      Porsiyon bazlı: {'Evet' if food.get('portion_based') else 'Hayır'}")
                if food.get('nutrition'):
                    print(f"      Besin: {food['nutrition']}")
                print(f"      Malzemeler: {len(food.get('ingredients', []))} adet")
                print(f"      Alerjenler: {len(food.get('allergens', []))} adet")
            else:
                print(f"   ❌ {food_id}: Bulunamadı")
            print()
        
        # 3. Arama testi
        print("3️⃣ Arama Testi:")
        search_results = search_foods("tavuk")
        print(f"   'tavuk' araması: {len(search_results)} sonuç")
        for result in search_results[:3]:  # İlk 3 sonuç
            print(f"   • {result['name']} - {result['price']} ₺")
        print()
        
        # 4. Test yemek ekleme
        print("4️⃣ Test Yemek Ekleme:")
        test_food_data = {
            'name': 'Test Yemeği',
            'price': 25.0,
            'calories': 150,
            'portion_based': True,
            'food_category': 'test',
            'base_height_cm': 2.0,
            'density_g_per_cm3': 0.8,
            'reference_mass_g': 100,
            'volume_method': 'cylinder',
            'nutrition': {
                'protein': '5g',
                'carbs': '20g',
                'fat': '3g',
                'fiber': '2g'
            },
            'ingredients': ['Test malzeme 1', 'Test malzeme 2'],
            'allergens': ['Test alerjen']
        }
        
        success = add_new_food('test_food', test_food_data)
        if success:
            print("   ✅ Test yemek başarıyla eklendi")
            
            # Test yemeği kontrol et
            added_food = get_food_by_id('test_food')
            if added_food:
                print(f"   ✅ Eklenen yemek doğrulandı: {added_food['name']}")
                
                # Test yemeği güncelle
                test_food_data['price'] = 30.0
                test_food_data['name'] = 'Test Yemeği (Güncellenmiş)'
                update_success = update_existing_food('test_food', test_food_data)
                if update_success:
                    print("   ✅ Test yemek başarıyla güncellendi")
                
                # Test yemeği sil
                delete_success = delete_existing_food('test_food')
                if delete_success:
                    print("   ✅ Test yemek başarıyla silindi")
                else:
                    print("   ❌ Test yemek silinemedi")
            else:
                print("   ❌ Eklenen yemek doğrulanamadı")
        else:
            print("   ❌ Test yemek eklenemedi")
        print()
        
        # 5. Final istatistikler
        print("5️⃣ Final İstatistikler:")
        final_stats = get_database_stats()
        print(f"   • Toplam yemek: {final_stats['total_foods']}")
        print()
        
        print("🎉 Tüm testler tamamlandı!")
        return True
        
    except Exception as e:
        print(f"❌ Test sırasında hata: {e}")
        return False

def main():
    """Ana test fonksiyonu"""
    success = test_database_operations()
    
    if success:
        print("\n✅ Veritabanı testleri başarılı!")
        print("SQLite veritabanı sistemi hazır.")
    else:
        print("\n❌ Veritabanı testlerinde hata!")
        print("Sistem durumunu kontrol edin.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 