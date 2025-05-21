# Food Detection and Price Calculation Server

This project uses a YOLO model to detect food items in images, calculate their portions, and determine prices based on areas.

## Project Structure

- `main.py` - Main entry point for the application
- `server.py` - WebSocket server implementation
- `model.py` - YOLO model loading and prediction functions
- `food_processing.py` - Food detection and price calculation logic
- `utils.py` - Utility functions for image processing and calculations
- `config.py` - Configuration parameters and constants

## Requirements

- Python 3.8+
- OpenCV
- NumPy
- Ultralytics YOLO
- websockets
- PIL (Pillow)

## Installation

1. Clone this repository
2. Install required dependencies:
   ```
   pip install ultralytics opencv-python numpy websockets pillow
   ```
3. Make sure you have the YOLO model file (`my_yolo_model.pt`) in the project directory
4. Ensure you have a `foodsDB.json` database file in the project directory

## Running the Server

Simply run the main script:

```
python main.py
```

The WebSocket server will start on `localhost:8765`.

## Client Connection

Clients can connect to the WebSocket server and send images for processing. The expected message format is:

```json
{
    "type": "image",
    "data": "base64_encoded_image_data",
    "config": {
        "confidence": 0.5,
        "classes": []
    }
}
```

## Response Format

The server responds with detection results in this format:

```json
{
    "success": true,
    "data": [
        {
            "class": "food_name",
            "confidence": 0.95,
            "bbox": [x1, y1, x2, y2],
            "segments": [[x1, y1], [x2, y2], ...],
            "food_info": {
                "name": "Food Name",
                "price": 20.50,
                "calories": 250,
                "portion": 1.5,
                "portion_price": 30.75,
                "nutrition": { ... }
            }
        }
    ],
    "total_price": 30.75,
    "total_calories": 250,
    "processing_time": 0.85
}
``` 