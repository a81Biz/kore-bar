sequenceDiagram
    actor M as Mesero
    participant FW as Frontend Waiters
    participant API as Backend Hono
    participant DB as PostgreSQL
    participant FK as Frontend Kitchen
    actor CO as Cocinero
    participant FC as Frontend Cashier
    actor CAJ as Cajero

    M->>FW: Selecciona mesa y comensales
    FW->>API: POST /open-table {tableCode, employeeNumber, diners}
    API->>DB: CALL sp_pos_open_table()
    Note over DB: Idempotente — crea orden OPEN si no existe
    DB-->>API: OK
    API-->>FW: {status: OPEN}

    M->>FW: Agrega items al carrito
    M->>FW: Envía pedido a cocina
    FW->>API: POST /submit-order {waiterCode, tableCode, items[]}
    API->>DB: CALL sp_pos_submit_order()
    Note over DB: Routing por has_recipe AND route_to_kds<br/>PENDING_KITCHEN o PENDING_FLOOR
    DB-->>API: order_items creados
    API-->>FW: {items: [...], sentItems: [...]}

    loop Polling / Realtime KDS
        FK->>API: GET /kitchen/board
        API->>DB: SELECT vw_kitchen_board
        DB-->>API: items PENDING_KITCHEN
        API-->>FK: tablero actualizado
    end

    CO->>FK: Acepta item → PREPARING
    FK->>API: PATCH /kds/:id/preparing
    API->>DB: CALL sp_kds_set_preparing()
    CO->>FK: Termina item → READY
    FK->>API: PATCH /kds/:id/ready
    API->>DB: CALL sp_kds_set_ready()

    loop Polling Waiters
        FW->>API: GET /order-status/:tableCode
        API-->>FW: items actualizados
    end

    M->>FW: Recolecta item READY
    FW->>API: POST /collect-item {itemId, waiterCode}
    API->>DB: CALL sp_pos_collect_item()
    Note over DB: Descuenta stock de cocina/piso vía kardex
    M->>FW: Entrega item al cliente
    FW->>API: POST /deliver-item {itemId}
    API->>DB: CALL sp_pos_deliver_item()

    M->>FW: Solicita cuenta / cierra mesa
    FW->>API: POST /close-table {tableCode, employeeNumber}
    API->>DB: CALL sp_pos_close_table()
    Note over DB: status → AWAITING_PAYMENT

    FC->>API: GET /cashier/board
    API->>DB: SELECT vw_cashier_board
    DB-->>API: mesas en AWAITING_PAYMENT
    API-->>FC: tablero de caja

    CAJ->>FC: Selecciona mesa, agrega líneas de pago
    CAJ->>FC: Confirma pago
    FC->>API: POST /cashier/pay {tableCode, cashierCode, payments[], tip}
    API->>DB: CALL sp_cashier_process_payment()
    Note over DB: Inserta payments<br/>Genera folio TKT-YYYYMMDD-XXXX<br/>status → CLOSED
    DB-->>API: {folio, total}
    API-->>FC: Ticket emitido