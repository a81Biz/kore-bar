# HU-04 — Diagrama de Clases: Kore Bar OS
**Evidencia Sprint 1 · Análisis y Diseño · Marzo 2026**

> El sistema sigue una arquitectura de **5 capas** estrictas.
> Cada diagrama cubre un dominio funcional completo mostrando
> las relaciones entre clases a través de las capas.
>
> **Convenciones de notación:**
> `+` público · `-` privado · `#` protegido
> `-->` asociación · `..>` dependencia/uso · `<|--` herencia · `*--` composición

---

## 1. Arquitectura General de Capas

```mermaid
flowchart TB
    subgraph FE["🖥️  FRONTEND  (Vanilla JS + React parcial)"]
        direction LR
        FE_CTRL["Controllers\n(PisoController, MenuController\nEmpleadosController, InventarioController\nTurnosController, CashierController...)"]
        FE_UTIL["Utilities\n(EventBus · ValidatorEngine\nViewManager · HttpClient\nFormEngine · KoreCore)"]
        FE_RULES["Validation Rules\n(PisoValidationRules\nMenuValidationRules\nEmpleadosValidationRules\n SupplierRules · AdjustRules)"]
        FE_CTRL --> FE_UTIL
        FE_CTRL --> FE_RULES
    end

    subgraph WF["⚙️  WORKFLOW ENGINE  (SchemaRouter + ActionRegistry)"]
        WF_SCH["JSON Schemas\n(create-zone · create-employee\nsubmit-order · process-payment...)"]
        WF_REG["Action Registry\n(handler string → function)\n saveZone · saveEmployee\n submitOrder · processPayment..."]
        WF_SCH --> WF_REG
    end

    subgraph SVC["🔧  SERVICE LAYER  (Helpers)"]
        SVC_H["Domain Helpers\n(admin-floor · admin-employee\nadmin-inventory · admin-menu\nkitchen · waiter · cashier\ninventory-transfers · auth)"]
    end

    subgraph REPO["📦  REPOSITORY LAYER  (Models)"]
        REPO_M["Domain Models\n(admin-floor · admin-employee\nadmin-inventory · admin-menu\nadmin-turnos · kitchen\nwaiter · cashier · auth\npublic-menu · inventory-transfers)"]
    end

    subgraph DB["🗄️  DATA LAYER  (PostgreSQL)"]
        DB_FN["Functions fn_*\n(fn_get_user_for_login\nfn_get_user_for_pin\nfn_check_employee_exists\nfn_employee_has_area)"]
        DB_SP["Stored Procedures sp_*\n(sp_upsert_employee · sp_create_zone\nsp_kardex_transfer · sp_pos_submit_order\nsp_cashier_process_payment ...)"]
        DB_VW["Views vw_*\n(vw_directory_employees\nvw_stock_summary · vw_menu_dishes\nvw_cashier_board · vw_attendance_monitor...)"]
        DB_TBL[("Tables\n22 tablas relacionales")]
    end

    FE_CTRL -- "HTTP REST (fetch via HttpClient)" --> WF_SCH
    WF_REG -- "calls handler(state, c)" --> SVC_H
    SVC_H -- "calls model methods" --> REPO_M
    REPO_M -- "executeQuery / executeStoredProcedure" --> DB_FN
    REPO_M --> DB_SP
    REPO_M --> DB_VW
    DB_SP --> DB_TBL
    DB_VW --> DB_TBL
    DB_FN --> DB_TBL
```

---

## 2. Capa de Conexión a Base de Datos (Shared)

> Todas las clases del Repositorio (Models) dependen de esta capa.

```mermaid
classDiagram
    class DBConnection {
        <<utility>>
        +executeQuery(c, sql, params) Promise~Array~
        +executeStoredProcedure(c, spName, params, types) Promise~void~
    }

    class AppError {
        <<utility>>
        +String message
        +Number statusCode
        +Boolean isOperational
        +constructor(message, statusCode)
    }

    note for DBConnection "Todos los Models importan executeQuery\ny executeStoredProcedure desde este módulo.\nActúa como el único punto de acceso a PostgreSQL."
```

---

## 3. Dominio RRHH y Autenticación

```mermaid
classDiagram
    direction TB

    class AuthModel {
        <<repository>>
        +getUserForLogin(c, employeeNumber) Promise~User~
        +getUserForPin(c, employeeNumber, pinCode) Promise~User~
        +employeeHasArea(c, employeeNumber, areaCode) Promise~Boolean~
    }

    class AdminEmployeeModel {
        <<repository>>
        +upsertHrCatalog(c, catalogItem) Promise~void~
        +upsertEmployee(c, emp) Promise~void~
        +checkEmployeeExists(c, employeeNumber) Promise~Employee~
        +getAllEmployees(c) Promise~Array~
        +deactivateEmployee(c, employeeNumber) Promise~void~
        +getAllAreas(c) Promise~Array~
        +getAllJobTitles(c) Promise~Array~
        +insertAreaModel(c, code, name, canAccessCashier) Promise~void~
        +updateAreaModel(c, code, name) Promise~void~
        +deactivateAreaModel(c, code) Promise~void~
        +bulkDeactivateAreasModel(c, codes) Promise~void~
        +insertJobTitleModel(c, code, name) Promise~void~
        +updateJobTitleModel(c, code, name) Promise~void~
        +deactivateJobTitleModel(c, code) Promise~void~
        +bulkDeactivateJobTitlesModel(c, codes) Promise~void~
        +viewDictionaryPositions(c, positionCode) Promise~Array~
    }

    class AdminTurnosModel {
        <<repository>>
        +getShifts(c) Promise~Array~
        +createShift(c, code, name, startTime, endTime) Promise~void~
        +getAttendance(c, filters) Promise~Array~
        +resetPin(c, employeeNumber, newPin) Promise~void~
        +recordAttendance(c, employeeNumber, source) Promise~void~
    }

    class AuthHelper {
        <<service>>
        +loginHandler(state, c) Promise
        +validatePinHandler(state, c) Promise
        -parseExpiryToSeconds(v) Number
        -authError(message, statusCode) Error
    }

    class AdminEmployeeHelper {
        <<service>>
        +syncHrCatalogs(state, c) Promise
        +processHrWebhook(state, c) Promise
        +getEmployees(state, c) Promise
        +validateEmployeeExists(state, c) Promise
        +saveEmployee(state, c) Promise
        +updateEmployee(state, c) Promise
        +deactivateEmployeeData(state, c) Promise
        +bulkSaveEmployees(state, c) Promise
        +getAreas(state, c) Promise
        +createArea(state, c) Promise
        +updateArea(state, c) Promise
        +deactivateArea(state, c) Promise
        +bulkUpdateAreas(state, c) Promise
        +bulkDeactivateAreas(state, c) Promise
        +getJobTitles(state, c) Promise
        +createJobTitle(state, c) Promise
        +updateJobTitle(state, c) Promise
        +deactivateJobTitle(state, c) Promise
        +bulkUpdateJobTitles(state, c) Promise
        +bulkDeactivateJobTitles(state, c) Promise
    }

    class AdminTurnosHelper {
        <<service>>
        +getShifts(state, c) Promise
        +createShift(state, c) Promise
        +getAttendance(state, c) Promise
        +resetEmployeePin(state, c) Promise
    }

    AuthHelper ..> AuthModel : uses
    AdminEmployeeHelper ..> AdminEmployeeModel : uses
    AdminEmployeeHelper ..> AdminTurnosModel : uses recordAttendance
    AdminTurnosHelper ..> AdminTurnosModel : uses

    note for AdminEmployeeHelper "Contiene la lógica de reconciliación MDM:\nbulkSaveEmployees aplica la regla de\nprotección temporal (no sobreescribe\ndatos más recientes de BD)."

    note for AdminTurnosHelper "resetEmployeePin valida PIN de 4–6\ndígitos antes de llamar al SP.\ngetAttendance calcula stats\n(presente/esperado/ausente) en el helper."
```

---

## 4. Dominio Gestión de Piso (Layout)

```mermaid
classDiagram
    direction TB

    class AdminFloorModel {
        <<repository>>
        +createZone(c, code, name) Promise~void~
        +updateZone(c, code, name, isActive) Promise~void~
        +getActiveZones(c) Promise~Array~
        +deleteZoneSmart(c, code) Promise~void~
        +createTable(c, code, zoneCode, capacity) Promise~void~
        +updateTable(c, code, zoneCode, capacity, isActive) Promise~void~
        +getActiveTables(c) Promise~Array~
        +deleteTableSmart(c, id) Promise~void~
        +createAssignmentRange(c, empNum, zoneCode, shift, startDate, endDate) Promise~void~
        +getAssignmentsByDate(c, date) Promise~Array~
        +deleteAssignment(c, id) Promise~void~
    }

    class AdminFloorHelper {
        <<service>>
        +saveZone(state, c) Promise
        +updateZone(state, c) Promise
        +getZones(state, c) Promise
        +deleteZone(state, c) Promise
        +saveTable(state, c) Promise
        +updateTable(state, c) Promise
        +getTables(state, c) Promise
        +deleteTable(state, c) Promise
        +createAssignmentRangeHandler(state, c) Promise
        +getAssignments(state, c) Promise
        +deleteAssignment(state, c) Promise
    }

    AdminFloorHelper ..> AdminFloorModel : uses

    note for AdminFloorModel "createAssignmentRange llama a\nsp_create_assignment_range que itera día a día.\ndeleteZoneSmart / deleteTableSmart\ndelegan la lógica Hard/Soft en el SP."

    note for AdminFloorHelper "createAssignmentRangeHandler\ncalcula la fecha fin según recurrencia\n(DIA/SEMANA/MES) antes de delegar\nal modelo. Traduce errores 23505\na mensajes legibles por el frontend."
```

---

## 5. Dominio Inventario y Proveedores

```mermaid
classDiagram
    direction TB

    class AdminInventoryModel {
        <<repository>>
        +createSupplier(c, code, name, contactInfo) Promise~void~
        +getSuppliers(c) Promise~Array~
        +getSupplierByCode(c, code) Promise~Supplier~
        +upsertSupplierPrice(c, supplierCode, itemCode, itemName, itemUnit, price) Promise~void~
        +syncPurchases(c, payload) Promise~void~
        +getInventoryStock(c, locationCode) Promise~Array~
        +getInventoryItems(c) Promise~Array~
        +getLocations(c) Promise~Array~
        +getKardex(c, locationCode, itemCode) Promise~Array~
        +transferStock(c, itemCode, fromCode, toCode, qty, userId, ref) Promise~void~
        +adjustStock(c, locationCode, itemCode, physicalStock, note) Promise~void~
    }

    class InventoryTransfersModel {
        <<repository>>
        +kardexTransfer(c, itemCode, fromLocation, toLocation, qty, referenceId) Promise~void~
        +syncPurchases(c, payload) Promise~void~
        +kardexAdjustment(c, locationCode, itemCode, realStock, note) Promise~void~
    }

    class AdminInventoryHelper {
        <<service>>
        +getSuppliersHandler(state, c) Promise
        +createSupplier(state, c) Promise
        +getStockHandler(state, c) Promise
        +getKardex(state, c) Promise
        +upsertSupplierPriceHandler(state, c) Promise
        +syncPurchasesHandler(state, c) Promise
        +transferStockHandler(state, c) Promise
    }

    class InventoryTransfersHelper {
        <<service>>
        +saveKardexTransfer(state, c) Promise
        +syncPurchasesToKardex(state, c) Promise
        +saveKardexAdjustment(state, c) Promise
    }

    AdminInventoryHelper ..> AdminInventoryModel : uses
    InventoryTransfersHelper ..> InventoryTransfersModel : uses

    note for InventoryTransfersHelper "saveKardexTransfer itera sobre\nitems[] llamando kardexTransfer()\npor cada elemento (partida doble).\nsaveKardexAdjustment calcula la\ndiferencia Teórico vs. Físico en el SP."

    note for AdminInventoryHelper "getStockHandler extrae\nlocationCode de state.payload.location\n(query param). getKardex permite\nfiltrar por ubicación Y por insumo."
```

---

## 6. Dominio Menú y Cocina

```mermaid
classDiagram
    direction TB

    class AdminMenuModel {
        <<repository>>
        +createCategory(c, code, name, description) Promise~void~
        +updateCategory(c, code, name, description, isActive) Promise~void~
        +getCategories(c) Promise~Array~
        +deleteCategorySmart(c, code) Promise~void~
        +createDish(c, code, catCode, name, desc, price, img) Promise~void~
        +updateDish(c, code, catCode, name, desc, price, img, isActive) Promise~void~
        +getDishes(c) Promise~Array~
        +deleteDishSmart(c, code) Promise~void~
    }

    class KitchenModel {
        <<repository>>
        +getPendingDishes(c) Promise~Array~
        +getFinishedDishes(c) Promise~Array~
        +getIngredients(c) Promise~Array~
        +createIngredient(c, code, name, unit) Promise~void~
        +addRecipeItem(c, dishCode, ingredientCode, quantity) Promise~void~
        +getRecipeBOM(c, dishCode) Promise~Array~
        +getRecipes(c) Promise~Array~
        +updateTechSheet(c, dishCode, preparationMethod, imageUrl) Promise~void~
        +getKitchenBoard(c) Promise~Array~
        +setItemPreparing(c, itemId) Promise~void~
        +setItemReady(c, itemId) Promise~void~
        +getPendingKdsItems(c) Promise~Array~
    }

    class AdminMenuHelper {
        <<service>>
        +createCategoryHandler(state, c) Promise
        +updateCategory(state, c) Promise
        +getCategories(state, c) Promise
        +deleteCategory(state, c) Promise
        +createDishHandler(state, c) Promise
        +updateDishHandler(state, c) Promise
        +getDishes(state, c) Promise
        +deleteDishHandler(state, c) Promise
    }

    class KitchenHelper {
        <<service>>
        +getPendingDishes(state, c) Promise
        +getFinishedDishes(state, c) Promise
        +getIngredientsHandler(state, c) Promise
        +createIngredient(state, c) Promise
        +addRecipeItemHandler(state, c) Promise
        +getRecipeBOM(state, c) Promise
        +getRecipesHandler(state, c) Promise
        +updateTechSheetHandler(state, c) Promise
        +getKitchenBoard(state, c) Promise
        +updateKitchenItemStatus(state, c) Promise
        +setPreparingHandler(state, c) Promise
        +setReadyHandler(state, c) Promise
    }

    AdminMenuHelper ..> AdminMenuModel : uses
    KitchenHelper ..> KitchenModel : uses

    note for KitchenHelper "updateKitchenItemStatus es el handler\nunificado del schema. Internamente llama\na setItemPreparing o setItemReady según\nel status del payload. El SP lanza P0001\nsi la transición de estado es inválida."

    note for KitchenModel "getKitchenBoard devuelve ítems en\nPENDING_KITCHEN y PREPARING con\ncompleto JOIN de mesa, mesero y platillo.\nsetItemPreparing/Ready delegan la\nvalidación de transición al SP."
```

---

## 7. Dominio POS — Meseros y Caja

```mermaid
classDiagram
    direction TB

    class WaiterModel {
        <<repository>>
        +getLayout(c) Promise~Array~
        +validatePin(c, employeeNumber, pin) Promise~Array~
        +getTableByCode(c, tableCode) Promise~Array~
        +getEmployeeByNumber(c, employeeNumber) Promise~Array~
        +getOpenOrder(c, tableId) Promise~Array~
        +insertOrder(c, orderCode, tableId, waiterId, diners) Promise~Array~
        +getOpenOrderByTableCode(c, tableCode) Promise~Array~
        +getOpenOrderWithId(c, tableCode) Promise~Array~
        +submitOrderSP(c, payload) Promise~void~
        +collectItemSP(c, itemId, employeeNumber) Promise~void~
        +deliverItem(c, itemId) Promise~void~
        +setOrderAwaitingPayment(c, orderCode) Promise~void~
        +getOrderItems(c, orderId) Promise~Array~
        +getFloorStock(c) Promise~Array~
        +getWaiters(c) Promise~Array~
    }

    class CashierModel {
        <<repository>>
        +getCashierEmployees(c) Promise~Array~
        +getCashierBoard(c) Promise~Array~
        +getCashierCorte(c) Promise~Array~
        +processPayment(c, payload) Promise~void~
        +markTicketInvoiced(c, folio, invoiceData) Promise~void~
        +getTicketByFolio(c, folio) Promise~Ticket~
        +getLastTicketByTableCode(c, tableCode) Promise~Ticket~
    }

    class PublicMenuModel {
        <<repository>>
        +getMenu() Promise~Array~
        +registerCall(tableCode, reason) Promise~Object~
    }

    class WaiterHelper {
        <<service>>
        +validateWaiterPin(state, c) Promise
        +getWaiterLayout(state, c) Promise
        +openTableHandler(state, c) Promise
        +submitOrderHandler(state, c) Promise
        +closeTableHandler(state, c) Promise
        +waiterCollectItem(state, c) Promise
        +deliverItemHandler(state, c) Promise
        +getWaiterFloorStock(state, c) Promise
        +getWaiterOrderStatus(state, c) Promise
        +getWaiters(state, c) Promise
    }

    class CashierHelper {
        <<service>>
        +getBoard(state, c) Promise
        +getCorte(state, c) Promise
        +getEmployees(state, c) Promise
        +getTicketByFolio(state, c) Promise
        +validateCashierPin(state, c) Promise
        +submitPayment(state, c) Promise
        +requestInvoice(state, c) Promise
    }

    class PublicMenuHelper {
        <<service>>
        +getPublicMenu(state, c) Promise
        +registerWaiterCall(state, c) Promise
    }

    WaiterHelper ..> WaiterModel : uses
    WaiterHelper ..> AdminTurnosModel : uses recordAttendance
    CashierHelper ..> CashierModel : uses
    CashierHelper ..> AuthModel : uses getUserForPin
    CashierHelper ..> AdminTurnosModel : uses recordAttendance
    PublicMenuHelper ..> PublicMenuModel : uses

    note for WaiterHelper "openTableHandler resuelve UUIDs manualmente\n(mesa + empleado) antes de llamar\na insertOrder — patrón granular.\ncloseTableHandler valida que exista\nordenABIERTA antes de poner\nAWAITING_PAYMENT."

    note for CashierHelper "validateCashierPin verifica además\nque canAccessCashier = true.\nsubmitPayment extrae el folio\ndel último ticket tras el SP\n(el SP no devuelve valor de retorno)."
```

---

## 8. Motor de Workflow — Patrón Schema-Driven

```mermaid
classDiagram
    direction TB

    class WorkflowSchema {
        <<json-contract>>
        +String id
        +String name
        +String description
        +ApiDefinition api
        +String startAt
        +Map~String,Node~ nodes
    }

    class ApiDefinition {
        <<value-object>>
        +String method
        +String path
        +String auth
        +BodySchema body
        +Array~String~ tags
    }

    class WorkflowNode {
        <<value-object>>
        +String type
        +String handler
        +String next
        +String onError
    }

    class ActionRegistry {
        <<singleton>>
        +Map~String,Function~ handlers
        +register(name, fn) void
        +get(name) Function
    }

    class SchemaRouter {
        <<orchestrator>>
        -WorkflowSchema schema
        -ActionRegistry registry
        +loadSchemas(directory) void
        +mountRoute(app, schema) void
        +validatePayload(schema, body) Result
        +executeWorkflow(schema, state, c) Promise
    }

    class WorkflowState {
        <<value-object>>
        +Object payload
        +Object params
        +Object data
        +String message
        +Object responseData
    }

    WorkflowSchema *-- ApiDefinition : contains
    WorkflowSchema *-- WorkflowNode : nodes
    SchemaRouter --> WorkflowSchema : reads
    SchemaRouter --> ActionRegistry : calls handler
    SchemaRouter --> WorkflowState : creates and passes
    ActionRegistry --> WorkflowState : reads and writes

    note for SchemaRouter "El SchemaRouter actúa como Gatekeeper:\n1. Lee el schema JSON\n2. Valida el payload (400 si falla)\n3. Crea el state object\n4. Ejecuta el workflow node por node\n5. Responde con el body template."

    note for ActionRegistry "El registro mapea strings del schema\n(ej. 'saveZone') a funciones de helpers\n(ej. adminFloorHelper.saveZone).\nEsto desacopla schemas de la implementación."
```

---

## 9. Diagrama de Secuencia del Workflow Engine

```mermaid
sequenceDiagram
    participant FE as Frontend (HttpClient)
    participant SR as SchemaRouter
    participant GK as Gatekeeper (Validación)
    participant AR as ActionRegistry
    participant HLP as Helper (Service)
    participant MDL as Model (Repository)
    participant DB as PostgreSQL

    FE->>SR: HTTP POST /api/admin/zones {zoneCode, name}
    SR->>GK: validatePayload(schema.api.body, request.body)
    alt Payload inválido
        GK-->>FE: 400 Bad Request {error: "zoneCode required"}
    else Payload válido
        GK-->>SR: OK
        SR->>AR: get("saveZone")
        AR-->>SR: adminFloorHelper.saveZone
        SR->>HLP: saveZone(state, c)
        HLP->>MDL: createZone(c, zoneCode, name)
        MDL->>DB: CALL sp_create_zone(p_code, p_name)
        alt Error 23505 (duplicado)
            DB-->>MDL: PostgreSQL error
            MDL-->>HLP: throw error
            HLP-->>SR: throw AppError("El código ya existe", 400)
            SR-->>FE: 400 {error: "El código ya existe"}
        else Éxito
            DB-->>MDL: void
            MDL-->>HLP: void
            HLP-->>SR: state.message = "Zona creada"
            SR-->>FE: 200 {message: "Zona creada exitosamente"}
        end
    end
```

---

## 10. Frontend — Utilidades Compartidas

```mermaid
classDiagram
    direction TB

    class EventBus {
        <<singleton PubSub>>
        -Map~String,Array~ events
        +subscribe(event, callback) Function
        +publish(event, data) void
    }

    class ValidatorEngine {
        -RulesConfig config
        +constructor(rulesConfig)
        +execute(payload, state) ValidationResult
    }

    class ValidationResult {
        <<value-object>>
        +Boolean isValid
        +String error
        +Array logs
    }

    class ViewManager {
        <<singleton>>
        -HTMLElement root
        +constructor(rootSelector)
        +mount(templateId) HTMLElement
    }

    class TemplateLoader {
        <<static utility>>
        +loadPartials(partialsList, basePath) Promise~void~
    }

    class HttpClient {
        <<static utility>>
        -buildUrl(endpointRaw, params) String
        +fetchData(endpoint, params) Promise
        +postData(endpoint, data, params) Promise
        +putData(endpoint, data, params) Promise
        +deleteData(endpoint, params) Promise
    }

    class FormEngine {
        <<static utility>>
        +bindForm(formId, submitCallback) void
        -applyPostSubmitRules(formId, form) void
    }

    class KoreCore {
        <<singleton>>
        +setupLogger() void
        +boot() void
        +renderOffline(host) void
    }

    class KoreConfig {
        <<configuration>>
        +String BASE_DOMAIN
        +String ENV
        +Boolean DEBUG
        +Object API
        +Object SITES
        +Object DOM
    }

    class UIRules {
        <<static config>>
        +Map~String,Object~ rules
    }

    ValidatorEngine --> ValidationResult : returns
    FormEngine ..> UIRules : reads preserveFields
    HttpClient ..> KoreConfig : reads API.BASE_URL
    KoreCore ..> KoreConfig : reads SITES and DOM
    FormEngine ..> UIModule : calls showErrorModal

    note for EventBus "Bus de eventos síncrono en memoria.\nSubscribe devuelve función de\ndesubscripción. Los eventos mueren\nal hacer viewManager.mount() (nuevo innerHTML)."

    note for HttpClient "buildUrl reemplaza tokens :param\nde forma automática. Todos los\ncontroladores usan ENDPOINTS constants\n— PROHIBIDO hacer fetch() directo."
```

---

## 11. Frontend — Utilidades de UI

```mermaid
classDiagram
    class UIModule {
        <<static utility>>
        +showErrorModal(message, title) void
        +showSuccessModal(message, title) void
        +confirmAction(message) Promise~Boolean~
        +setFieldError(inputId, hasError) void
    }

    class Utils {
        <<static utility>>
        +formatCurrency(amount) String
        +compressImageToWebP(file, maxWidth, quality) Promise~String~
    }

    class ValidationConstants {
        <<constants>>
        +PRIORITIES_CRITICAL = 1000
        +PRIORITIES_HIGH = 800
        +PRIORITIES_MEDIUM = 500
        +PRIORITIES_LOW = 200
    }
```

---

## 12. Frontend — Reglas de Validación

```mermaid
classDiagram
    direction TB

    class ValidatorEngine {
        -RulesConfig config
        +execute(payload, state) ValidationResult
    }

    class PisoValidationRules {
        <<rules-config>>
        +String context = "GestionPiso"
        +Array order
        +formatoMesa(payload) Result
        +mesaDuplicada(payload, state) Result
        +fechaPasada(payload) Result
        +colisionTurnos(payload, state) Result
    }

    class MenuValidationRules {
        <<rules-config>>
        +String context = "GestionMenu"
        +Array order
        +formatoCodigo(payload) Result
        +precioPlatillo(payload) Result
        +codigoDuplicado(payload, state) Result
    }

    class EmpleadosValidationRules {
        <<rules-config>>
        +String context = "GestionEmpleados"
        +Array order
        +urlSyncValida(payload) Result
        +integridadDatosHR(payload) Result
        +datosEdicionCompletos(payload) Result
    }

    class SupplierRules {
        <<rules-config>>
        +String context = "Alta de Proveedores"
        +code(payload) Result
        +name(payload) Result
    }

    class AdjustRules {
        <<rules-config>>
        +String context = "Ajuste de Inventario"
        +transactionType(payload) Result
        +quantity(payload) Result
        +reference(payload) Result
    }

    class SupplierPriceRules {
        <<rules-config>>
        +String context = "Vinculación de Costo"
        +itemCode(payload) Result
        +itemName(payload) Result
        +price(payload) Result
    }

    ValidatorEngine --> PisoValidationRules : configured with
    ValidatorEngine --> MenuValidationRules : configured with
    ValidatorEngine --> EmpleadosValidationRules : configured with
    ValidatorEngine --> SupplierRules : configured with
    ValidatorEngine --> AdjustRules : configured with
    ValidatorEngine --> SupplierPriceRules : configured with

    note for PisoValidationRules "colisionTurnos: verifica contra\nassignments[] en memoria\nANTES del HTTP — respuesta instantánea.\nfechaPasada: compara con new Date()\nnormalizado a 00:00 local."

    note for EmpleadosValidationRules "integridadDatosHR filtra los\nregistros EMP-06 (sin ID o sin nombre)\nantes de que lleguen al MDMEngine.\nEsto protege el ciclo de reconciliación."
```

---

## 13. Frontend — Controladores Admin

```mermaid
classDiagram
    direction TB

    class SidebarController {
        <<controller>>
        -Dom _dom
        +mount(container) void
        -_cacheDOM(container) void
        -_bindEvents() void
        -_render_setActiveState(viewName) void
    }

    class DashboardController {
        <<controller>>
        +mount(container) Promise~void~
        -_cacheDOM(container) void
        -_bindEvents() void
        -_logic_loadData() Promise~void~
    }

    class PisoController {
        <<orchestrator>>
        +mount(container) Promise~void~
        -_iniciarReloj(container) void
    }

    class ZonasController {
        <<controller>>
        +mount(container) Promise~void~
        +getZonas() Array
        -logic_cargarDatos() Promise~void~
        -logic_crearZona() Promise~void~
        -logic_eliminarZona(code, name) Promise~void~
        -render_lista() void
        -render_cacheDOM(container) void
    }

    class MesasController {
        <<controller>>
        +mount(container) Promise~void~
        +actualizarZonas(zonas) void
        -logic_cargarMesas() Promise~void~
        -logic_crearMesa() Promise~void~
        -logic_eliminarMesa(tableId) Promise~void~
        -render_selectZonas() void
        -render_mesas() void
    }

    class AsignacionesController {
        <<controller>>
        +mount(container) Promise~void~
        +actualizarZonas(zonas) void
        +actualizarMesas(mesas) void
        -logic_cargarCatalogos() Promise~void~
        -logic_cargarAsignaciones() Promise~void~
        -logic_crearAsignacion() Promise~void~
        -logic_eliminarAsignacion(id) Promise~void~
        -render_selectMeserosPorPuesto() void
        -render_listasYResumen() void
    }

    class EmpleadosController {
        <<orchestrator>>
        +mount(container) Promise~void~
    }

    class EmpleadosLogic {
        <<service>>
        +loadAll() Promise~void~
        +syncHR() Promise~void~
        +prepararEdicion(employeeId) void
        +guardarEdicion() Promise~void~
        +guardarTodosPendientes() Promise~void~
    }

    class EmpleadosState {
        <<state>>
        +Array empleados
        +Object puestosCatalog
        +Object syncStats
        +Object dom
        +ValidatorEngine motorValidacion
        +Object uiConfig
    }

    class MDMEngine {
        <<strategy>>
        -Map DECISION_MATRIX
        +evaluate(hrEmp, dbEmp) Decision
    }

    class MenuController {
        <<orchestrator>>
        +mount(container) Promise~void~
    }

    class CategoriasController {
        <<controller>>
        +mount(container) Promise~void~
        -logic_cargarCategorias() Promise~void~
        -logic_crearCategoria() Promise~void~
        -logic_eliminarCategoria(code) Promise~void~
    }

    class PlatillosController {
        <<controller>>
        +mount(container) Promise~void~
        +actualizarCategorias() Promise~void~
        -logic_cargarPlatillos() Promise~void~
        -logic_crearPlatillo() Promise~void~
        -logic_iniciarRevisionComercial(code) Promise~void~
        -logic_guardarRevisionComercial() Promise~void~
    }

    class InventarioController {
        <<orchestrator>>
        +mount(container) Promise~void~
    }

    class TurnosController {
        <<orchestrator>>
        +mount(container) Promise~void~
        -logic_loadMonitor() Promise~void~
        -logic_loadHistorial() Promise~void~
        -logic_loadShifts() Promise~void~
        -logic_createShift() Promise~void~
        -logic_resetPin() Promise~void~
    }

    PisoController *-- ZonasController : mounts
    PisoController *-- MesasController : mounts
    PisoController *-- AsignacionesController : mounts
    PisoController ..> EventBus : subscribes ZONAS_ACTUALIZADAS
    PisoController ..> EventBus : subscribes MESAS_ACTUALIZADAS

    MenuController *-- CategoriasController : mounts
    MenuController *-- PlatillosController : mounts
    MenuController ..> EventBus : subscribes CATEGORIAS_ACTUALIZADAS

    EmpleadosController *-- EmpleadosLogic : uses
    EmpleadosController *-- EmpleadosState : uses
    EmpleadosLogic ..> MDMEngine : evaluate(hrEmp, dbEmp)

    ZonasController ..> EventBus : publishes ZONAS_ACTUALIZADAS
    MesasController ..> EventBus : publishes MESAS_ACTUALIZADAS
    CategoriasController ..> EventBus : publishes CATEGORIAS_ACTUALIZADAS

    ZonasController ..> HttpClient : fetchData postData deleteData
    MesasController ..> HttpClient : fetchData postData deleteData
    AsignacionesController ..> HttpClient : fetchData postData deleteData
    CategoriasController ..> HttpClient : fetchData postData deleteData
    PlatillosController ..> HttpClient : fetchData postData putData deleteData

    note for MDMEngine "Matriz de 14 casuísticas.\nLlave: ACCION_HR|ESTADO_BD|FECHA\nEj. ALTA|ACTIVO|NEWER → UPDATE\nEj. BAJA|NULL|ANY → REJECT"

    note for PisoController "Orquestador puro — no tiene lógica\nde negocio propia. Solo monta los 3\nsub-controladores y conecta sus\neventos PubSub para re-hidratación cruzada."
```

---

## 14. Tabla de Responsabilidades por Clase

| Capa | Clase | Responsabilidad principal | SP / View que invoca |
|---|---|---|---|
| **Repository** | `AdminEmployeeModel` | CRUD empleados + catálogos RRHH | `sp_upsert_employee`, `sp_upsert_hr_catalog`, `vw_directory_employees` |
| **Repository** | `AdminTurnosModel` | Turnos + asistencia + PIN reset | `sp_create_shift`, `sp_record_attendance`, `sp_reset_employee_pin`, `vw_attendance_monitor` |
| **Repository** | `AuthModel` | Login web (bcrypt) + login PIN | `fn_get_user_for_login`, `fn_get_user_for_pin`, `fn_employee_has_area` |
| **Repository** | `AdminFloorModel` | Zonas + Mesas + Asignaciones | `sp_create_zone`, `sp_create_table`, `sp_create_assignment_range` |
| **Repository** | `AdminInventoryModel` | Stock + Kardex + Proveedores | `sp_sync_purchases`, `sp_upsert_supplier_price`, `vw_stock_summary` |
| **Repository** | `InventoryTransfersModel` | Traspasos + Ajustes físicos | `sp_kardex_transfer`, `sp_kardex_adjustment` |
| **Repository** | `AdminMenuModel` | Categorías + Platillos (Admin) | `sp_create_menu_category`, `sp_create_menu_dish`, `vw_menu_dishes` |
| **Repository** | `KitchenModel` | BOM + KDS + Recetario | `sp_add_recipe_item`, `sp_kds_set_preparing`, `sp_kds_set_ready`, `sp_update_tech_sheet` |
| **Repository** | `WaiterModel` | POS Meseros + Layout + Órdenes | `sp_pos_submit_order`, `sp_pos_collect_item`, `sp_pos_deliver_item`, `vw_waiter_floor_layout` |
| **Repository** | `CashierModel` | Cobros + Tickets + Facturación | `sp_cashier_process_payment`, `sp_mark_ticket_invoiced`, `vw_cashier_board` |
| **Repository** | `PublicMenuModel` | Menú QR público + Llamadas mesero | SQL directo `menu_categories` + `waiter_calls` |
| **Service** | `AuthHelper` | Firma JWT (sesión web + PIN) | via `AuthModel` |
| **Service** | `AdminEmployeeHelper` | MDM bulk save + webhook RRHH | via `AdminEmployeeModel` + `AdminTurnosModel` |
| **Service** | `AdminTurnosHelper` | Turnos, asistencia, PIN reset | via `AdminTurnosModel` |
| **Service** | `AdminFloorHelper` | Zonas + Mesas + Recurrencia | via `AdminFloorModel` |
| **Service** | `AdminInventoryHelper` | Stock por ubicación + Kardex | via `AdminInventoryModel` |
| **Service** | `InventoryTransfersHelper` | Traspasos iterativos + Ajuste | via `InventoryTransfersModel` |
| **Service** | `AdminMenuHelper` | Categorías y Platillos Admin | via `AdminMenuModel` |
| **Service** | `KitchenHelper` | BOM Builder + KDS state machine | via `KitchenModel` |
| **Service** | `WaiterHelper` | PIN login + Ciclo de comanda | via `WaiterModel` + `AdminTurnosModel` |
| **Service** | `CashierHelper` | PIN cajero + Pago + CFDI | via `CashierModel` + `AuthModel` + `AdminTurnosModel` |
| **Service** | `PublicMenuHelper` | Menú y llamadas sin auth | via `PublicMenuModel` |
| **Orchestration** | `SchemaRouter` | Gatekeeper + Workflow executor | Lee schemas JSON, llama registry |
| **Orchestration** | `ActionRegistry` | Mapa string→función | Resuelve handlers de schemas |
| **Frontend** | `MDMEngine` | Matriz de decisión RRHH (14 casos) | Pure JS, sin HTTP |
| **Frontend** | `ValidatorEngine` | Pipeline de reglas JS por prioridad | Pure JS, sin HTTP |
| **Frontend** | `EventBus (PubSub)` | Bus de eventos síncrono en memoria | N/A |
| **Frontend** | `ViewManager` | Monta templates en el DOM root | N/A |
| **Frontend** | `HttpClient` | Wrapper fetch con buildUrl | Todos los endpoints |
| **Frontend** | `FormEngine` | Submit handler + UIRules post-reset | Lee `UIRules` |
| **Frontend** | `KoreCore` | Boot por subdominio + Kill switch | Lee `KORE_CONFIG.SITES` |
