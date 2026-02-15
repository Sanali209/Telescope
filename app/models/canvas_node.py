from typing import Optional, Literal, List
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class CanvasNode(Document):
    """
    JSON Canvas 1.0 compliant node model.
    Represents cards, groups, files, or links on the whiteboard.
    
    Replaces the old Card and Group models with a unified structure.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["text", "file", "link", "group"]
    
    # Position and size (in virtual world coordinates)
    x: float
    y: float
    width: float
    height: float
    
    # Type-specific content
    text: Optional[str] = None  # For type="text" - markdown content
    file: Optional[str] = None  # For type="file" - file path or base64
    url: Optional[str] = None   # For type="link" - external URL
    
    # Styling (optional)
    color: Optional[str] = None  # Hex color (e.g., "#ff0000") or preset index
    
    # Hierarchy and relationships
    parent_id: Optional[str] = None  # For nested groups
    whiteboard_id: str  # Associated whiteboard
    
    # Group-specific state
    collapsed: bool = False  # For type="group" - whether children are hidden
    
    # Tagging system
    tags: List[str] = Field(default_factory=list)

    # Export Control
    exclude_from_export: bool = False
    
    # Card Library integration (optional)
    library_card_id: Optional[str] = None  # Reference to LibraryCard for projections
    
    # Nested Whiteboard Navigation
    sub_whiteboard_id: Optional[str] = None # ID of the whiteboard this node links to
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "canvas_nodes"
    
    async def save(self, *args, **kwargs):
        """Override save to update the updated_at timestamp"""
        self.updated_at = datetime.now()
        return await super().save(*args, **kwargs)
    
    def get_title(self) -> str:
        """Extract title from text content (first line)"""
        if self.type == "text" and self.text:
            lines = self.text.strip().split('\n')
            title = lines[0] if lines else "Untitled"
            # Strip markdown headers if present
            import re
            return re.sub(r'^#+\s*', '', title)[:50]
        elif self.type == "group":
            return self.text or "Untitled Group"
        elif self.type == "link":
            return self.url or "Link"
        elif self.type == "file":
            return self.file or "File"
        return "Untitled"
