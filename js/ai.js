/* =====================================================
   IA INSIGHTS LOGIC
   ===================================================== */
let aiChatHistory = [];
let aiIsLoading = false;

function enterInsightsView() {
  // Nada especial que resetear al entrar
}

/* ---- Build financial context string for the AI ---- */
function aiBuildContext() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // Category breakdown
  const catMap = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.cat] = (catMap[t.cat] || 0) + t.amount;
  });
  const catBreakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `${c}: $${v.toLocaleString('es-AR')}`)
    .join(', ');

  // Budgets status
  const budgetStatus = budgets.map(b => {
    const spent = thisMonth.filter(t => t.type === 'expense' && t.cat === b.name)
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.limit > 0 ? Math.round(spent / b.limit * 100) : 0;
    return `${b.name}: gastado $${spent.toLocaleString('es-AR')} de $${b.limit.toLocaleString('es-AR')} (${pct}%)`;
  }).join('; ');

  // Goals
  const goalStatus = goals.map(g => {
    const saved = (g.contributions || []).reduce((s, c) => s + c.amount, 0) + (g.initial || 0);
    const pct = g.target > 0 ? Math.round(saved / g.target * 100) : 0;
    return `${g.name}: $${saved.toLocaleString('es-AR')} de $${g.target.toLocaleString('es-AR')} (${pct}%)`;
  }).join('; ');

  // Last 3 months trend
  const last3 = [0, 1, 2].map(offset => {
    const m = (month - offset + 12) % 12;
    const y = month - offset < 0 ? year - 1 : year;
    const tx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    const inc = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const mName = new Date(y, m, 1).toLocaleString('es-AR', { month: 'long' });
    return `${mName}: ingresos $${inc.toLocaleString('es-AR')}, gastos $${exp.toLocaleString('es-AR')}`;
  }).reverse().join(' | ');

  return `CONTEXTO FINANCIERO DEL USUARIO (${now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}):
- Ingresos del mes: $${income.toLocaleString('es-AR')}
- Gastos del mes: $${expense.toLocaleString('es-AR')}
- Balance neto: $${balance.toLocaleString('es-AR')}
- Tasa de ahorro: ${income > 0 ? Math.round((balance / income) * 100) : 0}%
- Gastos por categoría: ${catBreakdown || 'Sin datos'}
- Estado presupuestos: ${budgetStatus || 'Sin presupuestos'}
- Objetivos de ahorro: ${goalStatus || 'Sin objetivos'}
- Tendencia últimos 3 meses: ${last3}
- Total transacciones históricas: ${transactions.length}`;
}

/* ---- Quick prompt shortcuts ---- */
const AI_QUICK_PROMPTS = {
  resumen: 'Dame un resumen detallado de mis finanzas de este mes. ¿Cómo estoy?',
  gastos: '¿En qué categorías gasto más? ¿Hay algo que debería reducir?',
  ahorro: 'Basándote en mis gastos actuales, ¿qué consejos concretos me das para ahorrar más?',
  presupuesto: '¿Cómo estoy con mis presupuestos? ¿Alguno en riesgo de superar?',
  tendencias: '¿Qué tendencias ves en mis finanzas en los últimos meses? ¿Mejoro o empeoro?',
  alerta: '¿Hay alguna alerta o riesgo financiero que debería atender urgente?',
};

function aiQuickPrompt(btn, key) {
  const q = AI_QUICK_PROMPTS[key];
  if (!q) return;
  document.getElementById('aiChatInput').value = q;
  btn.classList.add('ai-quick-btn--active');
  setTimeout(() => btn.classList.remove('ai-quick-btn--active'), 600);
  aiSendMessage();
}

/* ---- Send message ---- */
async function aiSendMessage() {
  if (aiIsLoading) return;
  const input = document.getElementById('aiChatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  aiAppendMessage('user', text);
  aiChatHistory.push({ role: 'user', content: text });

  aiSetLoading(true);

  try {
    const context = aiBuildContext();

    // Llamar de forma segura al endpoint de FastAPI en Python
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        contexto_financiero: context,
        pregunta: text,
        historial: aiChatHistory.slice(0, -1) // Enviamos el historial sin la última pregunta
      })
    });

    if (res.error) {
      throw new Error(res.error);
    }

    const reply = res.reply || 'Sin respuesta.';
    aiChatHistory.push({ role: 'assistant', content: reply });
    aiAppendMessage('bot', reply);
  } catch (err) {
    aiAppendMessage('bot', '❌ Hubo un error al conectar con la IA. ' + (err.message || 'Intentá de nuevo.'));
    console.error('AI error:', err);
  } finally {
    aiSetLoading(false);
  }
}

/* ---- Loading state spinner in chat ---- */
function aiSetLoading(loading) {
  aiIsLoading = loading;
  const btn = document.getElementById('aiSendBtn');
  const messagesDiv = document.getElementById('aiChatMessages');

  if (btn) btn.disabled = loading;

  if (loading) {
    const div = document.createElement('div');
    div.id = 'aiChatTypingIndicator';
    div.className = 'ai-msg ai-msg-bot';
    div.innerHTML = `
      <div class="ai-msg-avatar">✦</div>
      <div class="ai-msg-bubble">
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
      </div>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  } else {
    const indicator = document.getElementById('aiChatTypingIndicator');
    if (indicator) indicator.remove();
  }
}

/* ---- Append a message bubble ---- */
function aiAppendMessage(who, text) {
  const el = document.getElementById('aiChatMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${who}`;

  if (who === 'bot') {
    div.innerHTML = `
      <div class="ai-msg-avatar">✦</div>
      <div class="ai-msg-bubble">${aiFormatText(text)}</div>`;
  } else {
    div.innerHTML = `<div class="ai-msg-bubble ai-msg-bubble-user">${escHtml(text)}</div>`;
  }

  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

/* ---- Simple markdown formatter for bold and newlines ---- */
function aiFormatText(text) {
  let html = escHtml(text);
  // Reemplazar saltos de línea por <br>
  html = html.replace(/\n/g, '<br>');
  // Reemplazar **texto** por <strong>texto</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Reemplazar listados simples de asteriscos '* ' o '- ' por viñetas
  html = html.replace(/^(?:\s*[-*]\s+)(.*?)(?:<br>|$)/gm, '• $1<br>');
  return html;
}

/* ---- Generate 4 AI Insights cards ---- */
async function aiGenerateCards() {
  const list = document.getElementById('aiCardsList');
  const btn = document.getElementById('aiRefreshBtn');
  if (!list || !btn) return;

  btn.disabled = true;
  btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="ai-spin" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Generando…`;

  list.innerHTML = `
    <div class="ai-cards-loading">
      <div class="ai-cards-skeleton"></div>
      <div class="ai-cards-skeleton"></div>
      <div class="ai-cards-skeleton"></div>
    </div>`;

  try {
    const context = aiBuildContext();
    const res = await apiFetch('/ai/insights', {
      method: 'POST',
      body: JSON.stringify({ contexto_financiero: context })
    });

    if (res.error) {
      throw new Error(res.error);
    }

    const cards = res.cards;
    if (!cards || !Array.isArray(cards)) {
      throw new Error('Formato de respuesta incorrecto.');
    }

    list.innerHTML = cards.map(c => `
      <div class="ai-insight-card ai-insight-card--${c.tipo}">
        <div class="ai-insight-card-top">
          <span class="ai-insight-icon">${c.icono}</span>
          <span class="ai-insight-badge ai-insight-badge--${c.tipo}">${c.tipo === 'positivo' ? 'Positivo' : c.tipo === 'negativo' ? 'Atención' : c.tipo === 'alerta' ? '⚠ Alerta' : 'Info'
      }</span>
        </div>
        <div class="ai-insight-title">${escHtml(c.titulo)}</div>
        <div class="ai-insight-desc">${escHtml(c.descripcion)}</div>
      </div>
    `).join('');

  } catch (err) {
    list.innerHTML = `<div style="text-align:center;color:var(--danger);font-family:var(--font-mono);font-size:12px;padding:24px;">
      Error al generar insights.<br>${escHtml(err.message || 'Intentá de nuevo.')}
    </div>`;
    console.error('AI cards error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Actualizar`;
  }
}

