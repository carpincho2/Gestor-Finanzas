import calendar
from datetime import date, timedelta
from typing import List, Dict, Any, Optional, Tuple


def calculate_days_to_first_payment(
    today: date, 
    closing_day: Optional[int], 
    due_day: Optional[int]
) -> int:
    """
    Calcula los días de gracia exactos que faltan hasta el primer vencimiento de la tarjeta.
    Si hoy es posterior a la fecha de cierre del mes actual, la compra entra en el ciclo siguiente
    (ganando entre 35 y 45+ días de gracia antes de pagar la primera cuota).
    """
    if not closing_day or not due_day or not (1 <= closing_day <= 31) or not (1 <= due_day <= 31):
        return 30  # Convención estándar si no están configurados los días

    year = today.year
    month = today.month

    # Días máximos del mes actual
    max_days_current_month = calendar.monthrange(year, month)[1]
    adj_closing_day = min(closing_day, max_days_current_month)
    current_month_close = date(year, month, adj_closing_day)

    if today <= current_month_close:
        # Entra en el cierre de este mes
        if due_day > closing_day:
            due_year = year
            due_month = month
        else:
            due_month = month + 1
            due_year = year
            if due_month > 12:
                due_month = 1
                due_year += 1
    else:
        # Ya cerró este mes -> entra en el cierre del mes siguiente
        next_month = month + 1
        next_year = year
        if next_month > 12:
            next_month = 1
            next_year += 1
        
        if due_day > closing_day:
            due_month = next_month
            due_year = next_year
        else:
            due_month = next_month + 1
            due_year = next_year
            if due_month > 12:
                due_month = 1
                due_year += 1

    max_days_due_month = calendar.monthrange(due_year, due_month)[1]
    adj_due_day = min(due_day, max_days_due_month)
    due_date = date(due_year, due_month, adj_due_day)

    diff = (due_date - today).days
    return max(diff, 1)


def calculate_break_even_tna(
    cash_price: float, 
    total_credit_price: float, 
    installments: int, 
    days_to_first_payment: int = 30
) -> Optional[float]:
    """
    Calcula la TNA de equilibrio (Break-Even) en cuotas con recargo.
    Es la tasa anual mínima que debe rendir el dinero para que el VPN de las cuotas sea menor o igual al precio al contado.
    Usa el método de bisección matemática.
    """
    if installments <= 1 or total_credit_price <= cash_price or cash_price <= 0:
        return None

    installment_amount = total_credit_price / installments

    def vpn_for_tna(tna_val: float) -> float:
        ted = (tna_val / 100.0) / 365.0
        tot = 0.0
        for k in range(installments):
            d_k = days_to_first_payment + (30 * k)
            tot += installment_amount / ((1.0 + ted) ** d_k)
        return tot

    low = 0.0
    high = 600.0
    
    if vpn_for_tna(high) > cash_price:
        return 999.0

    mid = low
    for _ in range(25):
        mid = (low + high) / 2.0
        val = vpn_for_tna(mid)
        if val > cash_price:
            low = mid
        else:
            high = mid

    return round(mid, 1)


def calculate_payment_schedule(
    installment_amount: float, 
    installments: int, 
    tna: float, 
    days_to_first_payment: int = 30,
    start_date: Optional[date] = None,
    has_grace_advantage: bool = False
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Calcula el VPN y el cronograma detallado de cuotas (desvalorización por inflación).
    Si es 1 cuota sin ventaja especial de días de gracia por cierre, el costo real es el nominal.
    Si son múltiples cuotas o tiene ventaja de días de gracia, se descuenta a valor presente.
    """
    base_date = start_date or date.today()
    ted = (tna / 100.0) / 365.0 if tna > 0 else 0.0
    
    vpn_total = 0.0
    schedule = []
    should_discount = (installments > 1) or has_grace_advantage
    
    for k in range(installments):
        days = days_to_first_payment + (30 * k)
        if should_discount and ted > 0:
            pv = installment_amount / ((1.0 + ted) ** days)
        else:
            pv = installment_amount
        depreciation = ((installment_amount - pv) / installment_amount * 100.0) if installment_amount > 0 else 0.0
        pay_date = base_date + timedelta(days=days)
        
        vpn_total += pv
        schedule.append({
            "installment_number": k + 1,
            "nominal_amount": round(installment_amount, 2),
            "present_value": round(pv, 2),
            "depreciation_pct": round(depreciation, 1),
            "days_until_payment": days,
            "estimated_date": pay_date.isoformat()
        })
        
    return round(vpn_total, 2), schedule


def calculate_vpn(installment_amount: float, installments: int, tem: float) -> float:
    """
    Calcula el Valor Presente Neto (VPN) clásico con cuotas mensuales regulares:
    VPN = Cuota * [ (1 - (1 + TEM)^-n) / TEM ]
    """
    if installments > 1 and tem > 0:
        return installment_amount * ((1 - (1 + tem)**-installments) / tem)
    return installment_amount * installments


def evaluate_payment_options(
    price: float, 
    accounts: List[Any], 
    tna: float = 40.0, 
    discount: float = 0.0, 
    installments: Optional[int] = None,
    surcharge_percentage: float = 0.0,
    installment_total_price: Optional[float] = None,
    max_discount_amount: Optional[float] = None,
    current_date: Optional[date] = None
) -> List[Dict[str, Any]]:
    """
    Motor matemático de recomendación financiera de clase mundial.
    Compara pagar al contado/débito vs crédito en distintas cuotas,
    considerando días de gracia por ciclo de facturación (cierre/vencimiento),
    tope de reintegro bancario, tasa de equilibrio y cronograma cuota a cuota.
    """
    today = current_date or date.today()

    # Cálculo del descuento al contado considerando tope de reintegro si existe
    if discount and discount > 0:
        raw_discount = price * (discount / 100.0)
        if max_discount_amount and max_discount_amount > 0:
            effective_discount = min(raw_discount, float(max_discount_amount))
        else:
            effective_discount = raw_discount
        cash_price = max(0.0, price - effective_discount)
    else:
        effective_discount = 0.0
        cash_price = price

    # Determinar el precio financiado para tarjetas de crédito
    if installment_total_price and installment_total_price > 0:
        total_credit_price = float(installment_total_price)
    elif surcharge_percentage and surcharge_percentage > 0:
        total_credit_price = cash_price * (1 + (surcharge_percentage / 100.0))
    else:
        total_credit_price = cash_price
        
    # Cuotas a evaluar
    if installments and installments > 0:
        cuotas_a_evaluar = [installments]
    else:
        cuotas_a_evaluar = [1, 3, 6, 9, 12, 18, 24]
        
    options = []
    
    for acc in accounts:
        acc_type = (getattr(acc, "type", "") or "").lower()
        acc_limit = getattr(acc, "limit", 0) or 0
        acc_balance = getattr(acc, "balance", 0) or 0
        acc_id = getattr(acc, "id", None)
        acc_name = getattr(acc, "name", "Cuenta")
        closing_day = getattr(acc, "closing_day", None)
        due_day = getattr(acc, "due_day", None)
        
        is_credit = (
            "crédito" in acc_type or 
            "credito" in acc_type or 
            "credit" in acc_type or 
            "tarjeta" in acc_type or 
            "card" in acc_type or 
            acc_limit > 0
        )
        
        if is_credit:
            days_to_first = calculate_days_to_first_payment(today, closing_day, due_day)
            has_grace_advantage = bool(closing_day and today.day > closing_day and days_to_first >= 32)

            # Evaluar capacidad contra el límite de crédito
            if acc_limit >= total_credit_price:
                for n_cuotas in cuotas_a_evaluar:
                    cuota_mensual = total_credit_price / n_cuotas if n_cuotas > 0 else total_credit_price
                    vpn, schedule = calculate_payment_schedule(
                        cuota_mensual, 
                        n_cuotas, 
                        tna, 
                        days_to_first, 
                        today, 
                        has_grace_advantage=has_grace_advantage
                    )
                    ahorro = cash_price - vpn
                    ahorro_pct = round((ahorro / cash_price) * 100.0, 1) if cash_price > 0 else 0.0
                    
                    break_even_tna = calculate_break_even_tna(cash_price, total_credit_price, n_cuotas, days_to_first) if total_credit_price > cash_price else None

                    grace_note = f" (ganás {days_to_first} días de gracia por cierre reciente)" if has_grace_advantage else ""

                    if n_cuotas > 1:
                        if ahorro > 0:
                            reason = (
                                f"Te conviene pagar en {n_cuotas} cuotas de ${round(cuota_mensual, 2):,}{grace_note}. "
                                f"Ajustado por rendimiento/inflación ({tna}% TNA), tu costo real es ${round(vpn, 2):,} "
                                f"(ahorrás un {ahorro_pct}% vs pagar contado)."
                            )
                        else:
                            be_msg = f" (necesitarías una TNA mayor a {break_even_tna}% para que convenga)" if break_even_tna else ""
                            reason = (
                                f"En {n_cuotas} cuotas de ${round(cuota_mensual, 2):,}, el recargo financiero supera la inflación "
                                f"(costo real: ${round(vpn, 2):,}, sobrecosto del {abs(ahorro_pct)}% vs contado){be_msg}."
                            )
                    else:
                        if has_grace_advantage:
                            reason = f"Pago en 1 cuota con {acc_name}: al cerrar recientemente, tenés {days_to_first} días gratis para pagar el resumen."
                        else:
                            reason = f"Pago en 1 cuota con {acc_name}."
                        
                    options.append({
                        "account_id": acc_id,
                        "account_name": acc_name,
                        "type": getattr(acc, "type", "Crédito"),
                        "is_viable": True,
                        "real_cost": round(vpn, 2),
                        "nominal_cost": round(total_credit_price, 2),
                        "installments": n_cuotas,
                        "monthly_installment": round(cuota_mensual, 2),
                        "savings": round(ahorro, 2),
                        "savings_pct": ahorro_pct,
                        "payment_method": "credit",
                        "days_to_first_payment": days_to_first,
                        "closing_day": closing_day,
                        "due_day": due_day,
                        "has_grace_advantage": has_grace_advantage,
                        "break_even_tna": break_even_tna,
                        "installments_breakdown": schedule,
                        "reason": reason
                    })
            else:
                options.append({
                    "account_id": acc_id,
                    "account_name": acc_name,
                    "type": getattr(acc, "type", "Crédito"),
                    "is_viable": False,
                    "real_cost": round(total_credit_price, 2),
                    "nominal_cost": round(total_credit_price, 2),
                    "installments": cuotas_a_evaluar[-1],
                    "monthly_installment": round(total_credit_price, 2),
                    "savings": 0.0,
                    "savings_pct": 0.0,
                    "payment_method": "credit",
                    "days_to_first_payment": days_to_first,
                    "closing_day": closing_day,
                    "due_day": due_day,
                    "has_grace_advantage": has_grace_advantage,
                    "break_even_tna": None,
                    "installments_breakdown": [],
                    "reason": f"Límite disponible superado (Precio: ${round(total_credit_price, 2):,}, Límite: ${round(acc_limit, 2):,})."
                })
        else:
            # Débito, Efectivo, Billetera Virtual (se paga de contado hoy)
            if acc_balance >= cash_price:
                options.append({
                    "account_id": acc_id,
                    "account_name": acc_name,
                    "type": getattr(acc, "type", "Débito / Cuenta"),
                    "is_viable": True,
                    "real_cost": round(cash_price, 2),
                    "nominal_cost": round(cash_price, 2),
                    "installments": 1,
                    "monthly_installment": round(cash_price, 2),
                    "savings": 0.0,
                    "savings_pct": 0.0,
                    "payment_method": "cash",
                    "days_to_first_payment": 0,
                    "closing_day": None,
                    "due_day": None,
                    "has_grace_advantage": False,
                    "break_even_tna": None,
                    "installments_breakdown": [{
                        "installment_number": 1,
                        "nominal_amount": round(cash_price, 2),
                        "present_value": round(cash_price, 2),
                        "depreciation_pct": 0.0,
                        "days_until_payment": 0,
                        "estimated_date": today.isoformat()
                    }],
                    "reason": f"Pago directo con {acc_name}. Abonás ${round(cash_price, 2):,} al contado."
                })
            else:
                options.append({
                    "account_id": acc_id,
                    "account_name": acc_name,
                    "type": getattr(acc, "type", "Débito / Cuenta"),
                    "is_viable": False,
                    "real_cost": round(cash_price, 2),
                    "nominal_cost": round(cash_price, 2),
                    "installments": 1,
                    "monthly_installment": round(cash_price, 2),
                    "savings": 0.0,
                    "savings_pct": 0.0,
                    "payment_method": "cash",
                    "days_to_first_payment": 0,
                    "closing_day": None,
                    "due_day": None,
                    "has_grace_advantage": False,
                    "break_even_tna": None,
                    "installments_breakdown": [],
                    "reason": f"Saldo insuficiente (Precio contado: ${round(cash_price, 2):,}, Saldo: ${round(acc_balance, 2):,})."
                })
                
    # Ordenar opciones: primero las viables, luego por menor costo real (VPN)
    options.sort(key=lambda x: (not x["is_viable"], x["real_cost"]))
    
    if not options:
        return []
        
    # Destacar la ganadora absoluta
    options[0]["is_winner"] = options[0]["is_viable"]
    for opt in options[1:]:
        opt["is_winner"] = False
        
    return options

