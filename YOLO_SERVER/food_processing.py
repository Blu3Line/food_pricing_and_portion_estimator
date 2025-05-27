import time
from YOLO_SERVER.model import predict_with_yolo, extract_polygon_from_mask
from YOLO_SERVER.utils import (
    calculate_segment_area, calculate_scale_factor_from_bbox_area,
    pixel_area_to_cm2, compute_volume, compute_mass,
    compute_portion, round_to_nearest_portion, scale_nutrition_values
)
from YOLO_SERVER.config import DEFAULT_FOOD_HEIGHT_CM, DEFAULT_FOOD_DENSITY, DEFAULT_PORTION_MASS

def create_generic_food_info(class_name, confidence):
    """
    Create generic food information when not found in database
    TR: Veritabanında bulunamadığında genel bilgi oluştur (rastgele veri).
    """
    return {
        'name': class_name,
        'price': round(15.0 + (confidence * 30.0), 2),  # Price based on confidence
        'calories': int(100 + (confidence * 200)),      # Calories based on confidence
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

# Görüntü işleme ve segmentasyon
async def process_image(model, image, food_database, confidence_threshold=0.5, filter_classes=None):
    """
    Process image to detect and analyze food items
    TR: Görüntüyü tespit edip analiz eder.
    """
    try:
        start_time = time.time()
        
        # Run YOLO prediction
        results = predict_with_yolo(model, image, confidence_threshold)
        
        detections = []
        reference_objects = []
        
        # Process each detection result (her bir tahmin sonucu için)
        for result in results:
            boxes = result.boxes
            masks = result.masks
            
            if masks is None:
                continue
                
            for i, (box, mask) in enumerate(zip(boxes, masks.data)):
                class_id = int(box.cls.item())
                class_name = result.names[class_id]
                confidence = box.conf.item()
                
                # Apply class filter if specified (sınıf filtresi uygula)
                if filter_classes and class_name not in filter_classes:
                    continue
                
                # Get bounding box (sınırlayıcı kutu)
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                bbox = [x1, y1, x2, y2]
                
                # Segmentasyon maskesi için polygon koordinatlarını al
                # Ultralytics YOLO, result.masks.xy ile direkt polygon koordinatlarını sağlıyor
                polygon = []
                if hasattr(masks, 'xy') and i < len(masks.xy):
                    # Direct polygon coordinates from Ultralytics
                    polygon = masks.xy[i].tolist()
                else:
                    # Fallback method
                    print("DEBUG: ESKİ YÖNTEM KULLANILIYOR DAMNNNNNNNNNNNNNNNNN BUNA BAK ÖNEMLİ")
                    polygon = extract_polygon_from_mask(mask)
                
                # Normalize class name (normalize edilmiş sınıf adı)
                normalized_class = class_name.lower().replace(' ', '_')
                
                # Create detection object (tahmin sonucu objesi)
                detection = {
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': bbox,
                    'segments': polygon
                }
                
                # Add food information from database (veritabanından beslenme bilgilerini ekle)
                if normalized_class in food_database:
                    food_info = food_database[normalized_class].copy()
                    detection['food_info'] = food_info
                else:
                    print(f"Veritabanında bulunamadı: {normalized_class} random değerler oluşturulacak")
                    # Veritabanında yoksa genel bilgi oluştur
                    detection['food_info'] = create_generic_food_info(class_name, confidence)
                
                # Add reference objects to separate list (Çatal veya kaşık ise referans nesneleri ayrı listeye ekle)
                if normalized_class in ["catal", "kasik"]:
                    reference_objects.append(detection)
                
                # Sonuç objesini ekle
                detections.append(detection)
        
        # Ölçek faktörünü hesapla
        scale_factor = calculate_scale_factor_from_bbox_area(reference_objects)
        print(f"Hesaplanan ölçek faktörü: {scale_factor}")
        
        # Track total price and calories
        total_price = 0
        total_calories = 0
        
        # Her bir yiyecek için porsiyon hesapla ve diğer verileri güncelle
        for detection in detections:
            
            # Yiyecek bilgisi
            food_info = detection["food_info"]
            
            # Porsiyon bazlı mı kontrol et
            if 'portion_based' in food_info and food_info['portion_based']:
                # Segmentasyon alanı (piksel)
                segment_area_px = calculate_segment_area(detection["segments"])
                
                # Gerçek dünya alanı (cm²)
                real_area_cm2 = pixel_area_to_cm2(segment_area_px, scale_factor)
                
                # Yiyecek yüksekliği ve yoğunluğu
                food_height_cm = food_info.get('food_height_cm', DEFAULT_FOOD_HEIGHT_CM)
                food_density = food_info.get('food_density_g_per_cm3', DEFAULT_FOOD_DENSITY)
                std_portion_mass = food_info.get('food_portion_reference_mass_g', DEFAULT_PORTION_MASS)
                
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
                # Porsiyon bazlı olmayan yiyecekler için direkt fiyat ve kalori kullan
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
        print(f"Error processing image: {e}")
        return {
            'success': False,
            'error': str(e)
        } 