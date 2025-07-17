import cv2
import numpy as np
import torch
import os
import sys
from ultralytics import YOLO
import time
import statistics
import math

# Model dosya yolunu tanımlayın
MODEL_PATH = os.path.join(os.path.dirname(__file__), "my_yolo_model.pt")

# Referans nesne boyutları (cm cinsinden)
REFERENCE_OBJECTS = {
    "catal": {
        "length": 19.5,  # Çatal uzunluğu (cm)
        "width": 2.5,    # Çatal genişliği (cm)
        "area": 48.75     # Yaklaşık alan (cm²)
    },
    "kasik": {
        "length": 19.5,  # Kaşık uzunluğu (cm)
        "width": 4.5,    # Kaşık genişliği (cm)
        "area": 87.75     # Yaklaşık alan (cm²)
    }
}

# YOLO model yükleme fonksiyonu
def load_yolo_model(model_path):
    try:
        # GPU kullanılabilirliğini kontrol et
        if not torch.cuda.is_available():
            print("UYARI: CUDA kullanılamıyor. GPU bulunamadı veya CUDA kurulu değil.")
            return None
        
        # GPU'yu zorla kullan
        device = torch.device("cuda")
        print(f"GPU kullanılacak: {torch.cuda.get_device_name(0)}")
        
        # Modeli GPU'ya yükle
        model = YOLO(model_path)
        model.to(device)  # Modeli GPU'ya taşı
        
        # GPU kullanımını zorla
        torch.set_default_tensor_type('torch.cuda.FloatTensor')
        
        print(f"YOLO modeli başarıyla GPU'ya yüklendi: {model_path}")
        return model
    except Exception as e:
        print(f"Model yüklenirken hata oluştu: {e}")
        return None

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
                print(f"🔍 {obj['class']} - BBox: {bbox_area_px:.1f}px², Gerçek: {ref_area_cm2}cm², Scale: {scale_factor:.6f}")
    
    # Return median scale factor if reference objects found
    if scale_factors:
        median_scale = statistics.median(scale_factors)
        print(f"📏 Ölçek faktörü hesaplandı: {median_scale:.6f} (bulunan faktör sayısı: {len(scale_factors)})")
        return median_scale
    
    # Eğer referans nesne yoksa None döndür
    print("⚠️  UYARI: Geçerli referans nesnesi bulunamadı - ölçek faktörü hesaplanamıyor")
    return None

def pixel_area_to_cm2(pixel_area, scale_factor):
    """
    Convert pixel area to cm²
    TR: Piksel alanını cm² cinsine dönüştürür.
    """
    if scale_factor is None:
        # Eğer scale_factor yoksa, varsayılan bir değer kullan (örneğin 1 piksel = 0.1 cm²)
        print("⚠️  UYARI: scale_factor None, varsayılan değer kullanılıyor (1 piksel = 0.1 cm²)")
        scale_factor = 0.1
    return pixel_area * scale_factor

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

def process_detections_with_scale(results, scale_factor):
    """
    Process YOLO detection results and calculate real-world measurements
    TR: YOLO tespit sonuçlarını işler ve gerçek dünya ölçümlerini hesaplar
    """
    reference_objects = []
    food_objects = []
    
    for result in results:
        boxes = result.boxes
        masks = result.masks
        
        if boxes is not None:
            for i, box in enumerate(boxes):
                # Sınıf bilgisi
                cls_id = int(box.cls.cpu().numpy())
                class_name = result.names[cls_id]
                confidence = float(box.conf.cpu().numpy())
                
                # Bounding box koordinatları
                x1, y1, x2, y2 = box.xyxy.cpu().numpy()[0]
                bbox_area_px = (x2 - x1) * (y2 - y1)
                
                detection_info = {
                    "class": class_name,
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2],
                    "bbox_area_px": bbox_area_px
                }
                
                # Segmentasyon alanı varsa ekle
                if masks is not None and i < len(masks.xy):
                    # Segmentasyon poligonu
                    segments = masks.xy[i].tolist()
                    if segments:
                        segment_area_px = calculate_segment_area(segments)
                        detection_info["segments"] = segments
                        detection_info["segment_area_px"] = segment_area_px
                        
                        # Gerçek dünya alanını hesapla
                        if scale_factor is not None:
                            real_area_cm2 = pixel_area_to_cm2(segment_area_px, scale_factor)
                            detection_info["real_area_cm2"] = real_area_cm2
                
                # Referans nesneler ve yemek nesneleri ayır
                if class_name in ["catal", "kasik"]:
                    reference_objects.append(detection_info)
                else:
                    food_objects.append(detection_info)
    
    return reference_objects, food_objects

def webcam_detection(model):
    """Webcam üzerinden gerçek zamanlı segmentasyon yapar"""
    # Farklı kamera indekslerini dene
    camera_indices = [0, 1, 2]  # Daha fazla indeks ekleyebilirsiniz
    cap = None
    
    for idx in camera_indices:
        if idx == 0 or idx == 1:
            continue
        try:
            # DirectShow (dshow) backend'ini açıkça belirterek deneyin
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                print(f"Kamera indeksi {idx} ile başarıyla açıldı.")
                break
        except Exception as e:
            print(f"Kamera indeksi {idx} açılamadı: {e}")
            
        try:
            # DirectShow olmadan deneyin
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                print(f"Kamera indeksi {idx} ile başarıyla açıldı (backend belirtilmeden).")
                break
        except Exception as e:
            print(f"Kamera indeksi {idx} açılamadı (backend belirtilmeden): {e}")
    
    if cap is None or not cap.isOpened():
        print("Webcam açılamadı! Hiçbir kamera bulunamadı.")
        return
    
    try:
        # Kamera çözünürlüğünü ayarlamaya çalış
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    except Exception as e:
        print(f"Kamera çözünürlüğü ayarlanamadı: {e}")
    
    print("Webcam başlatıldı. Çıkmak için 'q' tuşuna basın.")
    
    while True:
        try:
            # Frame'i oku
            ret, frame = cap.read()
            if not ret:
                print("Frame okunamadı!")
                break
                
            # Performans takibi için zaman başlangıcı
            start_time = time.time()
            
            # YOLO modeli ile tahmin yap
            results = model.predict(
                source=frame, 
                conf=0.25,          # Güven eşiği
                iou=0.45,           # IoU eşiği
                show=False,         # Gösterme (Manuel göstereceğiz)
                stream=True,        # Stream modu
                retina_masks=True,  # Daha hassas maskeler
                verbose=False,      # Konsola bilgi yazdırma
                imgsz=640,           # Model giriş boyutu
                device='cuda'      # GPU kullanımı için
            )
            
            # İlk olarak referans nesneleri tespit et ve scale factor hesapla
            results_list = list(results)
            reference_objects, food_objects = process_detections_with_scale(results_list, None)
            
            # Scale factor hesapla
            scale_factor = calculate_scale_factor_from_bbox_area(reference_objects) if reference_objects else None
            
            # Eğer scale factor hesaplandıysa, food objects için gerçek alanları hesapla
            if scale_factor is not None and food_objects:
                for food_obj in food_objects:
                    if "segment_area_px" in food_obj:
                        food_obj["real_area_cm2"] = pixel_area_to_cm2(food_obj["segment_area_px"], scale_factor)
            
            # Sonuçları işle ve görüntü üzerine çiz
            for result in results_list:
                # Segmentasyon maskelerini ve sınırlayıcı kutuları al
                boxes = result.boxes
                masks = result.masks
                
                # Eğer maskeler varsa
                if masks is not None:
                    # Görüntü üzerine maskeleri çiz
                    annotated_frame = result.plot()
                    
                    # FPS hesapla
                    fps = 1.0 / (time.time() - start_time)
                    
                    # FPS bilgisini ekle
                    cv2.putText(
                        annotated_frame, 
                        f"FPS: {fps:.1f}", 
                        (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        1, 
                        (0, 255, 0), 
                        2
                    )
                    
                    # Scale factor bilgisini göster
                    scale_text = f"Scale Factor: {scale_factor:.6f}" if scale_factor else "Scale Factor: N/A"
                    cv2.putText(
                        annotated_frame, 
                        scale_text, 
                        (20, 80), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.7, 
                        (255, 255, 0), 
                        2
                    )
                    
                    # Referans nesne sayısını göster
                    ref_count_text = f"Reference Objects: {len(reference_objects)}"
                    cv2.putText(
                        annotated_frame, 
                        ref_count_text, 
                        (20, 110), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.7, 
                        (255, 255, 0), 
                        2
                    )
                    
                    # Tespit edilen nesneler ve gerçek alanlarını göster
                    y_offset = 140
                    
                    # Referans nesneleri göster
                    for ref_obj in reference_objects:
                        text = f"{ref_obj['class']}: {ref_obj['bbox_area_px']:.1f}px²"
                        cv2.putText(
                            annotated_frame, 
                            text, 
                            (20, y_offset), 
                            cv2.FONT_HERSHEY_SIMPLEX, 
                            0.6, 
                            (0, 255, 255), 
                            2
                        )
                        y_offset += 25
                    
                    # Food nesneleri ve gerçek alanlarını göster
                    for food_obj in food_objects:
                        if "real_area_cm2" in food_obj:
                            text = f"{food_obj['class']}: {food_obj['segment_area_px']:.1f}px² = {food_obj['real_area_cm2']:.2f}cm²"
                        else:
                            text = f"{food_obj['class']}: {food_obj.get('segment_area_px', food_obj['bbox_area_px']):.1f}px²"
                        cv2.putText(
                            annotated_frame, 
                            text, 
                            (20, y_offset), 
                            cv2.FONT_HERSHEY_SIMPLEX, 
                            0.6, 
                            (0, 255, 0), 
                            2
                        )
                        y_offset += 25
                    
                    # İşlenmiş frame'i göster
                    cv2.imshow("YOLOv11s Scale Factor Test", annotated_frame)
                else:
                    # Herhangi bir maske bulunmazsa orijinal frame'i göster
                    cv2.imshow("YOLOv11s Scale Factor Test", frame)
        except Exception as e:
            print(f"Hata oluştu: {e}")
            break
            
        # 'q' tuşuna basıldığında çık
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Temizle
    cap.release()
    cv2.destroyAllWindows()
    print("Webcam kapatıldı.")

def main():
    print("YOLOv11s Real-Time Instance Segmentation")
    print("=========================================")
    
    # Modeli yükle
    model = load_yolo_model(MODEL_PATH)
    if model is None:
        print("Model yüklenemedi. Program sonlandırılıyor.")
        return
    
    # Real-time webcam detection başlat
    webcam_detection(model)
    
    print("Program sonlandırıldı.")

if __name__ == "__main__":
    main()