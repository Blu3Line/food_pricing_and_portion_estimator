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
                
                # Sonuç objesi
                detection = {
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': bbox,
                    'segments': polygon
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