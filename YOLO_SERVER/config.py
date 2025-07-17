import os

# WebSocket server config
HOST = "localhost"
PORT = 8765

# Current directory path - updated to point to parent directory
CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# SQLite database path (ana veritabanı)
SQLITE_DB_PATH = os.path.join(CURRENT_DIR, 'foods.db')

# JSON database path (sadece migration için)
FOOD_DB_PATH = os.path.join(CURRENT_DIR, 'foodsDB.json')

# YOLO model settings
DEFAULT_CONFIDENCE_THRESHOLD = 0.5
DEFAULT_IOU_THRESHOLD = 0.45
DEFAULT_IMAGE_SIZE = 640

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


# Default food properties when not found in database
DEFAULT_FOOD_HEIGHT_CM = 2.0
DEFAULT_FOOD_DENSITY = 0.8
DEFAULT_PORTION_MASS = 150  # grams 