from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class LibraryCard(Document):
    """
    Master card stored in the centralized Card Library.
    
    This implements Heptabase's architecture pattern of separating:
    - Card storage (LibraryCard) - single source of truth for content
    - Card display (CanvasNode with library_card_id) - visual projections
    
    A single LibraryCard can be projected onto multiple whiteboards,
    and edits to the library card are reflected in all projections.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    content: str = ""  # Markdown content
    
    # Organization
    tags: list[str] = Field(default_factory=list)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "library_cards"
    
    async def save(self, *args, **kwargs):
        """Override save to update the updated_at timestamp"""
        self.updated_at = datetime.now()
        return await super().save(*args, **kwargs)
    
    async def get_projections(self):
        """Get all whiteboard instances (projections) of this library card"""
        from app.models.canvas_node import CanvasNode
        return await CanvasNode.find(
            CanvasNode.library_card_id == self.id
        ).to_list()
    
    async def delete_with_projections(self):
        """Delete this card and all its projections from whiteboards"""
        from app.models.canvas_node import CanvasNode
        projections = await self.get_projections()
        for projection in projections:
            await projection.delete()
        await self.delete()
