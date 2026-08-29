def calculate_vpn(final_price: float, installments: int, tem: float) -> float:
    if installments > 1 and tem > 0:
        cuota = final_price / installments
        return cuota * ((1 - (1 + tem)**-installments) / tem)
    return final_price

def evaluate_payment_options(
    price: float, 
    accounts: List[Any], 
    tna: float = 40.0, 
    discount: float = 0.0, 
    installments: int | None = None
) -> List[Dict[str, Any]]:
    """
    Motor matemático de recomendación.
    Compara pagar al contado/débito vs crédito en distintas cuotas sin interés.
    
    Si `installments` es None, 0 o auto, evalúa automáticamente todas las opciones
    (1, 3, 6, 9, 12, 18, 24 cuotas) y recomienda la mejor combinación para el usuario.
    """
    final_price = price * (1 - (discount / 100))
    tem = (tna / 100) / 12
    
    # Lista de cuotas a evaluar si no se especificó una fija
    if installments and installments > 0:
        cuotas_a_evaluar = [installments]
    else:
        cuotas_a_evaluar = [1, 3, 6, 9, 12, 18, 24]
        
    options = []
    
    for acc in accounts:
        acc_type = (acc.type or "").lower()
        acc_limit = getattr(acc, "limit", 0) or 0
        is_credit = (
            "crédito" in acc_type or 
            "credito" in acc_type or 
            "credit" in acc_type or 
            "tarjeta" in acc_type or 
            "card" in acc_type or 
            acc_limit > 0
        )
        
        if is_credit:
            # Para cuentas de crédito, probar las opciones de cuotas
            if acc.limit >= final_price:
                for n_cuotas in cuotas_a_evaluar:
                    vpn = calculate_vpn(final_price, n_cuotas, tem)
                    ahorro = final_price - vpn
                    ahorro_pct = round((ahorro / final_price) * 100, 1) if final_price > 0 else 0
                    
                    cuota_mensual = final_price / n_cuotas if n_cuotas > 0 else final_price
                    
                    reason = (
                        f"Te conviene pagar en {n_cuotas} cuotas de ${round(cuota_mensual, 2):,}. "
                        f"Ajustado por tasa de rendimiento (TNA {tna}%), tu costo real es ${round(vpn, 2):,} "
                        f"(ahorrás un {ahorro_pct}% por inflación vs contado)."
                    ) if n_cuotas > 1 else "Pago en 1 cuota con tarjeta de crédito."

                    options.append({
                        "account_id": acc.id,
                        "account_name": acc.name,
                        "type": acc.type,
                        "is_viable": True,
                        "real_cost": round(vpn, 2),
                        "nominal_cost": round(final_price, 2),
                        "installments": n_cuotas,
                        "monthly_installment": round(cuota_mensual, 2),
                        "savings": round(ahorro, 2),
                        "savings_pct": ahorro_pct,
                        "payment_method": "credit",
                        "reason": reason
                    })
            else:
                options.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "type": acc.type,
                    "is_viable": False,
                    "real_cost": round(final_price, 2),
                    "nominal_cost": round(final_price, 2),
                    "installments": cuotas_a_evaluar[-1],
                    "monthly_installment": round(final_price, 2),
                    "savings": 0.0,
                    "savings_pct": 0.0,
                    "payment_method": "credit",
                    "reason": f"Límite disponible superado (Precio: ${round(final_price, 2):,}, Límite: ${round(acc.limit, 2):,})."
                })
        else:
            # Débito, Efectivo, Billetera Virtual (se paga todo hoy)
            if acc.balance >= final_price:
                options.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "type": acc.type,
                    "is_viable": True,
                    "real_cost": round(final_price, 2),
                    "nominal_cost": round(final_price, 2),
                    "installments": 1,
                    "monthly_installment": round(final_price, 2),
                    "savings": 0.0,
                    "savings_pct": 0.0,
                    "payment_method": "cash",
                    "reason": "Pago al contado. Pierdes la oportunidad de hacer rendir el dinero en cuotas fijas."
                })
            else:
                options.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "type": acc.type,
                    "is_viable": False,
                    "real_cost": round(final_price, 2),
                    "nominal_cost": round(final_price, 2),
                    "installments": 1,
                    "monthly_installment": round(final_price, 2),
                    "savings": 0.0,
                    "savings_pct": 0.0,
                    "payment_method": "cash",
                    "reason": f"Saldo insuficiente (Precio: ${round(final_price, 2):,}, Saldo: ${round(acc.balance, 2):,})."
                })
                
    # Ordenar opciones: primero las viables, luego por costo real (menor costo real es mejor)
    options.sort(key=lambda x: (not x["is_viable"], x["real_cost"]))
    
    if not options:
        return []
        
    # Destacar la ganadora absoluta
    options[0]["is_winner"] = options[0]["is_viable"]
    for opt in options[1:]:
        opt["is_winner"] = False
        
    return options

