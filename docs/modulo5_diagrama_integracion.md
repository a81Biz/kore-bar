# Diagrama de Integración y Arquitectura de Solución

## Justificación del Modelo
El siguiente diagrama ilustra la topología de la red local (LAN) a 200 Mbps requerida para la operación, y cómo los distintos módulos de interfaces interactúan con el backend centralizado. Esta arquitectura garantiza que los nodos de operación (Tabletas y KDS) funcionen de manera asíncrona pero sincronizada con la base de datos central, asegurando la consistencia de los datos desde la toma de pedido hasta la facturación.

```mermaid
graph TD
    %% Nodos Externos / Comensales
    subgraph Red_Publica [Red Pública / Dispositivos Externos]
        A[Dispositivo Comensal] -- Escanea QR / HTTP GET --> B(Menú Digital Web - W01)
        API_SAT[API Timbrado SAT / PAC]
        Email[Servidor SMTP Correo]
    end

    %% Red Local del Restaurante
    subgraph LAN [Red Local Restaurante - Inalámbrica 200 Mbps]
        
        %% Módulo Meseros
        subgraph Modulo_Meseros [Capa de Servicio - App Tablets]
            T1[W02 - Login] --> T2[W03 - Mapa Mesas]
            T2 --> T3[W04 - Toma Pedidos]
            T3 --> T4[W05 - Cierre Cuenta]
        end

        %% Módulo KDS Cocina
        subgraph Modulo_Cocina [Capa de Producción - Pizarra Interactiva PC]
            K1[W06 - Pizarra KDS Kanban]
        end

        %% Backend Central
        subgraph Servidor_Local [Servidor Central / API Rest]
            API((Controlador Central))
            DB[(Base de Datos MySQL/PostgreSQL)]
            Batch[Proceso Batch Nocturno - Explosión Insumos]
            
            API <--> DB
            Batch --> DB
        end

        %% Módulo Administrativo Escritorio
        subgraph Modulo_Admin [Capa Administrativa - PCs Escritorio]
            AD1[W09 - Mesas y Asignación]
            AD2[W10 - Menú CRUD]
            AD3[W11 - RRHH Inasistencias]
            AD4[W12 - Inventarios / Compras]
            AD5[W13 - Caja y Facturación]
            AD6[W14 - Reportes]
        end
        
        %% Hardware Físico en Red
        Imp[Impresora Térmica en Red]

    end

    %% Conexiones y Flujos de Datos
    B -. Lee Catálogo .-> API
    
    T3 -- POST Petición (Timestamp) --> API
    API -- WebSocket Push --> K1
    K1 -- POST Platillo Listo (Timestamp) --> API
    API -- Notificación Push --> T3
    
    T4 -- Cierra Orden --> API
    API -- Envía a Cola de Impresión --> Imp
    API -. Habilita Cuenta .- AD5
    
    AD1 <--> API
    AD2 <--> API
    AD3 <--> API
    AD4 <--> API
    AD5 <--> API
    AD6 <--> API
    
    K1 -. Alimenta consumos para el cierre .- Batch
    
    %% Conexiones Externas
    AD5 -- Petición Timbrado CFDI --> API_SAT
    AD5 -- Envío Factura PDF/XML --> Email

```

* **Flujo Transaccional Crítico:** La tableta (W04) envía la petición a la API. La API guarda en DB e informa a la Pizarra KDS (W06). Al terminar, KDS avisa a la API, quien notifica a la tableta. Al cerrar la cuenta (W05), se libera la mesa y la información pasa directamente al módulo de Caja (W13) para pago o facturación conectándose al SAT. Al final del día, los pedidos cerrados ejecutan el script de consumo de inventarios.
