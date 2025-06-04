import json
import websockets
from YOLO_SERVER.utils import base64_to_image, load_food_database
from YOLO_SERVER.food_processing import process_image
from YOLO_SERVER.config import HOST, PORT

# Load food database from SQLite only
try:
    FOOD_DATABASE = load_food_database()
except Exception as e:
    print(f"❌ Veritabanı yükleme hatası: {e}")
    raise

async def websocket_handler(websocket, model):
    """Handle WebSocket connection and messages"""
    try:
        print(f"Yeni bağlantı: {websocket.remote_address}")
        
        # Model Kontrolü
        if model is None:
            await websocket.send(json.dumps({
                'success': False,
                'error': 'YOLO modeli yüklenemedi'
            }))
            return
        
        
        '''
        Client'ten beklenen mesaj formatı:
        {
            "type": "image",// veya "webcam"
            "data": "base64_encoded_image_data", // Görüntü verisi
            "config": {
                "confidence": 0.5, // Tespit eşiği örneğin 0.5
                "classes": [] // Filtrelenecek sınıflar (boş ise tümü)
            }
        }
        '''
        # Process messages
        async for message in websocket:
            try:
                # JSON mesajı ayrıştır
                data = json.loads(message)
                
                # Mesaj türünü kontrol et
                if 'type' not in data:
                    await websocket.send(json.dumps({
                        'success': False,
                        'error': 'Geçersiz mesaj formatı: "type" alanı bulunamadı'
                    }))
                    continue
                
                # Görüntü işleme
                if data['type'] in ['image', 'webcam']:
                    # Görüntü verisini kontrol et
                    if 'data' not in data:
                        await websocket.send(json.dumps({
                            'success': False,
                            'error': 'Görüntü verisi bulunamadı'
                        }))
                        continue
                    
                    # Konfigürasyon parametrelerini al
                    config = data.get('config', {})
                    confidence = config.get('confidence', 0.5)
                    classes = config.get('classes', None)
                    
                    # Görüntüyü dönüştür
                    img = base64_to_image(data['data'])
                    if img is None:
                        await websocket.send(json.dumps({
                            'success': False,
                            'error': 'Görüntü dönüştürülemedi'
                        }))
                        continue
                    
                    # Görüntüyü işle
                    result = await process_image(model, img, FOOD_DATABASE, confidence, classes)
                    
                    # Sonuçları gönder
                    await websocket.send(json.dumps(result))
                
                else:
                    await websocket.send(json.dumps({
                        'success': False,
                        'error': f'Desteklenmeyen işlem türü: {data["type"]}'
                    }))
            
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    'success': False,
                    'error': 'Geçersiz JSON formatı'
                }))
            
            except Exception as e:
                print(f"Mesaj işlenirken hata oluştu: {e}")
                await websocket.send(json.dumps({
                    'success': False,
                    'error': str(e)
                }))
    
    except websockets.exceptions.ConnectionClosed:
        print(f"Bağlantı kapatıldı: {websocket.remote_address}")
    
    except Exception as e:
        print(f"WebSocket işleyicinde hata: {e}")

async def start_websocket_server(model):
    """WebSocket sunucusunu başlat"""
    server = await websockets.serve(
        lambda ws: websocket_handler(ws, model),
        HOST,
        PORT
    )
    
    print(f"WebSocket sunucusu başlatıldı: ws://{HOST}:{PORT}")
    
    await server.wait_closed() 