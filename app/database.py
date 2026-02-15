import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.canvas_node import CanvasNode
from app.models.canvas_edge import CanvasEdge
from app.models.card_library import LibraryCard
from app.models.whiteboard import Whiteboard
from app.models.folder import Folder

async def init_db():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
    await init_beanie(
        database=client.nomad_telescope, 
        document_models=[CanvasNode, CanvasEdge, LibraryCard, Whiteboard, Folder]
    )

