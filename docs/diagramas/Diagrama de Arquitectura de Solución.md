graph TD
    subgraph INF["🐳 Infraestructura — Docker Compose + nginx"]
        DC[Docker Compose]
        NG[nginx — virtual hosts]
    end

    subgraph FE["🖥 Capa de Presentación — Frontend Vanilla JS"]
        W[waiters.localhost\nPOS Meseros]
        K[kitchen.localhost\nKDS Cocina]
        C[cashier.localhost\nCaja]
        M[menu.localhost\nMenú Público]
        AD[admin.localhost\nAdministración]
        SH["⬡ Shared JS\nhttp.client · endpoints · pubsub · kore.env"]
    end

    subgraph BE["⚙ Backend — Node.js + Hono"]
        AUTH[Auth Middleware\nJWT · PIN bcrypt]
        SR[schemaRouter\nWorkflow Engine]
        HLP[Helpers\nwaiter · kitchen · cashier · admin]
        MOD[Models\nllamadas a SPs y queries]
    end

    subgraph DATA["🗄 Capa de Datos"]
        PG[(PostgreSQL\nSPs · Views · Triggers)]
        SB[Supabase\nRealtime WebSocket]
    end

    DC --> NG
    NG --> FE
    NG --> BE

    W & K & C & M & AD --> SH
    SH -->|HTTP REST / JSON| AUTH
    AUTH --> SR
    SR --> HLP
    HLP --> MOD
    MOD --> PG
    PG -.->|RLS + pg_notify| SB
    SB -.->|WebSocket push| W
    SB -.->|WebSocket push| K