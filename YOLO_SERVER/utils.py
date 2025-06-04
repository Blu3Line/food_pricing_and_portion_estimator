import base64
import cv2
import numpy as np
import statistics
import math
from YOLO_SERVER.config import REFERENCE_OBJECTS, DEFAULT_SCALE_FACTOR

def load_food_database():
    """
    Load food database from SQLite
    TR: SQLite veritabanından yemek veritabanını yükler.
    """
    try:
        from YOLO_SERVER.database import load_food_database_from_sqlite
        food_db = load_food_database_from_sqlite()
        print(f"Food database loaded from SQLite successfully: {len(food_db)} items")
        return food_db
    except Exception as e:
        print(f"Error loading food database from SQLite: {e}")
        raise Exception(f"SQLite veritabanı yüklenemedi: {e}")

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

# Segmentasyon geometrisini analiz et
def analyze_segment_geometry(segments):
    """
    Analyze segment geometry to extract useful parameters for volume estimation
    TR: Hacim tahmini için segment geometrisini analiz eder
    """
    if not segments or len(segments) < 3:
        return {"area": 0, "circularity": 0.0}
    
    points = np.array(segments, dtype=np.int32)
    
    # Alan hesapla
    area = cv2.contourArea(points)
    
    # Çevre hesapla
    perimeter = cv2.arcLength(points, True)
    
    # Dairesellik (circularity) - daire ne kadar yakın 0-1 arası, 1=mükemmel daire
    circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
    
    return {
        "area": area,
        "circularity": circularity
    }

# Dinamik yükseklik tahmini
def estimate_dynamic_height(food_type, geometry_info, base_height_cm):
    """
    Estimate dynamic height based on food type and geometry
    TR: Yemek tipi ve geometriye göre dinamik yükseklik tahmini
    """
    area_cm2 = geometry_info["area"]
    circularity = geometry_info["circularity"]
    equivalent_diameter = math.sqrt(area_cm2 / math.pi) * 2  # Eşdeğer çap (cm)
    
    # Farklı yemek tiplerini kategorize et
    liquid_foods = ["corba"]
    flat_foods = ["makarna", "tavuk_kul_basti", "cig_kofte", "salata"]
    dome_foods = ["pirinc_pilav", "bulgur_pilav"]
    irregular_foods = ["tavuk_but", "tavuk_sote", "kuru_fasulye"]
    
    height_multiplier = 1.0
    
    if food_type in liquid_foods:
        # Sıvı yemekler: Tabak boyutuna göre derinlik değişir
        if equivalent_diameter > 8:  # Büyük tabak (>8cm çap)
            height_multiplier = 0.6  # Daha sığ
        elif equivalent_diameter > 5:  # Orta tabak (5-8cm arası)
            height_multiplier = 0.8
        else:  # Küçük kase (<5cm)
            height_multiplier = 1.3  # Daha derin
            
    elif food_type in flat_foods:
        # Düz yemekler: Şekle göre yükseklik ayarı
        if food_type == "makarna":
            # Makarna biraz daha kalın olabilir
            height_multiplier = 0.6 + (circularity * 0.4)  # 0.6-1.0 arası
        elif food_type == "salata":
            # Salata gevşek doldurulur
            height_multiplier = 0.8 + (circularity * 0.3)  # 0.8-1.1 arası
        else:
            # Diğer düz yemekler
            height_multiplier = 0.5 + (circularity * 0.3)  # 0.5-0.8 arası
        
    elif food_type in dome_foods:
        # Kubbe şekilli yemekler: Pilav türleri
        # Büyük porsiyonlarda daha yüksek yığılır
        size_factor = min(equivalent_diameter / 8, 1.5)  # 8cm referans
        height_multiplier = 0.9 + (size_factor * 0.4)  # 0.9-1.3 arası
        
    elif food_type in irregular_foods:
        # Düzensiz şekilli yemekler
        if food_type == "tavuk_but":
            # Tavuk but kalın et parçası
            height_multiplier = 1.1 + (min(area_cm2 / 20, 0.5))  # 1.1-1.6 arası
        elif food_type == "kuru_fasulye":
            # Fasulye soslu, orta yükseklik
            height_multiplier = 0.8 + (circularity * 0.3)  # 0.8-1.1 arası
        else:
            # Diğer irregular foods
            # if aspect_ratio > 2.0:  # Uzun şekiller
            #     height_multiplier = 1.0 + (min(area_cm2 / 30, 0.4))
            # else:
            #     height_multiplier = 0.9 + (circularity * 0.4)
            height_multiplier = 1.0
    
    # Minimum ve maksimum sınırları (daha realistik)
    height_multiplier = max(0.4, min(1.8, height_multiplier))
    
    estimated_height = base_height_cm * height_multiplier
    
    return estimated_height

# Gelişmiş hacim hesaplama
def compute_advanced_volume(food_type, area_cm2, estimated_height_cm, geometry_info):
    """
    Calculate volume using advanced geometric approximations
    TR: Gelişmiş geometrik yaklaşımlarla hacim hesaplar
    """
    circularity = geometry_info["circularity"]
    
    # Yemek tipine göre hacim hesaplama stratejisi
    liquid_foods = ["corba"]
    flat_foods = ["makarna", "tavuk_kul_basti", "cig_kofte", "salata"]
    dome_foods = ["pirinc_pilav", "bulgur_pilav"]
    irregular_foods = ["tavuk_but", "tavuk_sote", "kuru_fasulye"]
    
    if food_type in liquid_foods:
        # Sıvı yemekler: Silindir yaklaşımı
        volume = area_cm2 * estimated_height_cm
        
    elif food_type in flat_foods:
        # Düz yemekler: Eliptik silindir
        volume = area_cm2 * estimated_height_cm * 0.85  # Düzlük faktörü
        
    elif food_type in dome_foods:
        # Kubbe şekilli: Yarım elipsoid yaklaşımı
        # V = (2/3) * π * a * b * c (a,b = yarı eksenler, c = yükseklik)
        radius = math.sqrt(area_cm2 / math.pi)  # Eşdeğer dairenin yarıçapı
        volume = (2/3) * math.pi * radius * radius * estimated_height_cm
        
    elif food_type in irregular_foods:
        # Düzensiz şekiller: Karmaşık geometri approximation
        if circularity > 0.7:  # Daire benzeri
            # Yarım küre yaklaşımı
            radius = math.sqrt(area_cm2 / math.pi)
            volume = (2/3) * math.pi * (radius ** 2) * estimated_height_cm
        else:
            # Düzensiz prizma
            volume = area_cm2 * estimated_height_cm * 0.75  # Düzensizlik faktörü
    else:
        # Varsayılan: Basit prizma
        volume = area_cm2 * estimated_height_cm
    
    return max(volume, 0.1)  # Minimum hacim

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
def calculate_scale_factor_from_bbox_area(reference_objects):
    """
    Calculate scale factor using the entire bounding box area of reference objects
    TR: Referans nesnelerin tüm sınırlayıcı kutu alanını kullanarak ölçek faktörü hesaplar.
    """
    scale_factors = []
    
    for obj in reference_objects:
        if obj["class"] in ["catal", "kasik"]:
            # Get reference object's real area in cm²
            ref_area_cm2 = REFERENCE_OBJECTS[obj["class"]]["area"]
            
            # Get bounding box coordinates
            x1, y1, x2, y2 = obj["bbox"]
            
            # Calculate area of bounding box in pixels²
            bbox_area_px = (x2 - x1) * (y2 - y1)
            
            if bbox_area_px > 0:
                # Calculate cm² per pixel²
                scale_factor = ref_area_cm2 / bbox_area_px
                scale_factors.append(scale_factor)
    
    # Return median scale factor or default if none found
    if scale_factors:
        return statistics.median(scale_factors)
    # hiçbir referans nesne yoksa varsayılan ölçek faktörünü kullan (çatal veya kaşık yok)
    return DEFAULT_SCALE_FACTOR

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