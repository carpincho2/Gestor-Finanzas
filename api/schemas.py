from typing import Optional, List
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class GoogleRequest(BaseModel):
    credential: str

class OCRParseRequest(BaseModel):
    text: str

class TicketItemSchema(BaseModel):
    qty: float
    desc: str
    price: float
    total: float

class OCRSaveRequest(BaseModel):
    nombre_local: Optional[str] = None
    fecha: Optional[str] = None
    articulos: List[TicketItemSchema]

class AIChatMessage(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    contexto_financiero: str
    pregunta: str
    historial: List[AIChatMessage]

class AIInsightsRequest(BaseModel):
    contexto_financiero: str

class AccountCreate(BaseModel):
    name: str
    type: str
    bank: Optional[str] = None
    balance: float = 0.0
    currency: str = "ARS"
    limit: float = 0.0
    notes: Optional[str] = None
    mp_token: Optional[str] = None

class AccountUpdate(BaseModel):
    name: str
    type: str
    bank: Optional[str] = None
    balance: float
    currency: str = "ARS"
    limit: float = 0.0
    notes: Optional[str] = None
    mp_token: Optional[str] = None

class TransactionCreate(BaseModel):
    account_id: Optional[int] = None
    type: str
    desc: str
    amount: float
    cat: str
    date: str
    transfer_id: Optional[int] = None

class BudgetCreate(BaseModel):
    cat: str
    name: str
    icon: Optional[str] = "📦"
    limit: float
    color: str
    notes: Optional[str] = None

class GoalCreate(BaseModel):
    name: str
    cat: str
    emoji: Optional[str] = "🎯"
    color: str
    target: float
    current: float = 0.0
    deadline: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"

class GoalContributionCreate(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    name: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class AccountTokenRequest(BaseModel):
    mp_token: str
