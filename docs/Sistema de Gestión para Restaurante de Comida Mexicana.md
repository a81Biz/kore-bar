# Sistema de Gestión para Restaurante de Comida Mexicana

## Planteamiento del Problema

**Software Innovation** es una empresa nacional de desarrollo de software con más de **10 años de experiencia** en la solución de problemas tecnológicos. A lo largo de su trayectoria se han encargado de implementar software tanto empresarial como para clientes individuales, desarrollando todo tipo de soluciones computacionales.

El **ingeniero Luis García** es el responsable de realizar la **documentación de cada nuevo proyecto** que llega a la empresa para su implementación.

Recientemente, el **licenciado en Gastronomía Heber Sánchez** acudió a la empresa con la necesidad de desarrollar un **software para gestionar su restaurante de comida mexicana**.

El sistema deberá soportar diversas funcionalidades relacionadas con la **administración del restaurante, la atención a clientes, la operación en cocina y la gestión de inventario y proveedores**.

---

# Funcionalidades del Sistema

## 1. Funciones del Administrador (Gerente)

El gerente utiliza el sistema para:

### Configuración semanal del restaurante
- Definir el **número de mesas disponibles**.
- Realizar la **asignación de meseros a las mesas**.
- Registrar:
  - ID del mesero
  - Número de mesa asignada.

### Información de meseros
Los datos de los meseros se obtienen del **subsistema de Recursos Humanos** e incluyen:

- ID
- Apellidos
- Nombre

### Consultas de ventas
El gerente puede generar consultas que incluyan:

- Lista de mesas ordenadas.
- Resumen de ventas por mesa.
- Meseros asignados (nombre y apellidos).
- Filtro por **periodo de tiempo**.

### Gestión de turnos
El restaurante opera con dos turnos:

- **Matutino**
- **Vespertino**

### Control de inasistencias
El gerente puede:

- Registrar **faltas de empleados**.
- Mantener un control para aplicar **descuentos salariales** correspondientes.

### Administración del menú
El gerente también es responsable de:

- Registrar **nuevos platillos** en el sistema.

---

# Interacción con los Comensales

## 2. Presentación de Menús

Los comensales pueden consultar el menú mediante:

- **Código QR disponible en las mesas**

Los meseros utilizan:

- **Tabletas electrónicas**

Cada mesero administra un **grupo de mesas numeradas de 1 a n**.

---

# Gestión de Pedidos

## 3. Recepción de Peticiones

Los meseros registran las solicitudes de los clientes mediante su tableta.

El sistema debe:

- Registrar los **platillos solicitados**
- Calcular la **cuenta según los precios del menú**
- Almacenar la **hora de cada petición**

---

# Operación en Cocina

## 4. Gestión de Solicitudes en Cocina

Las solicitudes se visualizan mediante:

- **Una pizarra interactiva conectada a una PC**

La pizarra muestra:

- Platillos solicitados
- Ordenados por:
  - **Hora**
  - **Mesa**

### Interacción de los cocineros

Los cocineros pueden:

- Marcar los platillos **como listos** al terminar su preparación.

El sistema registra:

- **Hora de finalización de cada platillo**

---

# Entrega de Platillos

## 5. Notificación a Meseros

Cuando un platillo está listo:

- El sistema envía una **notificación a la tableta del mesero**.

El mesero:

1. Recoge el platillo en cocina.
2. Lo entrega al comensal.

### Productos sin elaboración en cocina

Algunos productos no requieren preparación, por ejemplo:

- Bebidas
- Pan
- Algunos postres

Estos son recogidos por el mesero directamente en:

- **Almacén de cocina**
- **Frigoríficos**
- **Cámaras de almacenamiento**

---

# Proceso de Pago

## 6. Cierre de Cuenta

Cuando el comensal solicita su cuenta:

1. El mesero **cierra el pedido** en el sistema.
2. Se **imprime el recibo** mediante una impresora en red.
3. El pago se realiza **en caja**.

### Facturación

Si el cliente requiere factura, se solicitan los siguientes datos:

- RFC
- Código Postal
- Régimen Fiscal
- Uso de CFDI
- Correo electrónico

La factura debe:

- **Desglosar el IVA**, aunque el precio del producto ya lo incluya.

---

# Aprovisionamiento y Proveedores

## 7. Gestión de Proveedores

El **jefe de cocina** es responsable de:

- Gestionar el **aprovisionamiento de alimentos**
- Elaborar pedidos
- Recibir mercancía

### Información de proveedores

La gerencia proporciona datos de los proveedores, que incluyen:

- Datos de contacto
- Alimentos que suministra
- Precio de cada alimento

### Elaboración de pedidos

El jefe de cocina especifica:

- Tipo de alimento
- Número de unidades requeridas

El sistema debe:

1. Buscar **proveedores adecuados** considerando:
   - Precio
   - Tiempo promedio de entrega
2. Generar automáticamente los **pedidos a cada proveedor**.

Los proveedores entregan siempre una **factura** con:

- Cantidades de alimentos comprados.

---

# Control de Inventario

## 8. Consumo de Alimentos

El sistema registra el inventario de alimentos.

Ejemplos de alimentos:

- Carne de ternera
- Sardinas
- Pan
- Refrescos embotellados
- Agua

Se almacena:

- **Número de unidades disponibles**

### Cálculo de consumo diario

Al final de cada día:

El jefe de cocina ejecuta un proceso que:

- Calcula los alimentos consumidos
- Basándose en los **platillos elaborados durante el día**

---

# Infraestructura Tecnológica

Todos los dispositivos del restaurante están conectados mediante:

- **Red local inalámbrica**

### Requisitos de red

- Velocidad recomendada: **200 Mbps**

### Personal del restaurante

**Cocina**
- 5 cocineros (incluyendo al jefe de cocina)

**Meseros**
- 20 meseros

### Turnos

| Turno | Horario |
|------|------|
| Matutino | 07:30 – 15:30 |
| Vespertino | 14:30 – 22:30 |

### Horario del restaurante

**08:00 – 22:00 horas**

---

# Resumen del Sistema

El sistema permitirá gestionar:

- Administración de mesas y meseros
- Consulta de ventas
- Registro de pedidos
- Gestión de cocina
- Notificaciones de platillos
- Cierre de cuentas y facturación
- Gestión de proveedores
- Control de inventario
- Consumo diario de alimentos
- Infraestructura de red para dispositivos del restaurante