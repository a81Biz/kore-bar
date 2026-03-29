classDiagram
    class Employee {
        +UUID id
        +String employeeNumber
        +String firstName
        +String lastName
        +Date hireDate
        +UUID positionId
        +String pinCode
        +Boolean isActive
    }

    class Position {
        +UUID id
        +String code
        +UUID areaId
        +UUID jobTitleId
        +UUID defaultRoleId
    }

    class Area {
        +UUID id
        +String code
        +String name
        +Boolean canAccessCashier
        +Boolean isActive
    }

    class RestaurantZone {
        +UUID id
        +String code
        +String name
        +Boolean isActive
    }

    class RestaurantTable {
        +UUID id
        +String code
        +UUID zoneId
        +Int capacity
        +Boolean isActive
    }

    class OrderHeader {
        +UUID id
        +String code
        +UUID tableId
        +UUID waiterId
        +Int diners
        +String status
        +Decimal total
        +Timestamp createdAt
        +openTable()
        +closeTable()
    }

    class OrderItem {
        +UUID id
        +UUID orderId
        +UUID dishId
        +Int quantity
        +Decimal unitPrice
        +Decimal subtotal
        +String status
        +String notes
        +Timestamp startedAt
        +setPrepairing()
        +setReady()
        +collect()
        +deliver()
    }

    class MenuCategory {
        +UUID id
        +String code
        +String name
        +Boolean routeToKds
        +Boolean isActive
    }

    class MenuDish {
        +UUID id
        +String code
        +UUID categoryId
        +String name
        +Decimal price
        +Boolean hasRecipe
        +Boolean canPickup
        +Boolean isActive
    }

    class DishRecipe {
        +UUID dishId
        +UUID itemId
        +Decimal quantityRequired
    }

    class InventoryItem {
        +UUID id
        +String code
        +String name
        +String unitMeasure
        +String recipeUnit
        +Decimal conversionFactor
        +Decimal currentStock
        +Decimal minimumStock
    }

    class Payment {
        +UUID id
        +UUID orderId
        +String method
        +Decimal amount
        +Decimal tip
        +UUID cashierId
    }

    class Ticket {
        +UUID id
        +String folio
        +UUID orderId
        +Decimal subtotal
        +Decimal tax
        +Decimal tipTotal
        +Decimal total
        +Boolean isInvoiced
        +generateFolio()
    }

    class WaiterCall {
        +UUID id
        +UUID tableId
        +String reason
        +String status
        +attend()
        +dismiss()
    }

    Employee "*" --> "1" Position : ocupa
    Position "*" --> "1" Area : pertenece a
    RestaurantTable "*" --> "1" RestaurantZone : pertenece a
    OrderHeader "*" --> "1" RestaurantTable : abierta en
    OrderHeader "*" --> "1" Employee : atendida por
    OrderItem "*" --> "1" OrderHeader : pertenece a
    OrderItem "*" --> "1" MenuDish : ordena
    MenuDish "*" --> "1" MenuCategory : categoría
    DishRecipe "*" --> "1" MenuDish : receta de
    DishRecipe "*" --> "1" InventoryItem : usa ingrediente
    Payment "*" --> "1" OrderHeader : pago de
    Payment "*" --> "1" Employee : recibido por cajero
    Ticket "1" --> "1" OrderHeader : folio de
    WaiterCall "*" --> "1" RestaurantTable : en mesa