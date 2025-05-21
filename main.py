import asyncio
from YOLO_SERVER.server import start_websocket_server
from YOLO_SERVER.model import load_yolo_model

async def main():
    # Load YOLO model
    model = load_yolo_model("my_yolo_model.pt")
    
    # Start WebSocket server
    await start_websocket_server(model)

if __name__ == "__main__":
    asyncio.run(main()) 