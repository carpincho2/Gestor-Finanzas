import pytest
from services.recommendation import evaluate_payment_options

class MockAccount:
    def __init__(self, id, name, acc_type, balance, limit, closing_day=None, due_day=None):
        self.id = id
        self.name = name
        self.type = acc_type
        self.balance = balance
        self.limit = limit
        self.closing_day = closing_day
        self.due_day = due_day

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
    assert len(credito_opt["installments_breakdown"]) == 6

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

def test_evaluate_payment_options_with_closing_day_advantage():
    from datetime import date
    # Arrange: hoy es día 22, la tarjeta cerró el 20 y vence el 5 del mes subsiguiente
    today = date(2026, 10, 22)
    acc = MockAccount(1, "Visa Galicia", "crédito", 0, 100000, closing_day=20, due_day=5)
    
    # Act: compra en 1 cuota o 3 cuotas
    options = evaluate_payment_options(30000, [acc], tna=40.0, installments=3, current_date=today)
    
    # Assert: debe tener ventaja de días de gracia (> 40 días)
    opt = options[0]
    assert opt["days_to_first_payment"] > 40
    assert opt["has_grace_advantage"] is True
    assert "días de gracia" in opt["reason"]

def test_evaluate_payment_options_with_refund_cap():
    # Arrange: compra de $100.000 con 30% de descuento pero tope de $15.000
    acc = MockAccount(1, "Efectivo", "efectivo", 150000, 0)
    
    # Act
    options = evaluate_payment_options(100000, [acc], discount=30.0, max_discount_amount=15000.0, installments=1)
    
    # Assert: precio contado debe ser 100.000 - 15.000 = 85.000 (y no 70.000)
    opt = options[0]
    assert opt["real_cost"] == 85000.0
    assert opt["nominal_cost"] == 85000.0

def test_evaluate_payment_options_with_surcharge_break_even():
    # Arrange: compra de $100.000 con recargo del 30% en 6 cuotas
    acc = MockAccount(1, "Visa", "crédito", 0, 200000)
    
    # Act
    options = evaluate_payment_options(100000, [acc], tna=30.0, surcharge_percentage=30.0, installments=6)
    
    # Assert: debe calcular break-even TNA y cronograma cuota a cuota
    opt = options[0]
    assert opt["break_even_tna"] is not None
    assert opt["break_even_tna"] > 30.0
    assert len(opt["installments_breakdown"]) == 6
    # Cada cuota tiene depreciación porcentual creciente
    assert opt["installments_breakdown"][-1]["depreciation_pct"] > opt["installments_breakdown"][0]["depreciation_pct"]

