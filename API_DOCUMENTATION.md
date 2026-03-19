# API Bancaria de Transferencias — Documentación

> API REST para operaciones bancarias de transferencias. Proyecto académico de Ingeniería de Servicios Web.

**Base URL:** `http://localhost:3000`  
**Documentación Swagger UI:** `http://localhost:3000/api-docs`

---

## Tabla de Contenidos

1. [Autenticación](#1-autenticación)
2. [Clientes](#2-clientes)
3. [Cuentas](#3-cuentas)
4. [Beneficiarios](#4-beneficiarios)
5. [Transferencias](#5-transferencias)
6. [Administración](#6-administración)
7. [Auditoría](#7-auditoría)
8. [Modelos de Datos](#8-modelos-de-datos)
9. [Códigos de Error](#9-códigos-de-error)
10. [Usuarios de Prueba](#10-usuarios-de-prueba)

---

## 1. Autenticación

Todos los endpoints protegidos requieren un header `Authorization: Bearer <accessToken>`.

### POST `/api/auth/token`
Autentica al usuario y genera tokens.

**Seguridad:** Ninguna (endpoint público)

**Request Body:**
```json
{
  "username": "cliente01",
  "password": "ClaveSegura123!",
  "grantType": "password"
}
```

**Response 200:**
```json
{
  "accessToken": "access-xxxxx-1001",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "refresh-xxxxx-1001",
  "refreshExpiresIn": 604800,
  "scope": "transferencias cuentas perfil"
}
```

**Response 401:** Credenciales inválidas

---

### POST `/api/auth/refresh`
Renueva el access token usando un refresh token válido.

**Seguridad:** Ninguna

**Request Body:**
```json
{
  "refreshToken": "refresh-xxxxx-1001"
}
```

**Response 200:** Nuevo `TokenResponse`  
**Response 401:** Refresh token expirado o inválido

---

### POST `/api/auth/logout`
Invalida el refresh token y cierra la sesión.

**Seguridad:** Bearer Token

**Request Body:**
```json
{
  "refreshToken": "refresh-xxxxx-1001"
}
```

**Response 204:** Sesión cerrada

---

## 2. Clientes

### GET `/api/clientes/me`
Obtiene el perfil del usuario autenticado.

**Seguridad:** Bearer Token  
**Roles:** CLIENTE, ADMIN_BANCO, AUDITOR

**Response 200:**
```json
{
  "idCliente": "CLI-1001",
  "nombreCompleto": "Juan Pérez",
  "documentoIdentidad": "00112345678",
  "correo": "juan.perez@correo.com",
  "telefono": "8095551234",
  "estado": "ACTIVO",
  "rol": "CLIENTE"
}
```

---

## 3. Cuentas

### GET `/api/cuentas`
Lista las cuentas del cliente autenticado.

**Seguridad:** Bearer Token

**Query Parameters:**

| Parámetro | Tipo   | Requerido | Descripción                    |
|-----------|--------|-----------|--------------------------------|
| estado    | string | No        | ACTIVA o INACTIVA              |
| moneda    | string | No        | DOP, USD, EUR                  |

**Response 200:** Array de objetos `Cuenta`

---

### GET `/api/cuentas/{numeroCuenta}`
Consulta el detalle de una cuenta.

**Seguridad:** Bearer Token

**Path Parameters:**

| Parámetro      | Tipo   | Descripción                       |
|----------------|--------|-----------------------------------|
| numeroCuenta   | string | Número de cuenta (10-25 chars)    |

**Response 200:** Objeto `Cuenta`  
**Response 404:** Cuenta no encontrada

---

### GET `/api/cuentas/{numeroCuenta}/transferencias`
Consulta el historial de transferencias de una cuenta específica.

**Seguridad:** Bearer Token

**Path Parameters:**

| Parámetro      | Tipo   | Descripción                       |
|----------------|--------|-----------------------------------|
| numeroCuenta   | string | Número de cuenta (10-25 chars)    |

**Query Parameters:**

| Parámetro  | Tipo    | Requerido | Descripción                              |
|------------|---------|-----------|------------------------------------------|
| fechaDesde | date    | No        | Fecha inicial (YYYY-MM-DD)               |
| fechaHasta | date    | No        | Fecha final (YYYY-MM-DD)                 |
| estado     | string  | No        | COMPLETADA, EN_REVISION, RECHAZADA       |
| tipo       | string  | No        | LOCAL o INTERBANCARIA                    |
| pagina     | integer | No        | Número de página (default: 1)            |
| tamanio    | integer | No        | Tamaño de página (1-100, default: 10)    |

**Response 200:**
```json
{
  "numeroCuenta": "1001-2345-6789-0001",
  "data": [
    {
      "idTransaccion": "TRX-20260217-0001",
      "estado": "COMPLETADA",
      "fecha": "2026-02-17T16:30:00Z",
      "monto": 5000,
      "moneda": "DOP",
      "concepto": "Pago factura",
      "cuentaOrigen": "1001-2345-6789-0001",
      "cuentaDestino": "1001-9876-5432-1000"
    }
  ],
  "paginacion": {
    "pagina": 1,
    "tamanio": 10,
    "totalRegistros": 5,
    "totalPaginas": 1
  }
}
```

**Response 403:** La cuenta no pertenece al usuario autenticado  
**Response 404:** Cuenta no encontrada

---

## 4. Beneficiarios

### GET `/api/beneficiarios`
Lista los beneficiarios del cliente autenticado.

**Seguridad:** Bearer Token

**Response 200:** Array de objetos `Beneficiario`

---

### POST `/api/beneficiarios`
Registra un nuevo beneficiario.

**Seguridad:** Bearer Token

**Request Body:**
```json
{
  "alias": "Madre",
  "nombreBeneficiario": "María Pérez",
  "numeroCuenta": "1001-8888-7777-0002",
  "banco": "Banco Demo",
  "documentoIdentidad": "00198765432"
}
```

**Response 201:** Objeto `Beneficiario` creado  
**Response 400:** Error de validación  
**Response 409:** Beneficiario ya existe

---

### PUT `/api/beneficiarios/{idBeneficiario}`
Actualiza datos de un beneficiario.

**Seguridad:** Bearer Token

**Request Body:**
```json
{
  "alias": "Madre Actualizada"
}
```

**Response 200:** Beneficiario actualizado  
**Response 404:** Beneficiario no encontrado

---

### DELETE `/api/beneficiarios/{idBeneficiario}`
Elimina un beneficiario.

**Seguridad:** Bearer Token

**Response 204:** Eliminado exitosamente  
**Response 404:** Beneficiario no encontrado

---

## 5. Transferencias

### GET `/api/transferencias`
Consulta el historial de transferencias con paginación.

**Seguridad:** Bearer Token

**Query Parameters:**

| Parámetro  | Tipo    | Requerido | Descripción                              |
|------------|---------|-----------|------------------------------------------|
| fechaDesde | date    | No        | Fecha inicial (YYYY-MM-DD)               |
| fechaHasta | date    | No        | Fecha final (YYYY-MM-DD)                 |
| estado     | string  | No        | COMPLETADA, EN_REVISION, RECHAZADA       |
| pagina     | integer | No        | Número de página (default: 1)            |
| tamanio    | integer | No        | Tamaño de página (1-100, default: 10)    |

**Response 200:**
```json
{
  "data": [
    {
      "idTransaccion": "TRX-20260217-0001",
      "estado": "COMPLETADA",
      "fecha": "2026-02-17T16:30:00Z",
      "monto": 5000,
      "moneda": "DOP",
      "concepto": "Pago factura",
      "cuentaOrigen": "1001-2345-6789-0001",
      "cuentaDestino": "1001-9876-5432-1000"
    }
  ],
  "paginacion": {
    "pagina": 1,
    "tamanio": 10,
    "totalRegistros": 25,
    "totalPaginas": 3
  }
}
```

---

### POST `/api/transferencias`
Crea una transferencia bancaria.

**Seguridad:** Bearer Token

**Reglas de negocio:**
- La cuenta origen debe pertenecer al usuario autenticado
- Ambas cuentas deben estar **ACTIVAS**
- Saldo disponible debe ser suficiente
- Límite diario: **RD$200,000** (solo DOP)
- Montos ≥ **RD$50,000** son marcados como **sospechosos** (estado EN_REVISION)

**Request Body:**
```json
{
  "cuentaOrigen": "1001-2345-6789-0001",
  "cuentaDestino": "1001-9876-5432-1000",
  "monto": 5000,
  "moneda": "DOP",
  "concepto": "Pago factura",
  "idBeneficiario": "BEN-001"
}
```

**Response 201:** Transferencia creada (COMPLETADA)  
**Response 400:** Error de validación  
**Response 403:** Saldo insuficiente / Límite diario excedido / Cuenta inactiva  
**Response 422:** Operación sospechosa (monto ≥ RD$50,000)

---

### POST `/api/transferencias/interbancaria`
Crea una transferencia interbancaria (a otro banco).

**Seguridad:** Bearer Token

**Reglas de negocio:**
- Mismas reglas que transferencias locales
- Requiere `bancoDestino` y `nombreDestinatario`
- Se cobra una **comisión de RD$75** adicional al monto
- El banco destino debe estar en la lista de bancos disponibles

**Bancos disponibles:**

| Código | Nombre |
|--------|--------|
| BHD | Banco BHD León |
| POPULAR | Banco Popular Dominicano |
| RESERVAS | Banco de Reservas |
| SCOTIABANK | Scotiabank |
| BANRESERVAS | Banreservas |
| DEMO | Banco Demo |

**Request Body:**
```json
{
  "cuentaOrigen": "1001-2345-6789-0001",
  "cuentaDestino": "8800-1234-5678-0001",
  "monto": 5000,
  "moneda": "DOP",
  "concepto": "Pago a proveedor",
  "bancoDestino": "BHD",
  "nombreDestinatario": "Pedro García"
}
```

**Response 201:**
```json
{
  "idTransaccion": "TRX-20260319-0005",
  "tipo": "INTERBANCARIA",
  "estado": "COMPLETADA",
  "fecha": "2026-03-19T18:00:00Z",
  "monto": 5000,
  "comision": 75,
  "montoTotal": 5075,
  "moneda": "DOP",
  "concepto": "Pago a proveedor",
  "cuentaOrigen": "1001-2345-6789-0001",
  "cuentaDestino": "8800-1234-5678-0001",
  "bancoDestino": "Banco BHD León",
  "nombreDestinatario": "Pedro García",
  "referenciaExterna": "REF-BHD-1742421600000"
}
```

**Response 400:** Error de validación  
**Response 403:** Saldo insuficiente / Límite diario excedido / Cuenta inactiva  
**Response 422:** Operación sospechosa (monto ≥ RD$50,000)  
**Response 502:** Banco destino no disponible

---

### GET `/api/transferencias/{idTransaccion}`
Obtiene el detalle de una transferencia.

**Response 200:** Objeto `TransferenciaDetalle`  
**Response 404:** Transferencia no encontrada

---

### GET `/api/transferencias/{idTransaccion}/comprobante`
Obtiene el comprobante de una transferencia.

**Response 200:**
```json
{
  "idTransaccion": "TRX-20260217-0001",
  "codigoAutorizacion": "AUT-998877",
  "fecha": "2026-02-17T16:30:00Z",
  "estado": "COMPLETADA",
  "mensaje": "Transferencia procesada correctamente"
}
```

---

## 6. Administración

### GET `/api/admin/transferencias/sospechosas`
Lista transferencias marcadas como sospechosas.

**Seguridad:** Bearer Token  
**Roles:** ADMIN_BANCO, AUDITOR

**Query Parameters:**

| Parámetro      | Tipo   | Requerido | Descripción                              |
|----------------|--------|-----------|------------------------------------------|
| fechaDesde     | date   | No        | Fecha inicial                            |
| fechaHasta     | date   | No        | Fecha final                              |
| estadoRevision | string | No        | EN_REVISION, APROBADA, RECHAZADA         |

**Response 200:** Array de `TransferenciaDetalle`

---

### PATCH `/api/admin/transferencias/{idTransaccion}/revision`
Aprueba o rechaza una transferencia sospechosa.

**Seguridad:** Bearer Token  
**Roles:** ADMIN_BANCO

**Request Body:**
```json
{
  "accion": "APROBAR",
  "comentario": "Validación manual completada"
}
```

**Response 200:** Transferencia actualizada  
**Response 404:** Transferencia no encontrada

---

## 7. Auditoría

### GET `/api/auditoria/eventos`
Consulta eventos de auditoría del sistema.

**Seguridad:** Bearer Token  
**Roles:** AUDITOR

**Query Parameters:**

| Parámetro  | Tipo      | Requerido | Descripción                    |
|------------|-----------|-----------|--------------------------------|
| usuario    | string    | No        | Filtrar por usuario            |
| tipoEvento | string   | No        | LOGIN, TRANSFERENCIA, ERROR    |
| fechaDesde | date-time | No        | Fecha-hora inicial             |
| fechaHasta | date-time | No        | Fecha-hora final               |
| pagina     | integer   | No        | Número de página               |
| tamanio    | integer   | No        | Tamaño de página (1-100)       |

**Response 200:** Objeto paginado con array de `EventoAuditoria`

---

## 8. Modelos de Datos

### TokenResponse
| Campo            | Tipo    | Descripción                    |
|------------------|---------|--------------------------------|
| accessToken      | string  | Token de acceso                |
| tokenType        | string  | Tipo de token (Bearer)         |
| expiresIn        | integer | Segundos de vigencia (900)     |
| refreshToken     | string  | Token de refresco              |
| refreshExpiresIn | integer | Segundos de vigencia (604800)  |
| scope            | string  | Alcance de permisos            |

### Cliente
| Campo              | Tipo   | Descripción                    |
|--------------------|--------|--------------------------------|
| idCliente          | string | Identificador del cliente      |
| nombreCompleto     | string | Nombre completo                |
| documentoIdentidad | string | Cédula o documento             |
| correo             | string | Correo electrónico             |
| telefono           | string | Teléfono de contacto           |
| estado             | string | ACTIVO / INACTIVO              |
| rol                | string | CLIENTE / ADMIN_BANCO / AUDITOR|

### Cuenta
| Campo           | Tipo    | Descripción                    |
|-----------------|---------|--------------------------------|
| numeroCuenta    | string  | Número de cuenta (10-25 chars) |
| tipoCuenta      | string  | AHORRO / CORRIENTE             |
| moneda          | string  | DOP / USD / EUR                |
| saldoDisponible | number  | Saldo disponible               |
| saldoContable   | number  | Saldo contable                 |
| estado          | string  | ACTIVA / INACTIVA              |
| titular         | object  | { idCliente, nombreCompleto }  |

### Beneficiario
| Campo              | Tipo   | Descripción                    |
|--------------------|--------|--------------------------------|
| idBeneficiario     | string | Identificador del beneficiario |
| alias              | string | Nombre corto/apodo             |
| nombreBeneficiario | string | Nombre completo                |
| numeroCuenta       | string | Cuenta destino                 |
| banco              | string | Nombre del banco               |
| documentoIdentidad | string | Cédula del beneficiario        |

### TransferenciaResponse
| Campo         | Tipo    | Descripción                              |
|---------------|---------|------------------------------------------|
| idTransaccion | string  | ID de la transacción                     |
| estado        | string  | COMPLETADA / EN_REVISION / RECHAZADA     |
| fecha         | string  | Fecha y hora (ISO 8601)                  |
| monto         | number  | Monto transferido                        |
| moneda        | string  | DOP / USD / EUR                          |
| concepto      | string  | Concepto de la transferencia             |
| cuentaOrigen  | string  | Cuenta origen                            |
| cuentaDestino | string  | Cuenta destino                           |

### EventoAuditoria
| Campo       | Tipo   | Descripción                       |
|-------------|--------|-----------------------------------|
| idEvento    | string | Identificador del evento          |
| usuario     | string | Usuario asociado                  |
| tipoEvento  | string | LOGIN / TRANSFERENCIA / ERROR     |
| descripcion | string | Descripción del evento            |
| fecha       | string | Fecha y hora (ISO 8601)           |

### ErrorResponse
| Campo     | Tipo   | Descripción                       |
|-----------|--------|-----------------------------------|
| codigo    | string | Código del error                  |
| mensaje   | string | Descripción del error             |
| detalles  | object | Información adicional (nullable)  |
| timestamp | string | Fecha y hora del error            |
| path      | string | Ruta del endpoint                 |
| requestId | string | ID único de la solicitud          |

---

## 9. Códigos de Error

| Código                     | HTTP | Descripción                                       |
|---------------------------|------|----------------------------------------------------|
| CREDENCIALES_INVALIDAS    | 401  | Usuario o contraseña incorrectos                   |
| TOKEN_EXPIRADO            | 401  | Token de acceso o refresh expirado                 |
| TOKEN_INVALIDO            | 401  | Token proporcionado no es válido                   |
| NO_AUTORIZADO             | 401  | Falta header de autorización                       |
| ACCESO_DENEGADO           | 403  | Rol insuficiente para el recurso                   |
| SALDO_INSUFICIENTE        | 403  | Saldo insuficiente para la transferencia           |
| LIMITE_DIARIO_EXCEDIDO    | 403  | Excede límite diario de RD$200,000                 |
| CUENTA_INACTIVA           | 403  | Cuenta origen o destino inactiva                   |
| ERROR_VALIDACION          | 400  | Datos de entrada inválidos                         |
| CUENTA_NO_ENCONTRADA      | 404  | La cuenta no existe                                |
| BENEFICIARIO_NO_ENCONTRADO| 404  | El beneficiario no existe                          |
| TRANSFERENCIA_NO_ENCONTRADA| 404 | La transferencia no existe                         |
| OPERACION_SOSPECHOSA      | 422  | Transferencia marcada para revisión                |
| BANCO_NO_DISPONIBLE       | 502  | Banco destino no disponible para interbancaria     |
| ERROR_INTERNO             | 500  | Error interno del servidor                         |

---

## 10. Usuarios de Prueba

| Usuario    | Contraseña          | Rol          | ID Cliente |
|------------|---------------------|--------------|------------|
| cliente01  | ClaveSegura123!     | CLIENTE      | CLI-1001   |
| cliente02  | ClaveSegura456!     | CLIENTE      | CLI-1002   |
| admin01    | AdminSegura789!     | ADMIN_BANCO  | CLI-1003   |
| auditor01  | AuditorSegura321!   | AUDITOR      | CLI-1004   |

---

## Cómo Usar

### 1. Obtener Token
```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"cliente01","password":"ClaveSegura123!","grantType":"password"}'
```

### 2. Usar Token en Requests
```bash
curl http://localhost:3000/api/clientes/me \
  -H "Authorization: Bearer <accessToken>"
```

### 3. Hacer una Transferencia Local
```bash
curl -X POST http://localhost:3000/api/transferencias \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"cuentaOrigen":"1001-2345-6789-0001","cuentaDestino":"1001-9876-5432-1000","monto":5000,"moneda":"DOP","concepto":"Pago factura"}'
```

### 4. Hacer una Transferencia Interbancaria
```bash
curl -X POST http://localhost:3000/api/transferencias/interbancaria \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"cuentaOrigen":"1001-2345-6789-0001","cuentaDestino":"8800-1234-5678-0001","monto":5000,"moneda":"DOP","concepto":"Pago proveedor","bancoDestino":"BHD","nombreDestinatario":"Pedro García"}'
```
