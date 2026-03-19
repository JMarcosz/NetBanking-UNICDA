# Catálogo de Errores — API Bancaria de Transferencias

## Estructura de Error

Todas las respuestas de error siguen el schema `ErrorResponse`:

```json
{
  "codigo": "CODIGO_ERROR",
  "mensaje": "Descripción legible del error",
  "detalles": { },
  "timestamp": "2026-02-17T16:35:00Z",
  "path": "/api/endpoint",
  "requestId": "req-000001"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `codigo` | string | Código único identificador del error |
| `mensaje` | string | Mensaje descriptivo en español |
| `detalles` | object \| null | Información adicional según el tipo de error |
| `timestamp` | string (ISO 8601) | Fecha y hora exacta del error |
| `path` | string | Ruta del endpoint que generó el error |
| `requestId` | string | ID único de la solicitud para trazabilidad |

---

## Errores de Autenticación (401)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `CREDENCIALES_INVALIDAS` | Usuario o contraseña incorrectos | Login con username o password incorrecto | `POST /api/auth/token` |
| `TOKEN_INVALIDO` | El token proporcionado es inválido | Bearer token no existe en sesiones activas | Todos los endpoints protegidos |
| `TOKEN_EXPIRADO` | El token ha expirado | Access token superó 15 min o refresh token superó 7 días | Todos los endpoints protegidos / `POST /api/auth/refresh` |
| `NO_AUTORIZADO` | Token de autorización requerido | Falta el header `Authorization: Bearer <token>` | Todos los endpoints protegidos |

### Ejemplo 1 — Credenciales Inválidas
```json
{
  "codigo": "CREDENCIALES_INVALIDAS",
  "mensaje": "Usuario o contraseña incorrectos",
  "timestamp": "2026-02-17T16:00:00Z",
  "path": "/api/auth/token",
  "requestId": "req-000001"
}
```

### Ejemplo 2 — Token Inválido
```json
{
  "codigo": "TOKEN_INVALIDO",
  "mensaje": "El token proporcionado es inválido",
  "timestamp": "2026-02-17T16:05:00Z",
  "path": "/api/cuentas",
  "requestId": "req-000010"
}
```

### Ejemplo 3 — Token Expirado
```json
{
  "codigo": "TOKEN_EXPIRADO",
  "mensaje": "El refresh token ha expirado o fue invalidado",
  "timestamp": "2026-02-17T16:10:00Z",
  "path": "/api/auth/refresh",
  "requestId": "req-000015"
}
```

### Ejemplo 4 — No Autorizado
```json
{
  "codigo": "NO_AUTORIZADO",
  "mensaje": "Token de autorización requerido",
  "timestamp": "2026-02-17T16:12:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000020"
}
```

---

## Errores de Autorización (403)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `ACCESO_DENEGADO` | No tiene permisos suficientes para acceder a este recurso | El rol del usuario no tiene permiso para el endpoint | Endpoints con restricción de rol |
| `SALDO_INSUFICIENTE` | La cuenta no tiene saldo suficiente para realizar la operación | El saldo disponible es menor al monto de la transferencia | `POST /api/transferencias`, `POST /api/transferencias/interbancaria` |
| `LIMITE_DIARIO_EXCEDIDO` | Se ha excedido el límite diario de RD$200,000 para transferencias | Las transferencias del día superan el límite | `POST /api/transferencias`, `POST /api/transferencias/interbancaria` |
| `CUENTA_INACTIVA` | La cuenta origen o destino está inactiva | Una o ambas cuentas tienen estado INACTIVA | `POST /api/transferencias`, `POST /api/transferencias/interbancaria` |

### Ejemplo 5 — Acceso Denegado por Rol
```json
{
  "codigo": "ACCESO_DENEGADO",
  "mensaje": "No tiene permisos suficientes para acceder a este recurso",
  "timestamp": "2026-02-17T16:15:00Z",
  "path": "/api/admin/transferencias/sospechosas",
  "requestId": "req-000030"
}
```

### Ejemplo 6 — Saldo Insuficiente
```json
{
  "codigo": "SALDO_INSUFICIENTE",
  "mensaje": "La cuenta no tiene saldo suficiente para realizar la operación",
  "detalles": {
    "saldoDisponible": 1250,
    "montoSolicitado": 5000,
    "montoFaltante": 3750
  },
  "timestamp": "2026-02-17T16:35:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000123"
}
```

### Ejemplo 7 — Límite Diario Excedido
```json
{
  "codigo": "LIMITE_DIARIO_EXCEDIDO",
  "mensaje": "Se ha excedido el límite diario de RD$200,000 para transferencias",
  "detalles": {
    "limiteDiario": 200000,
    "montoAcumulado": 195000,
    "montoSolicitado": 10000
  },
  "timestamp": "2026-02-17T16:36:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000124"
}
```

### Ejemplo 8 — Cuenta Inactiva
```json
{
  "codigo": "CUENTA_INACTIVA",
  "mensaje": "La cuenta origen o destino está inactiva",
  "timestamp": "2026-02-17T16:37:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000125"
}
```

---

## Errores de Validación (400)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `ERROR_VALIDACION` | Solicitud inválida o error de validación | Campos requeridos faltantes o con formato incorrecto | Todos los endpoints con body |
| `ESTADO_INVALIDO` | Solo se pueden revisar transferencias en estado EN_REVISION | Intentar revisar una transferencia que no está en revisión | `PATCH /api/admin/.../revision` |

### Ejemplo 9 — Validación de Campos
```json
{
  "codigo": "ERROR_VALIDACION",
  "mensaje": "Solicitud inválida o error de validación",
  "detalles": {
    "monto": ["El monto debe ser mayor que 0"],
    "numeroCuenta": ["La longitud debe estar entre 10 y 25 caracteres"],
    "concepto": ["El concepto es requerido"]
  },
  "timestamp": "2026-02-17T16:20:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000050"
}
```

---

## Errores de Recurso No Encontrado (404)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `CUENTA_NO_ENCONTRADA` | La cuenta solicitada no existe | Número de cuenta no existe en la base de datos | `GET /api/cuentas/{numeroCuenta}` |
| `BENEFICIARIO_NO_ENCONTRADO` | No se encontró el beneficiario especificado | ID de beneficiario no existe o no pertenece al cliente | `PUT/DELETE /api/beneficiarios/{id}` |
| `TRANSFERENCIA_NO_ENCONTRADA` | No se encontró la transferencia especificada | ID de transacción no existe | `GET /api/transferencias/{id}` |
| `CLIENTE_NO_ENCONTRADO` | No se encontró el perfil del cliente | El cliente asociado al token no existe en la BD | `GET /api/clientes/me` |
| `RUTA_NO_ENCONTRADA` | La ruta {método} {url} no existe | Endpoint no existe en la API | Cualquier ruta no definida |

### Ejemplo 10 — Cuenta No Encontrada
```json
{
  "codigo": "CUENTA_NO_ENCONTRADA",
  "mensaje": "La cuenta solicitada no existe",
  "timestamp": "2026-02-17T16:39:00Z",
  "path": "/api/cuentas/9999-9999-9999-9999",
  "requestId": "req-000006"
}
```

### Ejemplo 11 — Beneficiario No Encontrado
```json
{
  "codigo": "BENEFICIARIO_NO_ENCONTRADO",
  "mensaje": "No se encontró el beneficiario especificado",
  "timestamp": "2026-02-17T16:39:30Z",
  "path": "/api/beneficiarios/BEN-999",
  "requestId": "req-000008"
}
```

### Ejemplo 12 — Transferencia No Encontrada
```json
{
  "codigo": "TRANSFERENCIA_NO_ENCONTRADA",
  "mensaje": "No se encontró la transferencia especificada",
  "timestamp": "2026-02-17T16:40:00Z",
  "path": "/api/transferencias/TRX-999999",
  "requestId": "req-000007"
}
```

---

## Errores de Conflicto (409)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `ERROR_VALIDACION` | El beneficiario ya está registrado | Se intentó crear un beneficiario con un numeroCuenta ya registrado por el mismo cliente | `POST /api/beneficiarios` |

### Ejemplo 13 — Beneficiario Duplicado
```json
{
  "codigo": "ERROR_VALIDACION",
  "mensaje": "El beneficiario ya está registrado",
  "timestamp": "2026-02-17T16:25:00Z",
  "path": "/api/beneficiarios",
  "requestId": "req-000004"
}
```

---

## Errores de Operación No Procesable (422)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `OPERACION_SOSPECHOSA` | La transferencia ha sido marcada para revisión por sospecha | Monto de transferencia ≥ RD$50,000 | `POST /api/transferencias`, `POST /api/transferencias/interbancaria` |

### Ejemplo 14 — Operación Sospechosa
```json
{
  "codigo": "OPERACION_SOSPECHOSA",
  "mensaje": "La transferencia ha sido marcada para revisión por sospecha",
  "timestamp": "2026-02-17T16:38:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000200"
}
```

> **Nota:** La transferencia SÍ se registra en la base de datos con estado `EN_REVISION`, pero la respuesta HTTP es 422 para informar al cliente que requiere revisión administrativa.

---

## Errores de Servicio No Disponible (502)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `BANCO_NO_DISPONIBLE` | El banco destino no está disponible o no es válido | Se intentó hacer una transferencia interbancaria a un banco no registrado | `POST /api/transferencias/interbancaria` |

### Ejemplo 15 — Banco No Disponible
```json
{
  "codigo": "BANCO_NO_DISPONIBLE",
  "mensaje": "El banco destino 'Banco Ficticio' no está disponible o no es válido",
  "detalles": {
    "bancosDisponibles": [
      { "codigo": "BHD", "nombre": "Banco BHD León" },
      { "codigo": "POPULAR", "nombre": "Banco Popular Dominicano" },
      { "codigo": "RESERVAS", "nombre": "Banco de Reservas" },
      { "codigo": "SCOTIABANK", "nombre": "Scotiabank" },
      { "codigo": "BANRESERVAS", "nombre": "Banreservas" },
      { "codigo": "DEMO", "nombre": "Banco Demo" }
    ]
  },
  "timestamp": "2026-03-19T18:30:00Z",
  "path": "/api/transferencias/interbancaria",
  "requestId": "req-000500"
}
```

---

## Errores Internos del Servidor (500)

| Código | Mensaje | Causa | Endpoint |
|--------|---------|-------|----------|
| `ERROR_INTERNO` | Ha ocurrido un error interno del servidor | Error no controlado en la lógica del servidor | Cualquier endpoint |

### Ejemplo 16 — Error Interno
```json
{
  "codigo": "ERROR_INTERNO",
  "mensaje": "Ha ocurrido un error interno del servidor",
  "detalles": null,
  "timestamp": "2026-02-17T17:00:00Z",
  "path": "/api/transferencias",
  "requestId": "req-000300"
}
```

---

## Resumen Rápido

| HTTP | Código | Descripción Corta |
|------|--------|-------------------|
| 400 | `ERROR_VALIDACION` | Datos de entrada inválidos |
| 400 | `ESTADO_INVALIDO` | Estado no permite la operación |
| 401 | `CREDENCIALES_INVALIDAS` | Login incorrecto |
| 401 | `TOKEN_INVALIDO` | Token no reconocido |
| 401 | `TOKEN_EXPIRADO` | Token venció |
| 401 | `NO_AUTORIZADO` | Falta header Authorization |
| 403 | `ACCESO_DENEGADO` | Rol sin permiso |
| 403 | `SALDO_INSUFICIENTE` | Sin fondos |
| 403 | `LIMITE_DIARIO_EXCEDIDO` | Límite RD$200k superado |
| 403 | `CUENTA_INACTIVA` | Cuenta no activa |
| 404 | `CUENTA_NO_ENCONTRADA` | Cuenta no existe |
| 404 | `BENEFICIARIO_NO_ENCONTRADO` | Beneficiario no existe |
| 404 | `TRANSFERENCIA_NO_ENCONTRADA` | Transferencia no existe |
| 404 | `RUTA_NO_ENCONTRADA` | Endpoint no existe |
| 409 | `ERROR_VALIDACION` | Recurso duplicado |
| 422 | `OPERACION_SOSPECHOSA` | Requiere revisión manual |
| 502 | `BANCO_NO_DISPONIBLE` | Banco destino no disponible |
| 500 | `ERROR_INTERNO` | Error del servidor |
