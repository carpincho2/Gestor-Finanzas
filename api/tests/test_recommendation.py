import pytest
from services.recommendation import evaluate_payment_options

class MockAccount:
    def __init__(self, id, name, acc_type, balance, limit):
        self.id = id
        self.name = name
        self.type = acc_type
        self.balance = balance
        self.limit = limit

def test_evaluate_payment_options_no_installments():
    # Arrange
    acc1 = MockAccount(1, "Efectivo", "efectivo", 10000, 0)
    acc2 = MockAccount(2, "Visa", "crédito", 0, 50000)
    accounts = [acc1, acc2]
    
    # Act
    # Compra de $5000, sin cuotas (1 pago), sin descuento
    options = evaluate_payment_options(5000, accounts, tna=40.0, discount=0, installments=1)
    
    # Assert
    assert len(options) == 2
    
    efectivo_opt = next(opt for opt in options if opt["account_id"] == 1)
    credito_opt = next(opt for opt in options if opt["account_id"] == 2)
    
    # En 1 pago, el costo real debe ser el nominal
    assert efectivo_opt["real_cost"] == 5000.0
    assert credito_opt["real_cost"] == 5000.0
    
    # Efectivo debe ser viable porque el saldo (10000) > 5000
    assert efectivo_opt["is_viable"] is True
    # Crédito debe ser viable porque el límite (50000) > 5000
    assert credito_opt["is_viable"] is True

def test_evaluate_payment_options_with_installments():
    # Arrange
    acc1 = MockAccount(1, "Efectivo", "efectivo", 20000, 0)
    acc2 = MockAccount(2, "Mastercard", "crédito", 0, 50000)
    accounts = [acc1, acc2]
    
    # Act
    # Compra de $12000, 6 cuotas sin interés, TNA de 40%
    options = evaluate_payment_options(12000, accounts, tna=40.0, discount=0, installments=6)
    
    # Assert
    efectivo_opt = next(opt for opt in options if opt["account_id"] == 1)
    credito_opt = next(opt for opt in options if opt["account_id"] == 2)
    
    # Efectivo se paga todo hoy (sin cuotas), por lo que el costo es 12000
    assert efectivo_opt["real_cost"] == 12000.0
    
    # Crédito se paga en cuotas. Con inflación del 40% TNA, el costo real en VPN debe ser MENOR a 12000
    assert credito_opt["real_cost"] < 12000.0
    
    # Ordenar opciones
    # El motor debería recomendar crédito porque real_cost es menor
    # (El motor en sí solo devuelve las opciones con real_cost, el endpoint es quien ordena, 
    # pero verificamos que los valores sean matemáticamente correctos)

def test_evaluate_payment_options_insufficient_funds():
    # Arrange
    acc1 = MockAccount(1, "Efectivo", "efectivo", 5000, 0) # Saldo insuficiente
    acc2 = MockAccount(2, "Visa", "crédito", 0, 5000)      # Límite insuficiente
    accounts = [acc1, acc2]
    
    # Act
    # Compra de $10000
    options = evaluate_payment_options(10000, accounts, tna=40.0, discount=0, installments=1)
    
    # Assert
    efectivo_opt = next(opt for opt in options if opt["account_id"] == 1)
    credito_opt = next(opt for opt in options if opt["account_id"] == 2)
    
    assert efectivo_opt["is_viable"] is False
    assert credito_opt["is_viable"] is False
