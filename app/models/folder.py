from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class Folder(Document):
    """
    Folder model for grouping whiteboards.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "New Folder"
    order: int = 0
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "folders"

    async def save(self, *args, **kwargs):
        """Override save to update the updated_at timestamp"""
        self.updated_at = datetime.now()
        return await super().save(*args, **kwargs)
