# Plan de Refactorización: SOLID, PHAME y Mantenibilidad Google

Este plan detalla los pasos estratégicos para llevar el proyecto "Gestor de Finanzas" a un nivel de calidad de código profesional (estilo Google), aplicando los principios SOLID (diseño de software) y PHAME (diseño orientado a objetos), garantizando un Índice de Mantenibilidad alto.

## ¿Qué son estos principios?
- **SOLID**: 5 principios para hacer el código más comprensible, flexible y mantenible (Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion).
- **PHAME**: 4 principios pilares de la programación y diseño orientado a objetos:
  - **P/H - Jerarquía (Hierarchy)**: Ordenamiento de las abstracciones (ej. herencia estructurada, estructura de capas).
  - **A - Abstracción (Abstraction)**: Ocultar los detalles de implementación complejos, exponiendo solo lo importante.
  - **M - Modularidad (Modularization)**: Dividir el sistema en partes independientes (módulos).
  - **E - Encapsulación (Encapsulation)**: Agrupar datos y los métodos que operan sobre ellos, restringiendo el acceso externo directo.

---

## FASE 1: Diagnóstico y Métricas de Mantenibilidad
Google exige que el código se evalúe objetivamente. Nuestro primer paso será medir dónde estamos.
1. **Implementar Análisis Estático de Código:**
   - **Backend (Python):** Integrar `Ruff` (linting rápido), `MyPy` (tipado estático) y `Radon` (para medir la complejidad ciclomática y calcular el *Maintainability Index* matemático). Apuntaremos a un MI > 65.
   - **Frontend Web (JavaScript/TypeScript/HTML):** Configurar `ESLint` estricto y `SonarQube` (local o en CI) para medir "code smells" y deuda técnica.
2. **Definir la línea base:** Documentar el estado actual y no aceptar nuevo código que empeore estas métricas (mediante pre-commit hooks).

## FASE 2: Aplicación de los Principios PHAME (Estructura Base)
Antes de pulir detalles, debemos arreglar la arquitectura a nivel de macro-componentes.
1. **Encapsulación (E) del Estado Global:**
   - *Problema actual:* En el frontend (`store.js`), el estado global (`state`) muta libremente desde cualquier archivo.
   - *Acción:* Crear métodos `getters` y `setters` estrictos. Nadie modificará `state.budgets` directamente; usarán `dispatch('UPDATE_BUDGETS', payload)`.
2. **Modularización (M) y Abstracción (A) de Archivos Gigantes:**
   - *Problema actual:* Archivos como `budgets.js` mezclan lógica de red (fetch), manipulación del DOM e inicialización.
   - *Acción:* Dividir en capas abstractas.
     - `api.js`: Solo llamadas a red (abstracción).
     - `budgetsService.js`: Lógica de negocio (suma de montos, reglas).
     - `budgetsView.js`: Solo actualizaciones visuales (DOM).
3. **Jerarquía (P/H) Arquitectónica:**
   - En el backend (FastAPI), implementar una "Arquitectura Limpia" estricta: Capa de Enrutamiento (Routers) → Capa de Servicios (Business Logic) → Capa de Acceso a Datos (Repositories).

## FASE 3: Aplicación de los Principios SOLID (Diseño Fino)
Una vez estructurado el macro, atacamos el código línea por línea.
1. **S - Responsabilidad Única (SRP):**
   - Asegurarnos de que una función haga *solo una cosa*. Por ejemplo, separar `openBudgetModal()` en `fetchBudgetData()`, `populateBudgetForm()` y `toggleModalVisibility()`.
2. **O - Abierto/Cerrado (OCP):**
   - El código debe estar abierto a extensión, pero cerrado a modificación. Si queremos agregar un nuevo tipo de transacción (ej. "Cripto"), no deberíamos tener que editar 5 archivos llenos de `if/else`. Usaremos patrones como el *Strategy Pattern* o diccionarios de controladores.
3. **L - Sustitución de Liskov (LSP):**
   - Si creamos clases base en Python (ej. `class ReportGenerator`) y subclases (`class PDFReportGenerator`, `class ExcelReportGenerator`), estas últimas deben ser intercambiables sin romper el código que las invoca.
4. **I - Segregación de Interfaces (ISP):**
   - (Principalmente en el Backend y Servicios Frontend): No forzar a un módulo a depender de métodos que no usa. Si un endpoint solo necesita leer cuentas, le inyectamos un `IReadOnlyAccountRepository`, no el repositorio completo con métodos de borrado.
5. **D - Inversión de Dependencias (DIP):**
   - Los módulos de alto nivel (como tu UI) no deben depender directamente de módulos de bajo nivel (como `fetch` a la base de datos). Ambos deben depender de abstracciones. Usaremos **Inyección de Dependencias** fuertemente (en FastAPI usando `Depends()`).

## FASE 4: Automatización y Cultura (Estilo Google)
- **Unit Testing (Pruebas Unitarias):** Un índice de mantenibilidad no se sostiene sin pruebas. Obligaremos a tener una cobertura de test (Coverage) > 80% usando `pytest` para backend y `Jest` para JS.
- **CI/CD Pipeline:** Implementar GitHub Actions. Si un commit no pasa el linter de SOLID/PHAME o reduce el índice de mantenibilidad, no se permite hacer "Merge" a la rama principal (rama `main`).

## FASE 5: Auditoría Automatizada de las 7 Métricas y Exportación a PDF
El proyecto cuenta con un motor automatizado (`generar.js` y `generar_reporte.py`) que audita los archivos fuente propios (`api/` en Python y `js/` en TypeScript/JS), excluyendo entornos virtuales y módulos fuera de alcance (`venv`, `fluxo_venv`, `node_modules`, `mobile`), y aplica las 7 ecuaciones oficiales:
1. **Índice de Mantenibilidad ($\text{MI}$):** $\max(0, ((171 - 25 \times \ln(\text{LOC}) - 0.23 \times G) / 171) \times 100)$
2. **Deuda Técnica (Horas):** $\max(0, (75 - \text{MI}) \times \text{LOC} \times K)$
3. **Costo de Reparación:** $\text{Deuda Técnica (Horas)} \times \text{Salario por Hora}$
4. **Tiempo Equivalente en Meses:** $\text{Deuda Técnica (Horas)} / \text{Horas por Mes}$
5. **Interés Anual:** $10 \times (14 - 7) \times \text{Salario por Hora}$
6. **Tiempo de Payback:** $\text{Costo de Reparación} / \text{Interés Anual}$
7. **ROI Proyectado:** $100 \times (((\text{Interés Anual} \times 2) - \text{Costo de Reparación}) / \text{Costo de Reparación})$

La vista HTML se genera en `html/reporte_deuda.html` vinculada a su hoja de estilos independiente `css/reporte_deuda.css` y se compila automáticamente en `Reporte de Deuda Técnica.pdf`.

---
*Este documento será la hoja de ruta viva para las próximas sesiones de refactorización del proyecto.*

