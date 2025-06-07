import json
import websockets
from YOLO_SERVER.utils import base64_to_image, load_food_database
from YOLO_SERVER.food_processing import process_image
from YOLO_SERVER.config import HOST, PORT
from YOLO_SERVER.database import (
    get_database_manager, get_database_stats,
    add_new_food, update_existing_food, delete_existing_food,
    search_foods
)

# Load food database from SQLite only
try:
    FOOD_DATABASE = load_food_database()
except Exception as e:
    print(f"❌ Veritabanı yükleme hatası: {e}")
    raise

async def websocket_handler(websocket, model):
    """Handle WebSocket connection and messages"""
    global FOOD_DATABASE
    
    try:
        print(f"Yeni bağlantı: {websocket.remote_address}")
        
        # Model Kontrolü
        if model is None:
            await websocket.send(json.dumps({
                'success': False,
                'error': 'YOLO modeli yüklenemedi'
            }))
            return
        
        
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
                    enable_portion_calculation = config.get('enablePortionCalculation', True)
                    
                    # Debug log
                    print(f"📦 Config: confidence={confidence}, porsiyon_hesaplama={'✅' if enable_portion_calculation else '❌'}")
                    
                    # Görüntüyü dönüştür
                    img = base64_to_image(data['data'])
                    if img is None:
                        await websocket.send(json.dumps({
                            'success': False,
                            'error': 'Görüntü dönüştürülemedi'
                        }))
                        continue
                    
                    # Görüntüyü işle
                    result = await process_image(model, img, FOOD_DATABASE, confidence, classes, enable_portion_calculation)
                    
                    # Sonuçları gönder
                    await websocket.send(json.dumps(result))
                
                # Admin Panel İşlemleri
                elif data['type'] == 'get_foods':
                    # Yemek listesini gönder
                    try:
                        db_manager = get_database_manager()
                        foods = db_manager.get_all_foods()
                        
                        await websocket.send(json.dumps({
                            'success': True,
                            'type': 'foods_list',
                            'data': foods
                        }))
                    except Exception as e:
                        await websocket.send(json.dumps({
                            'success': False,
                            'type': 'error',
                            'message': f'Yemek listesi alınamadı: {str(e)}'
                        }))
                
                elif data['type'] == 'add_food':
                    # Yeni yemek ekle
                    try:
                        food_data = data.get('data', {})
                        food_id = food_data.get('id')
                        
                        if not food_id:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Yemek ID\'si gerekli'
                            }))
                            continue
                        
                        success = add_new_food(food_id, food_data)
                        
                        if success:
                            # Veritabanını yeniden yükle
                            FOOD_DATABASE = load_food_database()
                            
                            await websocket.send(json.dumps({
                                'success': True,
                                'type': 'food_added',
                                'data': food_data
                            }))
                        else:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Yemek eklenemedi (ID zaten mevcut olabilir)'
                            }))
                            
                    except Exception as e:
                        await websocket.send(json.dumps({
                            'success': False,
                            'type': 'error',
                            'message': f'Yemek ekleme hatası: {str(e)}'
                        }))
                
                elif data['type'] == 'update_food':
                    # Yemek güncelle
                    try:
                        food_id = data.get('food_id')
                        food_data = data.get('data', {})
                        
                        if not food_id:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Yemek ID\'si gerekli'
                            }))
                            continue
                        
                        success = update_existing_food(food_id, food_data)
                        
                        if success:
                            # Veritabanını yeniden yükle
                            FOOD_DATABASE = load_food_database()
                            
                            await websocket.send(json.dumps({
                                'success': True,
                                'type': 'food_updated',
                                'data': {**food_data, 'id': food_id}
                            }))
                        else:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Yemek güncellenemedi (yemek bulunamadı)'
                            }))
                            
                    except Exception as e:
                        await websocket.send(json.dumps({
                            'success': False,
                            'type': 'error',
                            'message': f'Yemek güncelleme hatası: {str(e)}'
                        }))
                
                elif data['type'] == 'delete_food':
                    # Yemek sil
                    try:
                        food_id = data.get('food_id')
                        
                        if not food_id:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Yemek ID\'si gerekli'
                            }))
                            continue
                        
                        success = delete_existing_food(food_id)
                        
                        if success:
                            # Veritabanını yeniden yükle
                            FOOD_DATABASE = load_food_database()
                            
                            await websocket.send(json.dumps({
                                'success': True,
                                'type': 'food_deleted',
                                'data': {'food_id': food_id}
                            }))
                        else:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Yemek silinemedi (yemek bulunamadı)'
                            }))
                            
                    except Exception as e:
                        await websocket.send(json.dumps({
                            'success': False,
                            'type': 'error',
                            'message': f'Yemek silme hatası: {str(e)}'
                        }))
                
                elif data['type'] == 'search_foods':
                    # Yemek ara
                    try:
                        query = data.get('query', '')
                        
                        if not query:
                            await websocket.send(json.dumps({
                                'success': False,
                                'type': 'error',
                                'message': 'Arama sorgusu gerekli'
                            }))
                            continue
                        
                        search_results = search_foods(query)
                        
                        # Sonuçları dict formatına çevir
                        results_dict = {}
                        for food in search_results:
                            if food and 'id' in food:
                                results_dict[food['id']] = food
                        
                        await websocket.send(json.dumps({
                            'success': True,
                            'type': 'foods_list',
                            'data': results_dict
                        }))
                        
                    except Exception as e:
                        await websocket.send(json.dumps({
                            'success': False,
                            'type': 'error',
                            'message': f'Arama hatası: {str(e)}'
                        }))
                
                elif data['type'] == 'get_stats':
                    # İstatistikleri gönder
                    try:
                        stats = get_database_stats()
                        
                        await websocket.send(json.dumps({
                            'success': True,
                            'type': 'stats',
                            'data': stats
                        }))
                        
                    except Exception as e:
                        await websocket.send(json.dumps({
                            'success': False,
                            'type': 'error',
                            'message': f'İstatistik alma hatası: {str(e)}'
                        }))
                
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