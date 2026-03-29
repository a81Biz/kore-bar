erDiagram
    ROLES {
        uuid id PK
        varchar code UK
        varchar name
        boolean is_active
    }
    AREAS {
        uuid id PK
        varchar code UK
        varchar name
        boolean can_access_cashier
        boolean is_active
    }
    JOB_TITLES {
        uuid id PK
        varchar code UK
        varchar name
        boolean is_active
    }
    POSITIONS {
        uuid id PK
        varchar code UK
        uuid area_id FK
        uuid job_title_id FK
        uuid default_role_id FK
    }
    EMPLOYEES {
        uuid id PK
        varchar employee_number UK
        varchar first_name
        varchar last_name
        date hire_date
        uuid position_id FK
        varchar pin_code
        boolean is_active
    }
    SYSTEM_USERS {
        uuid id PK
        varchar employee_number UK
        varchar username UK
        varchar password_hash
        uuid role_id FK
        boolean is_active
    }
    SHIFT_CATALOG {
        uuid id PK
        varchar code UK
        varchar name
        time start_time
        time end_time
        boolean is_active
    }
    ATTENDANCE_RECORDS {
        uuid id PK
        varchar employee_number FK
        date work_date
        timestamptz check_in_at
        varchar source
    }
    PAYROLL_DEDUCTIONS {
        uuid id PK
        varchar employee_number FK
        date deduction_date
        varchar deduction_type
        text motivo
        varchar applied_by
    }
    RESTAURANT_ZONES {
        uuid id PK
        varchar code UK
        varchar name
        boolean is_active
    }
    RESTAURANT_TABLES {
        uuid id PK
        varchar code UK
        uuid zone_id FK
        int capacity
        boolean is_active
    }
    MENU_CATEGORIES {
        uuid id PK
        varchar code UK
        varchar name
        boolean route_to_kds
        boolean is_active
    }
    MENU_DISHES {
        uuid id PK
        varchar code UK
        uuid category_id FK
        varchar name
        decimal price
        boolean has_recipe
        boolean can_pickup
        boolean is_active
    }
    INVENTORY_ITEMS {
        uuid id PK
        varchar code UK
        varchar name
        varchar unit_measure
        varchar recipe_unit
        decimal conversion_factor
        decimal current_stock
        decimal minimum_stock
    }
    DISH_RECIPES {
        uuid id PK
        uuid dish_id FK
        uuid item_id FK
        decimal quantity_required
    }
    SUPPLIERS {
        uuid id PK
        varchar code UK
        varchar name
        text contact_info
        boolean is_active
    }
    SUPPLIER_PRICES {
        uuid id PK
        uuid supplier_id FK
        uuid item_id FK
        decimal price
        int lead_time_days
    }
    INVENTORY_LOCATIONS {
        uuid id PK
        varchar code UK
        varchar name
        varchar type
    }
    INVENTORY_STOCK_LOCATIONS {
        uuid item_id FK
        uuid location_id FK
        decimal stock
    }
    INVENTORY_KARDEX {
        uuid id PK
        uuid item_id FK
        uuid from_location_id FK
        uuid to_location_id FK
        varchar transaction_type
        decimal quantity
        varchar reference_id
        timestamptz date
    }
    PURCHASE_ORDERS {
        uuid id PK
        uuid supplier_id FK
        varchar status
        decimal total_amount
        timestamptz generated_at
    }
    PURCHASE_ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid item_id FK
        decimal qty_suggested
        decimal unit_price
        int lead_time_days
    }
    ORDER_HEADERS {
        uuid id PK
        varchar code UK
        uuid table_id FK
        uuid waiter_id FK
        int diners
        varchar status
        decimal total
        timestamptz created_at
        timestamptz updated_at
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid dish_id FK
        int quantity
        decimal unit_price
        decimal subtotal
        varchar status
        text notes
        timestamptz started_at
    }
    PAYMENTS {
        uuid id PK
        uuid order_id FK
        varchar method
        decimal amount
        decimal tip
        uuid cashier_id FK
        timestamptz created_at
    }
    TICKETS {
        uuid id PK
        varchar folio UK
        uuid order_id FK
        decimal subtotal
        decimal tax
        decimal tip_total
        decimal total
        boolean is_invoiced
        jsonb invoice_data
    }
    WAITER_CALLS {
        uuid id PK
        uuid table_id FK
        varchar reason
        varchar status
        timestamptz created_at
    }

    AREAS ||--|{ POSITIONS : "define"
    JOB_TITLES ||--|{ POSITIONS : "define"
    ROLES ||--o{ POSITIONS : "rol por defecto"
    POSITIONS ||--|{ EMPLOYEES : "ocupa"
    ROLES ||--o{ SYSTEM_USERS : "tiene"
    EMPLOYEES ||--o{ SYSTEM_USERS : "acceso al sistema"
    EMPLOYEES ||--o{ ATTENDANCE_RECORDS : "registra asistencia"
    EMPLOYEES ||--o{ PAYROLL_DEDUCTIONS : "tiene descuentos"

    RESTAURANT_ZONES ||--|{ RESTAURANT_TABLES : "contiene"

    MENU_CATEGORIES ||--|{ MENU_DISHES : "agrupa"
    MENU_DISHES ||--o{ DISH_RECIPES : "tiene receta"
    INVENTORY_ITEMS ||--o{ DISH_RECIPES : "ingrediente en"

    SUPPLIERS ||--|{ SUPPLIER_PRICES : "tiene precios"
    INVENTORY_ITEMS ||--|{ SUPPLIER_PRICES : "precio de"
    INVENTORY_ITEMS ||--o{ INVENTORY_STOCK_LOCATIONS : "stock en"
    INVENTORY_LOCATIONS ||--o{ INVENTORY_STOCK_LOCATIONS : "alberga"
    INVENTORY_ITEMS ||--|{ INVENTORY_KARDEX : "movimiento de"
    INVENTORY_LOCATIONS ||--o{ INVENTORY_KARDEX : "origen"
    INVENTORY_LOCATIONS ||--o{ INVENTORY_KARDEX : "destino"

    SUPPLIERS ||--o{ PURCHASE_ORDERS : "recibe pedido"
    PURCHASE_ORDERS ||--|{ PURCHASE_ORDER_ITEMS : "contiene"
    INVENTORY_ITEMS ||--|{ PURCHASE_ORDER_ITEMS : "es solicitado"

    RESTAURANT_TABLES ||--o{ ORDER_HEADERS : "tiene orden"
    EMPLOYEES ||--o{ ORDER_HEADERS : "atiende"
    ORDER_HEADERS ||--|{ ORDER_ITEMS : "contiene"
    MENU_DISHES ||--|{ ORDER_ITEMS : "es ordenado en"
    ORDER_HEADERS ||--|{ PAYMENTS : "se paga con"
    EMPLOYEES ||--o{ PAYMENTS : "recibe cajero"
    ORDER_HEADERS ||--|| TICKETS : "genera"

    RESTAURANT_TABLES ||--o{ WAITER_CALLS : "genera llamada"