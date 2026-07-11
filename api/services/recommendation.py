from typing import List, Dict, Any

def evaluate_payment_options(
    price: float, 
    accounts: List[Any], 
    tna: float = 40.0, 
    discount: float = 0.0, 
    installments: int = 1
) -> List[Dict[str, Any]]:
    """
    Motor matemático de recomendación.
    Compara pagar con débito/billetera vs crédito en cuotas.
    
    tna: Tasa Nominal Anual de rendimiento (costo de oportunidad).
    discount: Porcentaje de descuento (0 a 100).
    installments: Cuotas sin interés.
    """
    
    # Calcular precio final con descuento aplicado
    final_price = price * (1 - (discount / 100))
    
    # Costo de oportunidad mensual (TEM - Tasa Efectiva Mensual aprox)
    tem = (tna / 100) / 12
    
    # Valor Presente Neto (VPN) del pago en cuotas
    # Formula VPN cuotas fijas: Pago_cuota * [ (1 - (1+tem)^-n) / tem ]
    if installments > 1 and tem > 0:
        cuota = final_price / installments
        # Asumimos que la primera cuota se paga en el mes 1
        vpn_credito = cuota * ((1 - (1 + tem)**-installments) / tem)
    else:
        vpn_credito = final_price
        
    options = []
    
    for acc in accounts:
        acc_type = acc.type.lower()
        
        if "crédito" in acc_type or "credito" in acc_type or "credit" in acc_type:
            # Validar límite
            if acc.limit >= final_price:
                # El costo real para el usuario es el VPN (cuanto menor, mejor)
                options.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "type": acc.type,
                    "is_viable": True,
                    "real_cost": round(vpn_credito, 2),
                    "nominal_cost": round(final_price, 2),
                    "installments": installments,
                    "payment_method": "credit",
                    "reason": f"Pagás en {installments} cuotas. Costo real ajustado por inflación/oportunidad: ${round(vpn_credito, 2)}"
                })
            else:
                options.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "type": acc.type,
                    "is_viable": False,
                    "real_cost": round(vpn_credito, 2),
                    "nominal_cost": round(final_price, 2),
                    "installments": installments,
                    "payment_method": "credit",
                    "reason": "Fondos insuficientes (límite superado)"
                })
        else:
            # Débito, Efectivo, Billetera Virtual (se paga todo hoy, VPN = Precio Final)
            if acc.balance >= final_price:
                options.append({
                    "account_id": acc.id,
                    "account_name": acc.name,
                    "type": acc.type,
                    "is_viable": True,
                    "real_cost": round(final_price, 2),
                    "nominal_cost": round(final_price, 2),
                    "installments": 1,
                    "payment_method": "cash",
                    "reason": "Pago al contado. No le ganás a la inflación con esta opción."
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
                    "payment_method": "cash",
                    "reason": "Fondos insuficientes (saldo superado)"
                })
                
    # Ordenar opciones: primero las viables, luego por costo real (menor a mayor)
    options.sort(key=lambda x: (not x["is_viable"], x["real_cost"]))
    
    if not options:
        return []
        
    # Destacar la ganadora
    options[0]["is_winner"] = options[0]["is_viable"] # Solo gana si es viable
    for opt in options[1:]:
        opt["is_winner"] = False
        
    return options
