from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class UserEntity:
    id: Optional[int]
    name: str
    email: str
    password_hash: Optional[str] = None
    google_id: Optional[str] = None
    avatar: str = "JP"
    picture: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
