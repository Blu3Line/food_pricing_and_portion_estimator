import asyncio
from YOLO_SERVER.server import start_websocket_server
from YOLO_SERVER.model import load_yolo_model
from YOLO_SERVER.database import get_database_stats

async def main():
    """Ana uygulama başlatma fonksiyonu"""
    print("🚀 YOLO Food Detection System Başlatılıyor...")
    print("=" * 50)
    
    # Veritabanı durumu kontrolü
    try:
        stats = get_database_stats()
        print("📊 Veritabanı İstatistikleri:")
        print(f"   • Toplam yemek sayısı: {stats['total_foods']}")
        print(f"   • Porsiyon bazlı yemekler: {stats['portion_based_foods']}")
        print(f"   • Sabit porsiyon yemekler: {stats['non_portion_foods']}")
        print(f"   • Fiyat aralığı: {stats['price_range']['min']:.2f} - {stats['price_range']['max']:.2f} ₺")
        print(f"   • Kalori aralığı: {stats['calorie_range']['min']} - {stats['calorie_range']['max']} kcal")
        print()
    except Exception as e:
        print(f"⚠️  Veritabanı istatistikleri alınamadı: {e}")
    
    # Load YOLO model
    print("🤖 YOLO modeli yükleniyor...")
    model = load_yolo_model("my_yolo_model.pt")
    if model:
        print("✅ YOLO modeli başarıyla yüklendi")
    else:
        print("❌ YOLO modeli yüklenemedi!")
        return
    
    print("=" * 50)
    print("🌐 WebSocket sunucusu başlatılıyor...")
    
    # Start WebSocket server
    await start_websocket_server(model)

if __name__ == "__main__":
    asyncio.run(main()) 