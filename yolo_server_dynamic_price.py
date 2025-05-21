import asyncio
import json
import base64
import time
import io
import cv2
import numpy as np
import statistics
from urllib.parse import urlparse
import websockets
from ultralytics import YOLO
from PIL import Image
import os

# Referans nesne boyutları (cm cinsinden)
REFERENCE_OBJECTS = {
    "catal": {
        "length": 19.0,  # Çatal uzunluğu (cm)
        "width": 2.5,    # Çatal genişliği (cm)
        "area": 15.0     # Yaklaşık alan (cm²)
    },
    "kasik": {
        "length": 19.5,  # Kaşık uzunluğu (cm)
        "width": 4.5,    # Kaşık genişliği (cm)
        "area": 15.0     # Yaklaşık alan (cm²)
    }
}

# Varsayılan ölçek faktörü (hiçbir referans nesne tespit edilemediğinde)
DEFAULT_SCALE_FACTOR = 0.003  # 1 piksel² = 0.003 cm²

# Yemek veritabanını dosyadan yükle
def load_food_database(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            food_db = json.load(f)
        print(f"Yemek veritabanı başarıyla yüklendi: {json_path}")
        return food_db
    except Exception as e:
        print(f"Yemek veritabanı yüklenirken hata oluştu: {e}")
        return {}

# Yemek veritabanını yükle
current_dir = os.path.dirname(os.path.abspath(__file__))
food_db_path = os.path.join(current_dir, 'foodsDB.json')
FOOD_DATABASE = load_food_database(food_db_path)

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

# Segmentasyon alanını hesapla (piksel cinsinden)
def calculate_segment_area(segments):
    """Segmentasyon poligonunun alanını piksel cinsinden hesaplar."""
    if not segments or len(segments) < 3:  # En az 3 nokta gerekli
        return 0.0
    
    # Kontrol: Segmentler [x, y] formatında mı?
    valid_segments = []
    for seg in segments:
        if isinstance(seg, list) and len(seg) == 2:
            valid_segments.append(seg)
    
    if len(valid_segments) < 3:  # Geçerli segment sayısı kontrol
        return 0.0
    
    # Numpy dizisine dönüştür
    points = np.array(valid_segments, dtype=np.int32)
    
    # Poligon alanını hesapla
    area = cv2.contourArea(points)
    return area

# Ölçek faktörünü hesapla
def compute_scale_factor(ref_area_cm2, ref_area_px):
    """1 piksel kareden kaç cm kare olduğunu hesaplar."""
    if ref_area_px <= 0:
        return DEFAULT_SCALE_FACTOR
    return ref_area_cm2 / ref_area_px

# Piksel alanını cm² cinsinden hesapla resimde gerçek alanı bulmak için ilgili yemeğin
def pixel_area_to_cm2(pixel_area, scale_factor):
    """Piksel cinsinden alanı cm² cinsine dönüştürür."""
    return pixel_area * scale_factor

# Hacim hesaplama (food_volume = real_food_area_cm2 * food_height_cm)
def compute_volume(area_cm2, height_cm):
    """Yüzey alanı ve yükseklik kullanarak hacim hesaplar (cm³)."""
    return area_cm2 * height_cm

# Kütle hesaplama (food_mass_g = food_volume_cm3 * food_density_g_per_cm3)
def compute_mass(volume_cm3, density_g_per_cm3):
    """Hacim ve yoğunluk kullanarak kütle hesaplar (gram)."""
    return volume_cm3 * density_g_per_cm3

# Porsiyon hesaplama (food_portion = food_mass_g / food_portion_reference_mass_g)
def compute_portion(mass_g, std_mass_g):
    """Hesaplanan kütle ve standart kütle kullanarak porsiyon hesaplar."""
    if std_mass_g <= 0:
        return 1.0
    return mass_g / std_mass_g

# Porsiyonu 0.5'lik artışlarla yuvarla
def round_to_nearest_portion(calculated_portion):
    """Hesaplanan porsiyon değerini 0.5'lik artışlarla yuvarlar."""
    # Önce minimum değer kontrolü
    if calculated_portion < 0.3:
        return 0.5  # Minimum porsiyon 0.5
    # Sonra maksimum değer kontrolü 3 porsiyon olarak ayarlandı
    if calculated_portion > 3.0:
        return 3.0
    
    # 0.5'lik artışlara yuvarla
    return round(calculated_portion * 2) / 2

# Sağlam ölçek faktörü hesaplama (birden fazla referans için)
def calculate_robust_scale_factor(reference_objects):
    """Birden fazla referans nesnesi olduğunda ortalama ölçek faktörü hesaplar."""
    scale_factors = []
    for obj in reference_objects:
        if obj["class"] in ["catal", "kasik"]:
            ref_area_cm2 = REFERENCE_OBJECTS[obj["class"]]["area"]
            pixel_area = calculate_segment_area(obj["segments"])
            
            if pixel_area > 0:
                scale_factors.append(ref_area_cm2 / pixel_area)
    
    # Ortalama veya medyan kullanma
    if scale_factors:
        return statistics.median(scale_factors)
    return DEFAULT_SCALE_FACTOR # hiçbir referans nesne yoksa varsayılan ölçek faktörünü kullan (çatal veya kaşık yok)

# Besin değerlerini porsiyona göre güncelleme
def scale_nutrition_values(nutrition, portion):
    """Besin değerlerini porsiyon miktarına göre ölçeklendirir."""
    scaled_nutrition = {}
    for key, value in nutrition.items():
        # Değer formatı: "10g", "5mg" gibi
        if isinstance(value, str):
            # Sayısal kısmı ve birimi ayır
            num_part = ''.join(c for c in value if c.isdigit() or c == '.')
            unit_part = ''.join(c for c in value if not (c.isdigit() or c == '.'))
            
            try:
                num_value = float(num_part)
                # Değeri porsiyona göre ölçeklendir ve aynı formatta geri döndür
                scaled_value = f"{round(num_value * portion, 1)}{unit_part}"
                scaled_nutrition[key] = scaled_value
            except ValueError:
                # Sayısal dönüşüm başarısız olursa orijinal değeri kullan
                scaled_nutrition[key] = value
        else:
            # Sayısal değerleri doğrudan ölçeklendir
            scaled_nutrition[key] = value * portion
    
    return scaled_nutrition

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
        reference_objects = []
        
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
                    print("DEBUG: ESKİ YÖNTEM KULLANILIYOR DAMNNNNNNNNNNNNNNNNN")
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
                    food_info = FOOD_DATABASE[normalized_class].copy()
                    detection['food_info'] = food_info
                else:
                    print(f"Veritabanında bulunamadı: {normalized_class} random değerler oluşturulacak")
                    # Veritabanında yoksa genel bilgi oluştur
                    detection['food_info'] = {
                        'name': class_name,
                        'price': round(15.0 + (confidence * 30.0), 2),  # Güven oranına göre fiyat
                        'calories': int(100 + (confidence * 200)),      # Güven oranına göre kalori
                        'portion_based': False,
                        'nutrition': {
                            'protein': f"{int(5 + (confidence * 15))}g",
                            'carbs': f"{int(10 + (confidence * 30))}g",
                            'fat': f"{int(3 + (confidence * 12))}g",
                            'fiber': f"{int(1 + (confidence * 4))}g"
                        },
                        'ingredients': ["Bilinmiyor"],
                        'allergens': []
                    }
                
                # Çatal veya kaşık ise referans nesneler listesine ekle
                if normalized_class in ["catal", "kasik"]:
                    reference_objects.append(detection)
                
                # Sonucu ekle
                detections.append(detection)
        
        # Ölçek faktörünü hesapla
        scale_factor = calculate_robust_scale_factor(reference_objects)
        print(f"Hesaplanan ölçek faktörü: {scale_factor}")
        
        # Toplam fiyat ve kalori takibi
        total_price = 0
        total_calories = 0
        
        # Her bir yiyecek için porsiyon hesapla ve diğer verileri güncelle
        for detection in detections:
            # Normalize edilmiş sınıf adı
            normalized_class = detection["class"].lower().replace(' ', '_')
            
            # Yiyecek bilgisi
            food_info = detection["food_info"]
            
            # Porsiyon bazlı mı kontrol et
            if 'portion_based' in food_info and food_info['portion_based']:
                # Segmentasyon alanı (piksel)
                segment_area_px = calculate_segment_area(detection["segments"])
                
                # Gerçek dünya alanı (cm²)
                real_area_cm2 = pixel_area_to_cm2(segment_area_px, scale_factor)
                
                # Yiyecek yüksekliği ve yoğunluğu
                food_height_cm = food_info.get('food_height_cm', 2.0)
                food_density = food_info.get('food_density_g_per_cm3', 0.8)
                std_portion_mass = food_info.get('food_portion_reference_mass_g', 150)
                
                # Hacim ve kütle hesapla
                volume_cm3 = compute_volume(real_area_cm2, food_height_cm)
                mass_g = compute_mass(volume_cm3, food_density)
                
                # Porsiyon hesapla ve yuvarla
                raw_portion = compute_portion(mass_g, std_portion_mass)
                portion = round_to_nearest_portion(raw_portion)
                
                # Hesaplama detaylarını yazdır (debug)
                print(f"{food_info['name']} için hesaplama:")
                print(f"  Segment Alanı: {segment_area_px:.2f} piksel²")
                print(f"  Gerçek Alan: {real_area_cm2:.2f} cm²")
                print(f"  Hacim: {volume_cm3:.2f} cm³")
                print(f"  Kütle: {mass_g:.2f} g")
                print(f"  Ham Porsiyon: {raw_portion:.2f}")
                print(f"  Yuvarlanmış Porsiyon: {portion}")
                
                # Porsiyon bilgilerini ekle
                food_info['portion'] = portion
                food_info['base_price'] = food_info['price']
                food_info['portion_price'] = round(food_info['price'] * portion, 2)
                
                # Besin değerlerini güncelle
                original_calories = food_info['calories']
                food_info['calories'] = int(original_calories * portion)
                
                if 'nutrition' in food_info:
                    food_info['nutrition'] = scale_nutrition_values(food_info['nutrition'], portion)
                
                # Toplam hesaplar için porsiyon fiyatını kullan
                total_price += food_info['portion_price']
                total_calories += food_info['calories']
            else:
                # Porsiyon bazlı değilse direkt fiyatı ve kaloriyi ekle
                total_price += food_info['price']
                total_calories += food_info['calories']
        
        processing_time = time.time() - start_time
        
        return {
            'success': True,
            'data': detections,
            'total_price': round(total_price, 2),
            'total_calories': total_calories,
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