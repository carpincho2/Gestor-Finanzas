# Diagramas de Arquitectura Mejorados — Flujo

Versión mejorada de los 4 diagramas Mermaid (arquitectura, casos de uso, ER y secuencia OCR).
Mejoras generales: colores semánticos por capa (`classDef`), íconos, etiquetas completas (sin texto cortado), numeración de pasos y rutas de error.

---

## 1. Arquitectura por capas

```mermaid
flowchart TB
    classDef front fill:#1e1b4b,stroke:#a78bfa,stroke-width:2px,color:#fff
    classDef back fill:#042f2e,stroke:#2dd4bf,stroke-width:2px,color:#fff
    classDef data fill:#431407,stroke:#fb923c,stroke-width:2px,color:#fff
    classDef ext fill:#172554,stroke:#60a5fa,stroke-width:2px,color:#fff

    subgraph L1["📱 Capa de Presentación"]
        UI["<b>Cliente (Flutter / Web)</b><br/>Vistas · Estado · Captura de cámara"]
    end

    subgraph L2["⚙️ Capa de Aplicación"]
        API["<b>FastAPI REST</b><br/>Routers · Validación Pydantic"]
        SVC["<b>Servicios de Negocio</b><br/>Transacciones · Presupuestos · OCR"]
        API --> SVC
    end

    subgraph L3["💾 Capa de Persistencia"]
        DB[("<b>PostgreSQL</b><br/>Base de datos relacional")]
    end

    subgraph L4["🌐 Servicios Externos"]
        AI["🤖 Motor OCR / IA<br/>Gemini 2.5 Flash"]
    end

    UI -- "HTTPS · JSON / Base64" --> API
    SVC -- "SQLAlchemy ORM" --> DB
    SVC -- "Imagen → JSON estructurado" --> AI

    class UI front
    class API,SVC back
    class DB data
    class AI ext
```

---

## 2. Casos de uso del sistema

```mermaid
flowchart LR
    classDef actor fill:#1e1b4b,stroke:#a78bfa,stroke-width:3px,color:#fff
    classDef uc fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef ai fill:#042f2e,stroke:#2dd4bf,stroke-width:2px,color:#fff

    U(["👤 Usuario / Cliente"]):::actor

    subgraph SYS["🚀 Sistema Flujo"]
        direction TB
        subgraph G1["Gestión financiera"]
            UC1["🏦 Gestionar cuentas y billeteras"]
            UC2["✍️ Registrar transacción manual"]
            UC5["🎯 Establecer presupuestos y objetivos"]
        end
        subgraph G2["Automatización e inteligencia"]
            UC3["🧾 Escanear ticket con OCR"]
            UC6["🛒 Comparar precios en supermercados"]
        end
        subgraph G3["Análisis"]
            UC4["📊 Visualizar dashboard y gráficos"]
        end
    end

    U --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6
    UC3 -. "«include»" .-> UC2
    UC4 -. "«extend»" .-> UC5

    class UC1,UC2,UC4,UC5 uc
    class UC3,UC6 ai
```

---

## 3. Modelo Entidad–Relación

> Se agregó `id_cuenta` (FK) en `TRANSACCION` y la relación `CUENTA ─ registra ─ TRANSACCION`, que faltaba.
> Se completaron tipos (`decimal` para dinero, `timestamp`) y restricciones `UK`.

```mermaid
erDiagram
    USUARIO ||--o{ CUENTA : posee
    USUARIO ||--o{ TRANSACCION : realiza
    CUENTA ||--o{ TRANSACCION : registra
    CATEGORIA ||--o{ TRANSACCION : clasifica

    USUARIO {
        int id_usuario PK
        string nombre
        string email UK
        json preferencias_ia
    }

    CUENTA {
        int id_cuenta PK
        int id_usuario FK
        string tipo "efectivo, debito, credito, billetera"
        string moneda "ARS, USD, EUR"
        decimal saldo_actual
    }

    CATEGORIA {
        int id_categoria PK
        string nombre_rubro UK
        json metadatos_ocr
    }

    TRANSACCION {
        int id_transaccion PK
        int id_usuario FK
        int id_cuenta FK
        int id_categoria FK
        decimal monto
        date fecha
        string comercio
    }
```

---

## 4. Secuencia: registro de gasto con OCR

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 Usuario
    participant FE as 📱 Frontend
    participant BE as ⚙️ Backend (FastAPI)
    participant AI as 🤖 Motor OCR / IA
    participant DB as 💾 PostgreSQL

    U->>FE: Toma foto del ticket
    FE->>BE: POST /transacciones/ocr (imagen Base64)
    activate BE
    BE->>AI: Envía imagen para extracción
    activate AI

    alt Extracción exitosa
        AI-->>BE: JSON estructurado (ítems, montos, comercio)
        deactivate AI
        BE->>DB: INSERT transacción procesada
        activate DB
        DB-->>BE: Confirma persistencia
        deactivate DB
        BE-->>FE: 201 Created (gasto registrado)
        FE-->>U: ✅ Actualiza dashboard y balance
    else IA saturada (HTTP 429) o texto ilegible
        AI-->>BE: Error / confianza baja
        Note over BE,AI: Reintentos con backoff (2s, 4s, 8s)<br/>y fallback al parser local
        BE-->>FE: 422 con datos parciales
        FE-->>U: ⚠️ Formulario precompletado para corregir
    end
    deactivate BE
```
