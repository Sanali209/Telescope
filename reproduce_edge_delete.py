import asyncio
import os
import sys
from dotenv import load_dotenv
import uuid

# Add app to path
sys.path.append(os.getcwd())

from app.database import init_db
from app.models.canvas_edge import CanvasEdge
from app.services.board_service import BoardService

async def main():
    load_dotenv()
    await init_db()
    
    # 1. Create a dummy edge
    test_id = str(uuid.uuid4())
    wb_id = "test_wb"
    edge = CanvasEdge(
        id=test_id,
        whiteboard_id=wb_id,
        fromNode="a",
        toNode="b"
    )
    await edge.save()
    print(f"Created edge with id: {test_id}")
    
    # 2. Try delete with wrong ID
    print("\n--- Test 2: Wrong ID ---")
    await BoardService.delete_edge("wrong-id", wb_id)
    
    # 3. Try delete with wrong whiteboard ID
    print("\n--- Test 3: Wrong Whiteboard ID ---")
    await BoardService.delete_edge(test_id, "wrong_wb")
    
    # 4. Try correct delete
    print("\n--- Test 4: Correct Delete ---")
    await BoardService.delete_edge(test_id, wb_id)

    # Cleanup
    still_exists = await CanvasEdge.find_one(CanvasEdge.id == test_id)
    if still_exists:
        await still_exists.delete()
        print("Cleaned up edge manually.")

if __name__ == "__main__":
    asyncio.run(main())
