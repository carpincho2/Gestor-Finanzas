from typing import Optional
from sqlalchemy.orm import Session
from models import User
from domain.entities.user import UserEntity
from ports.repositories.user_repository_port import UserRepositoryPort

class SQLAlchemyUserRepository(UserRepositoryPort):
    def __init__(self, db: Session):
        self.db = db

    def _to_entity(self, user: User) -> UserEntity:
        return UserEntity(
            id=user.id,
            name=user.name,
            email=user.email,
            password_hash=user.password_hash,
            google_id=user.google_id,
            avatar=user.avatar or "JP",
            picture=user.picture,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    def get_by_id(self, user_id: int) -> Optional[UserEntity]:
        user = self.db.query(User).filter(User.id == user_id).first()
        return self._to_entity(user) if user else None

    def get_by_email(self, email: str) -> Optional[UserEntity]:
        user = self.db.query(User).filter(User.email == email).first()
        return self._to_entity(user) if user else None

    def get_by_google_id(self, google_id: str) -> Optional[UserEntity]:
        user = self.db.query(User).filter(User.google_id == google_id).first()
        return self._to_entity(user) if user else None

    def save(self, user_entity: UserEntity) -> UserEntity:
        if user_entity.id:
            user = self.db.query(User).filter(User.id == user_entity.id).first()
            if user:
                user.name = user_entity.name
                user.email = user_entity.email
                user.password_hash = user_entity.password_hash
                user.google_id = user_entity.google_id
                user.avatar = user_entity.avatar
                user.picture = user_entity.picture
        else:
            user = User(
                name=user_entity.name,
                email=user_entity.email,
                password_hash=user_entity.password_hash,
                google_id=user_entity.google_id,
                avatar=user_entity.avatar,
                picture=user_entity.picture,
            )
            self.db.add(user)

        self.db.commit()
        self.db.refresh(user)
        return self._to_entity(user)
