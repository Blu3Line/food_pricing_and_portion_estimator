import time
from ultralytics import YOLO
import cv2
import numpy as np
from YOLO_SERVER.config import DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_IOU_THRESHOLD, DEFAULT_IMAGE_SIZE

# YOLO model yükleme fonksiyonu
def load_yolo_model(model_path):
    """Load YOLO model from file"""
    try:
        model = YOLO(model_path)
        print(f"YOLO model loaded successfully: {model_path}")
        return model
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

def predict_with_yolo(model, image, conf_threshold=DEFAULT_CONFIDENCE_THRESHOLD, iou_threshold=DEFAULT_IOU_THRESHOLD):
    """Run YOLO inference on an image"""
    if model is None:
        raise ValueError("Model is not loaded")
    
    results = model.predict(
        source=image,
        conf=conf_threshold,
        iou=iou_threshold,
        retina_masks=True,
        imgsz=DEFAULT_IMAGE_SIZE, # YOLO kendi içinde resize işlemi yapar
    )
    
    return results

# Eğer Ultralytics'in doğrudan yöntemi başarısız olursa, polygon çıkarma
def extract_polygon_from_mask(mask):
    """Extract polygon from mask if Ultralytics direct approach fails"""
    mask_np = mask.cpu().numpy().astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        max_contour = max(contours, key=cv2.contourArea)
        return max_contour.reshape(-1, 2).tolist()
    return [] 