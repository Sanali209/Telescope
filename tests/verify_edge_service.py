import sys
import os
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

# Add project root to sys.path
sys.path.append(os.getcwd())

from app.services.board_service import BoardService
from app.models.canvas_edge import CanvasEdge

async def test_delete_edge_logic():
    print("Testing BoardService.delete_edge...")
    
    edge_id = "test-edge-123"
    whiteboard_id = "test-wb-456"
    
    # Mock CanvasEdge.get
    mock_edge = AsyncMock()
    mock_edge.delete = AsyncMock()
    mock_edge.whiteboard_id = whiteboard_id
    
    with patch("app.models.canvas_edge.CanvasEdge.get") as mock_get:
        # Case 1: Edge found
        mock_get.return_value = mock_edge
        
        result = await BoardService.delete_edge(edge_id, whiteboard_id)
        
        assert result is True
        mock_edge.delete.assert_called_once()
        print("✓ Successfully deleted existing edge")
        
        # Case 2: Edge found but wrong whiteboard
        mock_edge.whiteboard_id = "wrong-wb"
        mock_edge.delete.reset_mock()
        
        result = await BoardService.delete_edge(edge_id, whiteboard_id)
        
        assert result is False
        mock_edge.delete.assert_not_called()
        print("✓ Successfully prevented deleting edge from other whiteboard")

        # Case 3: Edge not found
        mock_get.return_value = None
        mock_edge.delete.reset_mock()
        
        result = await BoardService.delete_edge(edge_id, whiteboard_id)
        
        assert result is False
        mock_edge.delete.assert_not_called()
        print("✓ Successfully handled missing edge")

if __name__ == "__main__":
    asyncio.run(test_delete_edge_logic())
