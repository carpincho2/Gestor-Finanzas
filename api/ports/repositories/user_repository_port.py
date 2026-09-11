from typing import Protocol, Optional
from domain.entities.user import UserEntity

class UserRepositoryPort(Protocol):
    def get_by_id(self, user_id: int) -> Optional[UserEntity]:
        ...

    def get_by_email(self, email: str) -> Optional[UserEntity]:
        ...

    def get_by_google_id(self, google_id: str) -> Optional[UserEntity]:
        ...

    def save(self, user: UserEntity) -> UserEntity:
        ...
