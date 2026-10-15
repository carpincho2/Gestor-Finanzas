// @ts-nocheck
import { apiFetch } from '../api/apiClient.ts';
import { userKey, state, IS_SERVER } from '../store/store.ts';

export interface ShoppingProductItem {
  id?: string;
  title: string;
  price: number;
  currency?: string;
  domain?: string;
  source?: string;
  permalink?: string;
}

export interface InstallmentScheduleItem {
  installment_number: number;
  nominal_amount: number;
  present_value: number;
  depreciation_pct: number;
  days_until_payment: number;
  estimated_date: string;
}

export interface ShoppingPaymentOption {
  account_id?: number | null;
  account_name: string;
  type: string;
  is_viable: boolean;
  real_cost: number;
  nominal_cost: number;
  installments: number;
  monthly_installment: number;
  savings: number;
  savings_pct: number;
  payment_method: string;
  days_to_first_payment?: number;
  closing_day?: number | null;
  due_day?: number | null;
  has_grace_advantage?: boolean;
  break_even_tna?: number | null;
  installments_breakdown?: InstallmentScheduleItem[];
  reason: string;
  is_winner?: boolean;
}

export interface ShoppingAnalysisResponse {
  ok: boolean;
  item: ShoppingProductItem;
  recommendation: ShoppingPaymentOption[];
}

export interface ShoppingHistoryEntry {
  title: string;
  price: number;
  domain: string;
  url: string;
  date: string;
}

export class ShoppingService {
  /**
   * Consulta detalles de precio y metadatos de cualquier URL.
   */
  static async fetchPrice(url: string): Promise<any> {
    const encoded = encodeURIComponent(url.trim());
    return await apiFetch(`/shopping/fetch-price?url=${encoded}`);
  }

  /**
   * Búsqueda por palabra clave en catálogo con soporte multi-fuente.
   */
  static async searchCatalog(query: string): Promise<any[]> {
    const res = await apiFetch(`/shopping/search?q=${encodeURIComponent(query.trim())}`);
    return res.results || [];
  }

  /**
   * Análisis financiero para código de barras EAN/GTIN.
   */
  static async analyzeBarcode(params: {
    barcode: string;
    installments?: number;
    discount?: number;
    tna?: number;
    surcharge?: number;
    installmentTotal?: number | null;
    maxDiscount?: number | null;
  }): Promise<ShoppingAnalysisResponse> {
    return await apiFetch('/shopping/analyze-barcode', {
      method: 'POST',
      body: JSON.stringify({
        barcode: params.barcode.trim(),
        installments_without_interest: params.installments || 0,
        discount_percentage: params.discount || 0,
        custom_tna: params.tna || 40,
        surcharge_percentage: params.surcharge || 0,
        installment_total_price: params.installmentTotal || null,
        max_discount_amount: params.maxDiscount || null
      })
    });
  }

  /**
   * Análisis financiero para URL o precio manual.
   */
  static async analyzeUrl(params: {
    url: string;
    price?: number | null;
    installments?: number;
    discount?: number;
    tna?: number;
    surcharge?: number;
    installmentTotal?: number | null;
    maxDiscount?: number | null;
  }): Promise<ShoppingAnalysisResponse> {
    return await apiFetch('/shopping/analyze-url', {
      method: 'POST',
      body: JSON.stringify({
        url: params.url.trim() || 'https://tienda-online.com/producto',
        price: params.price || null,
        installments_without_interest: params.installments || 0,
        discount_percentage: params.discount || 0,
        custom_tna: params.tna || 40,
        surcharge_percentage: params.surcharge || 0,
        installment_total_price: params.installmentTotal || null,
        max_discount_amount: params.maxDiscount || null
      })
    });
  }

  /**
   * Calcula los días exactos hasta el primer pago considerando cierre y vencimiento de tarjeta.
   */
  static calculateDaysToFirstPayment(today: Date, closingDay?: number | null, dueDay?: number | null): number {
    if (!closingDay || !dueDay || closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
      return 30;
    }

    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const day = today.getDate();

    const maxDaysCurrentMonth = new Date(year, month + 1, 0).getDate();
    const adjClosing = Math.min(closingDay, maxDaysCurrentMonth);
    const closingDate = new Date(year, month, adjClosing);

    let dueYear = year;
    let dueMonth = month;

    if (day <= adjClosing) {
      // Entra en el cierre de este mes
      if (dueDay > closingDay) {
        dueMonth = month;
      } else {
        dueMonth = month + 1;
      }
    } else {
      // Ya cerró este mes -> entra en el cierre del mes próximo
      if (dueDay > closingDay) {
        dueMonth = month + 1;
      } else {
        dueMonth = month + 2;
      }
    }

    const tempDue = new Date(year, dueMonth, 1);
    dueYear = tempDue.getFullYear();
    dueMonth = tempDue.getMonth();

    const maxDaysDue = new Date(dueYear, dueMonth + 1, 0).getDate();
    const adjDue = Math.min(dueDay, maxDaysDue);
    const dueDate = new Date(dueYear, dueMonth, adjDue);

    const diffMs = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 1);
  }

  /**
   * Calcula la TNA de corte (Break-Even TNA) cuando hay recargo en cuotas.
   */
  static calculateBreakEvenTna(
    cashPrice: number,
    totalCredit: number,
    installments: number,
    daysToFirst: number = 30
  ): number | null {
    if (installments <= 1 || totalCredit <= cashPrice || cashPrice <= 0) return null;
    const installmentAmount = totalCredit / installments;

    const vpnForTna = (tnaVal: number) => {
      const ted = (tnaVal / 100) / 365;
      let tot = 0;
      for (let k = 0; k < installments; k++) {
        const d_k = daysToFirst + 30 * k;
        tot += installmentAmount / Math.pow(1 + ted, d_k);
      }
      return tot;
    };

    let low = 0;
    let high = 600;
    if (vpnForTna(high) > cashPrice) return 999;

    let mid = low;
    for (let i = 0; i < 25; i++) {
      mid = (low + high) / 2;
      const val = vpnForTna(mid);
      if (val > cashPrice) low = mid;
      else high = mid;
    }
    return Math.round(mid * 10) / 10;
  }

  /**
   * Cronograma detallado de cuotas y desvalorización por inflación.
   */
  static calculatePaymentSchedule(
    installmentAmount: number,
    installments: number,
    tna: number,
    daysToFirst: number = 30,
    startDate?: Date,
    hasGraceAdvantage: boolean = false
  ): { vpn: number; schedule: InstallmentScheduleItem[] } {
    const baseDate = startDate || new Date();
    const ted = tna > 0 ? (tna / 100) / 365 : 0;
    let vpnTotal = 0;
    const schedule: InstallmentScheduleItem[] = [];
    const shouldDiscount = installments > 1 || hasGraceAdvantage;

    for (let k = 0; k < installments; k++) {
      const days = daysToFirst + 30 * k;
      const pv = (shouldDiscount && ted > 0) ? (installmentAmount / Math.pow(1 + ted, days)) : installmentAmount;
      const depreciation = installmentAmount > 0 ? ((installmentAmount - pv) / installmentAmount) * 100 : 0;

      const payDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

      vpnTotal += pv;
      schedule.push({
        installment_number: k + 1,
        nominal_amount: Math.round(installmentAmount * 100) / 100,
        present_value: Math.round(pv * 100) / 100,
        depreciation_pct: Math.round(depreciation * 10) / 10,
        days_until_payment: days,
        estimated_date: payDate.toISOString().split('T')[0]
      });
    }

    return {
      vpn: Math.round(vpnTotal * 100) / 100,
      schedule
    };
  }

  /**
   * Motor financiero de evaluación local (fallback offline y simulación instantánea).
   */
  static localEvaluateShopping(params: {
    url: string;
    title: string;
    price: number;
    installments: number;
    discount?: number;
    tna?: number;
    surcharge?: number;
    installmentTotal?: number | null;
    maxDiscount?: number | null;
    accounts?: any[];
  }): ShoppingAnalysisResponse {
    const { url, title, price, installments, discount = 0, tna = 40, surcharge = 0, installmentTotal = null, maxDiscount = null, accounts = [] } = params;

    const today = new Date();

    // Descuento efectivo con tope de reintegro
    let effectiveDiscount = 0;
    if (discount > 0) {
      const rawDiscount = price * (discount / 100);
      effectiveDiscount = (maxDiscount && maxDiscount > 0) ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
    }
    const cashPrice = Math.max(0, price - effectiveDiscount);

    // Precio total financiado
    let totalCredit = cashPrice;
    if (installmentTotal && installmentTotal > 0) {
      totalCredit = installmentTotal;
    } else if (surcharge > 0) {
      totalCredit = cashPrice * (1 + surcharge / 100);
    }

    const cuotas = installments > 0 ? [installments] : [1, 3, 6, 9, 12, 18, 24];
    const options: ShoppingPaymentOption[] = [];

    if (accounts.length === 0) {
      for (const n of cuotas) {
        const cuotaNominal = totalCredit / n;
        const { vpn, schedule } = this.calculatePaymentSchedule(cuotaNominal, n, tna, 30, today, false);
        const ahorro = cashPrice - vpn;
        const ahorroPct = cashPrice > 0 ? Math.round((ahorro / cashPrice) * 1000) / 10 : 0;
        const breakEven = totalCredit > cashPrice ? this.calculateBreakEvenTna(cashPrice, totalCredit, n, 30) : null;

        options.push({
          account_id: null,
          account_name: n > 1 ? `Tarjeta de Crédito (${n} cuotas)` : 'Efectivo / Débito',
          type: n > 1 ? 'Crédito' : 'Contado',
          is_viable: true,
          nominal_cost: Math.round(totalCredit * 100) / 100,
          real_cost: vpn,
          installments: n,
          monthly_installment: Math.round(cuotaNominal * 100) / 100,
          savings: Math.round(ahorro * 100) / 100,
          savings_pct: ahorroPct,
          payment_method: n > 1 ? 'credit' : 'cash',
          days_to_first_payment: 30,
          break_even_tna: breakEven,
          installments_breakdown: schedule,
          reason: n > 1
            ? `Pagando en ${n} cuotas de $${Math.round(cuotaNominal).toLocaleString('es-AR')}, tu costo real ajustado por inflación (${tna}% TNA) es $${Math.round(vpn).toLocaleString('es-AR')} (${ahorro >= 0 ? 'ahorrás' : 'sobrecosto de'} ${Math.abs(ahorroPct)}% vs contado).`
            : `Pago al contado de $${Math.round(cashPrice).toLocaleString('es-AR')}.`
        });
      }
    } else {
      for (const acc of accounts) {
        const accType = (acc.type || '').toLowerCase();
        const accLimit = acc.limit || 0;
        const accBalance = acc.balance || 0;
        const closingDay = acc.closing_day || null;
        const dueDay = acc.due_day || null;
        const isCredit = accType.includes('crédit') || accType.includes('credit') || accLimit > 0;

        if (isCredit) {
          const daysToFirst = this.calculateDaysToFirstPayment(today, closingDay, dueDay);
          const hasGraceAdvantage = Boolean(closingDay && today.getDate() > closingDay && daysToFirst >= 32);

          if (accLimit >= totalCredit) {
            for (const n of cuotas) {
              const cuotaNominal = totalCredit / n;
              const { vpn, schedule } = this.calculatePaymentSchedule(cuotaNominal, n, tna, daysToFirst, today, hasGraceAdvantage);
              const ahorro = cashPrice - vpn;
              const ahorroPct = cashPrice > 0 ? Math.round((ahorro / cashPrice) * 1000) / 10 : 0;
              const breakEven = totalCredit > cashPrice ? this.calculateBreakEvenTna(cashPrice, totalCredit, n, daysToFirst) : null;

              const graceNote = hasGraceAdvantage ? ` (ganás ${daysToFirst} días de gracia por cierre reciente)` : '';

              let reasonText = '';
              if (n > 1) {
                if (ahorro > 0) {
                  reasonText = `Te conviene pagar en ${n} cuotas de $${Math.round(cuotaNominal).toLocaleString('es-AR')}${graceNote}. Ajustado por rendimiento/inflación (${tna}% TNA), tu costo real es $${Math.round(vpn).toLocaleString('es-AR')} (ahorrás un ${ahorroPct}% vs contado).`;
                } else {
                  const beMsg = breakEven ? ` (necesitarías una TNA mayor a ${breakEven}% para que convenga)` : '';
                  reasonText = `En ${n} cuotas de $${Math.round(cuotaNominal).toLocaleString('es-AR')}, el recargo financiero supera la inflación (costo real: $${Math.round(vpn).toLocaleString('es-AR')}, sobrecosto del ${Math.abs(ahorroPct)}% vs contado)${beMsg}.`;
                }
              } else {
                reasonText = hasGraceAdvantage
                  ? `Pago en 1 cuota con ${acc.name}: al cerrar recientemente, tenés ${daysToFirst} días gratis para pagar el resumen.`
                  : `Pago en 1 cuota con ${acc.name}.`;
              }

              options.push({
                account_id: acc.id,
                account_name: `${acc.name} (${n} ${n > 1 ? 'cuotas' : 'pago'})`,
                type: 'Tarjeta de Crédito',
                is_viable: true,
                nominal_cost: Math.round(totalCredit * 100) / 100,
                real_cost: vpn,
                installments: n,
                monthly_installment: Math.round(cuotaNominal * 100) / 100,
                savings: Math.round(ahorro * 100) / 100,
                savings_pct: ahorroPct,
                payment_method: 'credit',
                days_to_first_payment: daysToFirst,
                closing_day: closingDay,
                due_day: dueDay,
                has_grace_advantage: hasGraceAdvantage,
                break_even_tna: breakEven,
                installments_breakdown: schedule,
                reason: reasonText
              });
            }
          } else {
            options.push({
              account_id: acc.id,
              account_name: acc.name,
              type: 'Tarjeta de Crédito',
              is_viable: false,
              nominal_cost: Math.round(totalCredit * 100) / 100,
              real_cost: Math.round(totalCredit * 100) / 100,
              installments: cuotas[cuotas.length - 1],
              monthly_installment: Math.round(totalCredit * 100) / 100,
              savings: 0,
              savings_pct: 0,
              payment_method: 'credit',
              days_to_first_payment: daysToFirst,
              closing_day: closingDay,
              due_day: dueDay,
              has_grace_advantage: hasGraceAdvantage,
              break_even_tna: null,
              installments_breakdown: [],
              reason: `Límite disponible superado (Precio: $${Math.round(totalCredit).toLocaleString('es-AR')}, Límite: $${Math.round(accLimit).toLocaleString('es-AR')}).`
            });
          }
        } else {
          // Débito, Efectivo, Billetera Virtual
          const isViable = accBalance >= cashPrice;
          options.push({
            account_id: acc.id,
            account_name: acc.name,
            type: accType.includes('cash') || accType.includes('efectivo') ? 'Efectivo' : 'Débito / Cuenta',
            is_viable: isViable,
            nominal_cost: Math.round(cashPrice * 100) / 100,
            real_cost: Math.round(cashPrice * 100) / 100,
            installments: 1,
            monthly_installment: Math.round(cashPrice * 100) / 100,
            savings: 0,
            savings_pct: 0,
            payment_method: 'cash',
            days_to_first_payment: 0,
            closing_day: null,
            due_day: null,
            has_grace_advantage: false,
            break_even_tna: null,
            installments_breakdown: [{
              installment_number: 1,
              nominal_amount: Math.round(cashPrice * 100) / 100,
              present_value: Math.round(cashPrice * 100) / 100,
              depreciation_pct: 0,
              days_until_payment: 0,
              estimated_date: today.toISOString().split('T')[0]
            }],
            reason: isViable
              ? `Pago directo con ${acc.name}. Abonás $${Math.round(cashPrice).toLocaleString('es-AR')} al contado.`
              : `Saldo insuficiente (Precio contado: $${Math.round(cashPrice).toLocaleString('es-AR')}, Saldo: $${Math.round(accBalance).toLocaleString('es-AR')}).`
          });
        }
      }
    }

    options.sort((a, b) => (Number(!a.is_viable) - Number(!b.is_viable)) || (a.real_cost - b.real_cost));
    if (options.length > 0) {
      options[0].is_winner = options[0].is_viable;
    }

    return {
      ok: true,
      item: {
        title: title || 'Producto seleccionado',
        price: price,
        permalink: url,
        domain: 'Tienda Web'
      },
      recommendation: options
    };
  }

  // --- PERSISTENCIA DE HISTORIAL CON userKey() ---

  static getHistory(): ShoppingHistoryEntry[] {
    try {
      const raw = localStorage.getItem(userKey('flujo_shopping_history'));
      if (raw) return JSON.parse(raw);
      // Fallback a clave previa
      const legacy = localStorage.getItem('gestor_shopping_history');
      if (legacy) return JSON.parse(legacy);
      return [];
    } catch (_) {
      return [];
    }
  }

  static saveHistory(entry: ShoppingHistoryEntry): void {
    try {
      let hist = this.getHistory();
      hist = hist.filter(h => h.title !== entry.title);
      hist.unshift({
        title: entry.title,
        price: entry.price,
        domain: entry.domain,
        url: entry.url || '',
        date: new Date().toLocaleDateString('es-AR')
      });
      localStorage.setItem(userKey('flujo_shopping_history'), JSON.stringify(hist.slice(0, 8)));
    } catch (_) {}
  }

  static clearHistory(): void {
    localStorage.removeItem(userKey('flujo_shopping_history'));
    localStorage.removeItem('gestor_shopping_history');
  }

  // --- MODO COMPARADOR (OFERTA A vs OFERTA B) ---

  static getPinnedOffer(): any {
    try {
      const raw = sessionStorage.getItem(userKey('flujo_shopping_pinned'));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  static setPinnedOffer(data: any): void {
    try {
      sessionStorage.setItem(userKey('flujo_shopping_pinned'), JSON.stringify(data));
    } catch (_) {}
  }

  static clearPinnedOffer(): void {
    sessionStorage.removeItem(userKey('flujo_shopping_pinned'));
  }
}
