import asyncio
import uuid
import random
from app.models.canvas_node import CanvasNode
from app.models.canvas_edge import CanvasEdge
from app.services.board_service import BoardService
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import os
from dotenv import load_dotenv

load_dotenv()

async def init_db():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
    db = client[os.getenv("DATABASE_NAME", "telescope")]
    await init_beanie(database=db, document_models=[CanvasNode, CanvasEdge])

async def generate_stress_data(node_count=200, edge_count=100):
    print(f"Generating stress data: {node_count} nodes, {edge_count} edges...")
    
    # Create a new whiteboard
    wb_name = f"Stress Test {uuid.uuid4().hex[:6]}"
    # Assuming BoardService has a way to create/get or using direct insert for speed
    # We'll just use a fixed ID for simplicity or create a placeholder
    wb_id = str(uuid.uuid4()) 
    
    nodes = []
    for i in range(node_count):
        node = CanvasNode(
            id=str(uuid.uuid4()),
            type="text",
            text=f"# Node {i}\nThis is a stress test node content with some length to verify preview extraction and caching behavior.",
            x=random.uniform(0, 5000),
            y=random.uniform(0, 5000),
            width=300,
            height=200,
            whiteboard_id=wb_id,
            tags=["stress-test", f"tag-{random.randint(1, 10)}"]
        )
        nodes.append(node)
    
    await CanvasNode.insert_many(nodes)
    
    edges = []
    node_ids = [n.id for n in nodes]
    for i in range(edge_count):
        from_node = random.choice(node_ids)
        to_node = random.choice(node_ids)
        if from_node == to_node: continue
        
        edge = CanvasEdge(
            id=str(uuid.uuid4()),
            fromNode=from_node,
            toNode=to_node,
            whiteboard_id=wb_id,
            color="#64748b"
        )
        edges.append(edge)
    
    await CanvasEdge.insert_many(edges)
    print(f"Successfully generated data for Whiteboard ID: {wb_id}")
    print(f"Access it via: http://localhost:8000/?id={wb_id} (once server is running)")
    return wb_id

async def main():
    await init_db()
    await generate_stress_data(node_count=200, edge_count=100)

if __name__ == "__main__":
    asyncio.run(main())
