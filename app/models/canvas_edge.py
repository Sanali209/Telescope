from typing import Optional, Literal
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class CanvasEdge(Document):
    """
    JSON Canvas 1.0 compliant edge model.
    Represents connections/relationships between nodes.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Connection endpoints
    fromNode: str  # Source node ID
    toNode: str    # Target node ID
    
    # Optional anchoring to specific sides of nodes
    fromSide: Optional[Literal["top", "bottom", "left", "right"]] = None
    toSide: Optional[Literal["top", "bottom", "left", "right"]] = None
    
    # Optional label for the connection
    label: Optional[str] = None
    
    # Styling
    color: Optional[str] = None  # Hex color for the arrow/line
    
    # Association
    whiteboard_id: str  # Which whiteboard this edge belongs to
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "canvas_edges"
    
    async def save(self, *args, **kwargs):
        """Override save to update the updated_at timestamp"""
        self.updated_at = datetime.now()
        return await super().save(*args, **kwargs)
