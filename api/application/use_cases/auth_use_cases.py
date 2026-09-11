from typing import Optional
from ports.repositories.user_repository_port import UserRepositoryPort
from domain.entities.user import UserEntity
from domain.exceptions import UserNotFoundException, InvalidCredentialsException

class AuthUseCases:
    def __init__(self, user_repo: UserRepositoryPort):
        self.user_repo = user_repo

    def get_user_by_email(self, email: str) -> Optional[UserEntity]:
        return self.user_repo.get_by_email(email)

    def get_user_by_google_id(self, google_id: str) -> Optional[UserEntity]:
        return self.user_repo.get_by_google_id(google_id)

    def create_user(self, name: str, email: str, password_hash: Optional[str] = None, google_id: Optional[str] = None, avatar: str = "JP", picture: Optional[str] = None) -> UserEntity:
        user = UserEntity(
            id=None,
            name=name,
            email=email,
            password_hash=password_hash,
            google_id=google_id,
            avatar=avatar,
            picture=picture,
        )
        return self.user_repo.save(user)
