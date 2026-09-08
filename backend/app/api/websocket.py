import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger("websocket")

class ConnectionManager:
    """Manages active WebSocket connections subscribed to track processing jobs."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, track_id: str, websocket: WebSocket):
        await websocket.accept()
        if track_id not in self.active_connections:
            self.active_connections[track_id] = []
        self.active_connections[track_id].append(websocket)
        logger.info(f"WebSocket conectado para track {track_id}")

    def disconnect(self, track_id: str, websocket: WebSocket):
        if track_id in self.active_connections:
            if websocket in self.active_connections[track_id]:
                self.active_connections[track_id].remove(websocket)
            if not self.active_connections[track_id]:
                del self.active_connections[track_id]
        logger.info(f"WebSocket desconectado para track {track_id}")

    async def broadcast_progress(self, track_id: str, progress: int, stage: str, message: str, extra_data: dict = None):
        """Sends real-time telemetry updates to clients listening on track_id."""
        if track_id not in self.active_connections:
            return

        payload = {
            "track_id": track_id,
            "progress": progress,
            "stage": stage,
            "message": message,
        }
        if extra_data:
            payload["data"] = extra_data

        message_str = json.dumps(payload)
        dead_sockets = []

        for ws in self.active_connections[track_id]:
            try:
                await ws.send_text(message_str)
            except Exception as e:
                logger.warning(f"Error enviando WebSocket a {track_id}: {e}")
                dead_sockets.append(ws)

        for dead in dead_sockets:
            self.disconnect(track_id, dead)

ws_manager = ConnectionManager()
