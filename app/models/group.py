from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid

class Group(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "New Group"
    x: float = 0
    y: float = 0
    width: float = 400
    height: float = 300
    whiteboard_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "groups"
