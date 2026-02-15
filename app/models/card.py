from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class Card(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    content: str = ""
    x: float = 0
    y: float = 0
    width: float = 300
    height: float = 200
    group_id: Optional[str] = None
    whiteboard_id: Optional[str] = None
    parent_id: Optional[str] = None  # For cards in groups
    collapsed: bool = False  # For groups - whether children are hidden
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "cards"
