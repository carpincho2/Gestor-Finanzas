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
    is_archived: Optional[bool] = False
    is_favorite: Optional[bool] = False
    color: Optional[str] = None
    icon: Optional[str] = None
    cbu: Optional[str] = None
    alias: Optional[str] = None
    closing_day: Optional[int] = None
    due_day: Optional[int] = None

class AccountUpdate(BaseModel):
    name: str
    type: str
    bank: Optional[str] = None
    balance: float
    currency: str = "ARS"
    limit: float = 0.0
    notes: Optional[str] = None
    mp_token: Optional[str] = None
    is_archived: Optional[bool] = False
    is_favorite: Optional[bool] = False
    color: Optional[str] = None
    icon: Optional[str] = None
    cbu: Optional[str] = None
    alias: Optional[str] = None
    closing_day: Optional[int] = None
    due_day: Optional[int] = None

class AccountTransferRequest(BaseModel):
    from_account_id: int
    to_account_id: int
    amount_from: float
    amount_to: float
    desc_expense: Optional[str] = "Transferencia saliente"
    desc_income: Optional[str] = "Transferencia entrante"
    date: Optional[str] = None

class AccountReconcileRequest(BaseModel):
    real_balance: float
    note: Optional[str] = "Ajuste de conciliación de saldo"


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
    currency: Optional[str] = "ARS"

class GoalCreate(BaseModel):
    name: str
    cat: str
    emoji: Optional[str] = "🎯"
    color: str
    target: float
    current: float = 0.0
    deadline: Optional[str] = None
    start_date: Optional[str] = None
    currency: Optional[str] = "ARS"
    notes: Optional[str] = None
    status: Optional[str] = "active"

class GoalContributionCreate(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None
    account_id: Optional[int] = None
    type: Optional[str] = "deposit"

class ProfileUpdateRequest(BaseModel):
    name: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class AccountTokenRequest(BaseModel):
    mp_token: str
