import asyncio
import json
import base64
import time
import io
import cv2
import numpy as np
from urllib.parse import urlparse
import websockets
from ultralytics import YOLO
from PIL import Image

# Yemek veritabanı - tespit edilen sınıflar için ek bilgiler
FOOD_DATABASE = {
    'corba': {
        'name': 'Ezogelin Çorbası',
        'price': 15.00,
        'calories': 120,
        'nutrition': {
            'protein': '3g',
            'carbs': '15g',
            'fat': '6g',
            'fiber': '2g'
        },
        'ingredients': [
            'Kırmızı mercimek',
            'Bulgur',
            'Pirinç',
            'Kuru soğan',
            'Sarımsak',
            'Domates salçası',
            'Tereyağı',
            'Baharatlar'
        ],
        'allergens': [
            'Gluten',
            'Süt ürünleri (tereyağı)'
        ]
    },
    'tavuk_but': {
        'name': 'Izgara Tavuk But',
        'price': 45.00,
        'calories': 250,
        'nutrition': {
            'protein': '30g',
            'carbs': '0g',
            'fat': '15g',
            'fiber': '0g'
        },
        'ingredients': [
            'Tavuk but',
            'Zeytinyağı',
            'Sarımsak',
            'Limon suyu',
            'Baharatlar'
        ],
        'allergens': [
            'Kümes hayvanları'
        ]
    },
    'tavuk_kul_basti': {
        'name': 'Tavuk Külbastı',
        'price': 50.00,
        'calories': 280,
        'nutrition': {
            'protein': '35g',
            'carbs': '0g',
            'fat': '16g',
            'fiber': '0g'
        },
        'ingredients': [
            'Tavuk göğsü',
            'Zeytinyağı',
            'Sarımsak',
            'Limon suyu',
            'Baharatlar'
        ],
        'allergens': [
            'Kümes hayvanları'
        ]
    },
    'pirinc_pilav': {
        'name': 'Pirinç Pilavı',
        'price': 20.00,
        'calories': 180,
        'nutrition': {
            'protein': '3g',
            'carbs': '35g',
            'fat': '5g',
            'fiber': '0.5g'
        },
        'ingredients': [
            'Pirinç',
            'Tereyağı',
            'Şehriye',
            'Tuz'
        ],
        'allergens': [
            'Gluten (şehriye)',
            'Süt ürünleri (tereyağı)'
        ]
    },
    'bulgur_pilav': {
        'name': 'Bulgur Pilavı',
        'price': 18.00,
        'calories': 170,
        'nutrition': {
            'protein': '4g',
            'carbs': '32g',
            'fat': '3g',
            'fiber': '4g'
        },
        'ingredients': [
            'Bulgur',
            'Soğan',
            'Domates salçası',
            'Zeytinyağı',
            'Baharatlar'
        ],
        'allergens': [
            'Gluten'
        ]
    },
    'salata': {
        'name': 'Mevsim Salatası',
        'price': 25.00,
        'calories': 80,
        'nutrition': {
            'protein': '2g',
            'carbs': '10g',
            'fat': '4g',
            'fiber': '5g'
        },
        'ingredients': [
            'Domates',
            'Salatalık',
            'Marul',
            'Kırmızı soğan',
            'Zeytinyağı',
            'Limon suyu'
        ],
        'allergens': []
    },
    'makarna': {
        'name': 'Napoliten Makarna',
        'price': 30.00,
        'calories': 320,
        'nutrition': {
            'protein': '10g',
            'carbs': '50g',
            'fat': '8g',
            'fiber': '3g'
        },
        'ingredients': [
            'Makarna',
            'Domates sosu',
            'Sarımsak',
            'Soğan',
            'Zeytinyağı',
            'Fesleğen'
        ],
        'allergens': [
            'Gluten'
        ]
    },
    'kuru_fasulye': {
        'name': 'Kuru Fasulye',
        'price': 30.00,
        'calories': 220,
        'nutrition': {
            'protein': '15g',
            'carbs': '30g',
            'fat': '5g',
            'fiber': '8g'
        },
        'ingredients': [
            'Kuru fasulye',
            'Soğan',
            'Domates salçası',
            'Zeytinyağı',
            'Baharatlar'
        ],
        'allergens': [
            'Baklagiller'
        ]
    },
    'ayran': {
        'name': 'Ayran',
        'price': 10.00,
        'calories': 75,
        'nutrition': {
            'protein': '4g',
            'carbs': '6g',
            'fat': '2g',
            'fiber': '0g'
        },
        'ingredients': [
            'Yoğurt',
            'Su',
            'Tuz'
        ],
        'allergens': [
            'Süt ürünleri'
        ]
    },
    'su': {
        'name': 'Su (0.5L)',
        'price': 5.00,
        'calories': 0,
        'nutrition': {
            'protein': '0g',
            'carbs': '0g',
            'fat': '0g',
            'fiber': '0g'
        },
        'ingredients': [
            'İçme suyu'
        ],
        'allergens': []
    },
    'ekmek': {
        'name': 'Ekmek',
        'price': 2.00,
        'calories': 80,
        'nutrition': {
            'protein': '3g',
            'carbs': '15g',
            'fat': '1g',
            'fiber': '1g'
        },
        'ingredients': [
            'Un',
            'Su',
            'Maya',
            'Tuz'
        ],
        'allergens': [
            'Gluten'
        ]
    },
    'cig_kofte': {
        'name': 'Çiğ Köfte',
        'price': 35.00,
        'calories': 220,
        'nutrition': {
            'protein': '8g',
            'carbs': '40g',
            'fat': '2g',
            'fiber': '4g'
        },
        'ingredients': [
            'Bulgur',
            'Domates salçası',
            'Biber salçası',
            'Soğan',
            'Baharatlar',
            'Limon'
        ],
        'allergens': [
            'Gluten'
        ]
    },
    'kasik': {
        'name': 'Kaşık',
        'price': 0.50,
        'calories': 0,
        'nutrition': {
            'protein': '0g',
            'carbs': '0g',
            'fat': '0g',
            'fiber': '0g'
        },
        'ingredients': [],
        'allergens': []
    },
    'catal': {
        'name': 'Çatal',
        'price': 0.50,
        'calories': 0,
        'nutrition': {
            'protein': '0g',
            'carbs': '0g',
            'fat': '0g',
            'fiber': '0g'
        },
        'ingredients': [],
        'allergens': []
    }
}

# YOLO model yükleme fonksiyonu
def load_yolo_model(model_path):
    try:
        model = YOLO(model_path)
        print(f"YOLO modeli başarıyla yüklendi: {model_path}")
        return model
    except Exception as e:
        print(f"Model yüklenirken hata oluştu: {e}")
        return None

# Base64 encoded görüntüyü numpy array'e dönüştürme
def base64_to_image(base64_string):
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

# Görüntü işleme ve segmentasyon
async def process_image(model, image, confidence_threshold=0.5, filter_classes=None):
    try:
        start_time = time.time()
        
        # Modeli kullanarak tahmin yap (YOLO kendi içinde resize işlemi yapar)
        results = model.predict(
            source=image,
            conf=confidence_threshold,
            iou=0.45,
            retina_masks=True,
            imgsz=640,
        )
        
        detections = []
        
        # Her bir sonuç için
        for result in results:
            boxes = result.boxes
            masks = result.masks
            
            if masks is None:
                continue
                
            for i, (box, mask) in enumerate(zip(boxes, masks.data)):
                class_id = int(box.cls.item())
                class_name = result.names[class_id]
                confidence = box.conf.item()
                
                # Sınıf filtresi uygula
                if filter_classes and class_name not in filter_classes:
                    continue
                
                # Sınırlayıcı kutu
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                bbox = [x1, y1, x2, y2]
                
                # Segmentasyon maskesi için polygon koordinatlarını al
                # Ultralytics YOLO, result.masks.xy ile direkt polygon koordinatlarını sağlıyor
                polygon = []
                if hasattr(masks, 'xy') and i < len(masks.xy):
                    # Direkt polygon koordinatlarını al
                    polygon = masks.xy[i].tolist()
                else:
                    # Eski yönteme geri dön (uyumluluk için)
                    print("DEBUG: ESKİ YÖNTEM KULLANILIYOR DAMNNNNNNNNNNNNNNNNN FK MY LIFE")
                    mask_np = mask.cpu().numpy().astype(np.uint8) * 255
                    contours, _ = cv2.findContours(mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if contours:
                        max_contour = max(contours, key=cv2.contourArea)
                        polygon = max_contour.reshape(-1, 2).tolist()
                
                # Normalize edilmiş sınıf adı
                normalized_class = class_name.lower().replace(' ', '_')
                
                # Sonuç objesi
                detection = {
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': bbox,
                    'segments': polygon
                }
                
                # Veritabanından beslenme bilgilerini ekle
                if normalized_class in FOOD_DATABASE:
                    food_info = FOOD_DATABASE[normalized_class]
                    detection['food_info'] = food_info
                else:
                    # Veritabanında yoksa genel bilgi oluştur
                    detection['food_info'] = {
                        'name': class_name,
                        'price': round(15.0 + (confidence * 30.0), 2),  # Güven oranına göre fiyat
                        'calories': int(100 + (confidence * 200)),      # Güven oranına göre kalori
                        'nutrition': {
                            'protein': f"{int(5 + (confidence * 15))}g",
                            'carbs': f"{int(10 + (confidence * 30))}g",
                            'fat': f"{int(3 + (confidence * 12))}g",
                            'fiber': f"{int(1 + (confidence * 4))}g"
                        },
                        'ingredients': ["Bilinmiyor"],
                        'allergens': []
                    }
                
                # Sonucu ekle
                detections.append(detection)
        
        processing_time = time.time() - start_time
        
        
        """ Sunucudan gönderilecek format:
        {
        "success": true,
        "data": [
            {
            "class": "sınıf_adı",
            "confidence": 0.95,
            "segments": [...], // Segment poligon noktaları
            "bbox": [x1, y1, x2, y2], // Sınırlayıcı kutu
            },
            // Diğer nesneler...
        ],
        "processing_time": 0.123 // İşlem süresi (saniye)
        }
        """
        
        # #gönderilen veriyi bir not defterine yazalım. türkçe karakterler için utf-8 ile açalım.
        # #succes data ve processing_time'ı json formatında bir dosyaya yazalım.
        # with open("result.json", "w", encoding="utf-8") as f:
        #     json.dump({
        #         'success': True,
        #         'data': detections,
        #         'processing_time': processing_time
        #     }, f, ensure_ascii=False, indent=4)
        
        
        return {
            'success': True,
            'data': detections,
            'processing_time': processing_time
        }
    
    except Exception as e:
        print(f"Görüntü işlenirken hata oluştu: {e}")
        return {
            'success': False,
            'error': str(e)
        }

# WebSocket bağlantı işleyicisi
async def websocket_handler(websocket, model):
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
            "type": "image", // veya "webcam"
            "data": "base64_encoded_image_data", // Görüntü verisi
            "config": {
                "confidence": 0.5, // Tespit eşiği örneğin 0.5
                "classes": [] // Filtrelenecek sınıflar (boş ise tümü)
            }
        }
        '''
        async for message in websocket:
            try:
                # JSON mesajı ayrıştır
                data = json.loads(message)
                
                # İşlem türünü kontrol et
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
                    result = await process_image(model, img, confidence, classes)
                    
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
        print(f"WebSocket işleyicide hata oluştu: {e}")

# Ana uygulama
async def main():
    
    #Websocket sunucusunu başlatmadan önce modeli yükleyelim.
    model = load_yolo_model("my_yolo_model.pt")
    
    # WebSocket sunucusunu başlat
    host = "localhost"
    port = 8765
    
    # Handler'a model parametresini ileterek başlat
    server = await websockets.serve(
        lambda ws: websocket_handler(ws, model),
        host,
        port
    )
    
    print(f"WebSocket sunucusu başlatıldı: ws://{host}:{port}")
    
    # Sunucuyu sürekli çalıştır
    await server.wait_closed()

# Uygulamayı başlat
if __name__ == "__main__":
    asyncio.run(main())