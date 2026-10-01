from typing import List, Dict, Any, Optional


def calculate_vpn(installment_amount: float, installments: int, tem: float) -> float:
    """
    Calcula el Valor Presente Neto (VPN) de una serie de pagos futuros constantes:
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
    installment_total_price: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Motor matemático de recomendación financiera.
    Compara pagar al contado/débito vs crédito en distintas cuotas (sin interés o con recargo).
    
    Parámetros:
    - price: Precio de lista o contado del producto.
    - accounts: Cuentas y tarjetas registradas del usuario.
    - tna: Tasa Nominal Anual de referencia (costo de oportunidad/inflación).
    - discount: Descuento extra al contado ofrecido por el banco/tienda (ej: 10%).
    - installments: Si es None o 0, autodetecta la mejor cuota (1, 3, 6, 9, 12, 18, 24).
    - surcharge_percentage: Recargo porcentual si se paga en cuotas (ej: 15% CFT).
    - installment_total_price: Precio total fijo financiado si la tienda publica un precio diferenciado.
    """
    cash_price = price * (1 - (discount / 100))
    tem = (tna / 100) / 12
    
    # Determinar el precio financiado para tarjetas de crédito
    if installment_total_price and installment_total_price > 0:
        total_credit_price = float(installment_total_price)
    elif surcharge_percentage and surcharge_percentage > 0:
        total_credit_price = cash_price * (1 + (surcharge_percentage / 100))
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
        
        is_credit = (
            "crédito" in acc_type or 
            "credito" in acc_type or 
            "credit" in acc_type or 
            "tarjeta" in acc_type or 
            "card" in acc_type or 
            acc_limit > 0
        )
        
        if is_credit:
            # Evaluar capacidad contra el límite de crédito
            if acc_limit >= total_credit_price:
                for n_cuotas in cuotas_a_evaluar:
                    cuota_mensual = total_credit_price / n_cuotas if n_cuotas > 0 else total_credit_price
                    vpn = calculate_vpn(cuota_mensual, n_cuotas, tem)
                    ahorro = cash_price - vpn
                    ahorro_pct = round((ahorro / cash_price) * 100, 1) if cash_price > 0 else 0
                    
                    if n_cuotas > 1:
                        if ahorro > 0:
                            reason = (
                                f"Te conviene pagar en {n_cuotas} cuotas de ${round(cuota_mensual, 2):,}. "
                                f"Ajustado por rendimiento/inflación ({tna}% TNA), tu costo real es ${round(vpn, 2):,} "
                                f"(ahorrás un {ahorro_pct}% vs pagar contado)."
                            )
                        else:
                            reason = (
                                f"En {n_cuotas} cuotas de ${round(cuota_mensual, 2):,}, el recargo financiero supera la inflación "
                                f"(costo real: ${round(vpn, 2):,}, sobrecosto del {abs(ahorro_pct)}% vs contado)."
                            )
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
                    "reason": f"Saldo insuficiente (Precio contado: ${round(cash_price, 2):,}, Saldo: ${round(acc_balance, 2):,})."
                })
                
    # Ordenar opciones: primero las viables, luego por costo real (menor costo real primero)
    options.sort(key=lambda x: (not x["is_viable"], x["real_cost"]))
    
    if not options:
        return []
        
    # Destacar la ganadora absoluta
    options[0]["is_winner"] = options[0]["is_viable"]
    for opt in options[1:]:
        opt["is_winner"] = False
        
    return options
