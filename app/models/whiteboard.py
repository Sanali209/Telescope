from typing import List, Optional, Dict
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class Whiteboard(Document):
    """
    Whiteboard model representing a canvas.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Untitled Whiteboard"
    
    # Hierarchy
    # Hierarchy
    parent_id: Optional[str] = None  # Deprecated in favor of folder_id for now, or used for nesting whiteboards directly? Keeping for backward compat if needed.
    folder_id: Optional[str] = None
    order: int = 0
    
    # Viewport state for restoring user's view position
    viewport: Dict[str, float] = Field(default_factory=lambda: {
        "x": 0.0, 
        "y": 0.0, 
        "scale": 1.0
    })
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "whiteboards"
    
    async def save(self, *args, **kwargs):
        """Override save to update the updated_at timestamp"""
        self.updated_at = datetime.now()
        return await super().save(*args, **kwargs)

