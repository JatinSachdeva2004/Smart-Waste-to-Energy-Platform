"""
WebSocket route — real-time dashboard updates.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter()

# Simple in-memory broadcast list
_connections: list[WebSocket] = []


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connections.append(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        _connections.remove(ws)


async def broadcast(data: dict):
    """Send JSON to all connected WebSocket clients."""
    msg = json.dumps(data)
    dead: list[WebSocket] = []
    for ws in _connections:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections.remove(ws)
