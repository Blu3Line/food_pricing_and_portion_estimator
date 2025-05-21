import json
import base64
import cv2
import numpy as np
import statistics
from YOLO_SERVER.config import REFERENCE_OBJECTS, DEFAULT_SCALE_FACTOR

def load_food_database(json_path):
    """
    Load food database from a JSON file
    TR: JSON dosyasından yemek veritabanını yükler.
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            food_db = json.load(f)
        print(f"Food database loaded successfully: {json_path}")
        return food_db
    except Exception as e:
        print(f"Error loading food database: {e}")
        return {}

# Base64 encoded görüntüyü numpy array'e dönüştürme
def base64_to_image(base64_string):
    """
    Convert base64 encoded image to numpy array
    TR: Base64 kodlanmış görüntüyü numpy dizisine dönüştürür.
    """
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

# Segmentasyon alanını hesapla (piksel cinsinden)
def calculate_segment_area(segments):
    """
    Calculate area of segmentation polygon in pixels
    TR: Segmentasyon poligonunun alanını piksel cinsinden hesaplar.
    """
    if not segments or len(segments) < 3: # En az 3 nokta gerekli
        return 0.0
    # Kontrol: Segmentler [x, y] formatında mı?
    valid_segments = []
    for seg in segments:
        if isinstance(seg, list) and len(seg) == 2:
            valid_segments.append(seg)
    
    if len(valid_segments) < 3: # Geçerli segment sayısı kontrol
        return 0.0
    
    # Numpy dizisine dönüştür
    points = np.array(valid_segments, dtype=np.int32)
    # Poligon alanını hesapla
    area = cv2.contourArea(points)
    return area

# Ölçek faktörünü hesapla
def compute_scale_factor(ref_area_cm2, ref_area_px):
    """
    Calculate scale factor (cm²/pixel²)
    TR: 1 piksel kareden kaç cm kare olduğunu hesaplar.
    """
    if ref_area_px <= 0:
        return DEFAULT_SCALE_FACTOR
    return ref_area_cm2 / ref_area_px

# Piksel alanını cm² cinsinden hesapla resimde gerçek alanı bulmak için ilgili yemeğin
def pixel_area_to_cm2(pixel_area, scale_factor):
    """
    Convert pixel area to cm²
    TR: Piksel alanını cm² cinsine dönüştürür.
    """
    return pixel_area * scale_factor

# Hacim hesaplama (food_volume = real_food_area_cm2 * food_height_cm)
def compute_volume(area_cm2, height_cm):
    """
    Calculate volume using surface area and height (cm³)
    TR: Yüzey alanı ve yükseklik kullanarak hacim hesaplar (cm³).
    """
    return area_cm2 * height_cm

# Kütle hesaplama (food_mass_g = food_volume_cm3 * food_density_g_per_cm3)
def compute_mass(volume_cm3, density_g_per_cm3):
    """
    Calculate mass using volume and density (grams)
    TR: Hacim ve yoğunluk kullanarak kütle hesaplar (gram).
    """
    return volume_cm3 * density_g_per_cm3

# Porsiyon hesaplama (food_portion = food_mass_g / food_portion_reference_mass_g)
def compute_portion(mass_g, std_mass_g):
    """
    Calculate portion size based on mass
    TR: Hesaplanan kütle ve standart kütle kullanarak porsiyon hesaplar.
    """
    if std_mass_g <= 0:
        return 1.0
    return mass_g / std_mass_g

#Porsiyonu 0.5'lik artışlarla yuvarla
def round_to_nearest_portion(calculated_portion):
    """
    Round calculated portion to nearest 0.5
    TR: Hesaplanan porsiyon değerini 0.5'lik artışlarla yuvarlar.
    """
    # Önce minimum değer kontrolü
    if calculated_portion < 0.3:
        return 0.5  # Minimum porsiyon 0.5
    # Sonra maksimum değer kontrolü 3 porsiyon olarak ayarlandı
    if calculated_portion > 3.0:
        return 3.0  # Maksimum porsiyon 3.0
    
    # 0.5'lik artışlara yuvarla
    return round(calculated_portion * 2) / 2

# Sağlam ölçek faktörü hesaplama (birden fazla referans için)
def calculate_robust_scale_factor(reference_objects):
    """
    Calculate median scale factor from multiple reference objects
    TR: Birden fazla referans nesnesi olduğunda ortalama ölçek faktörü hesaplar.
    """
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
    """
    Scale nutrition values based on portion size
    TR: Besin değerlerini porsiyon miktarına göre ölçeklendirir.
    """
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