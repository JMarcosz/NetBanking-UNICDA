# Flujo de Autenticación y Roles — API Bancaria de Transferencias

## Diagrama de Flujo de la API

```mermaid
sequenceDiagram
    participant CL as Cliente
    participant AUTH as API<br/>Servicio de Autenticación
    participant ST as Servicio de<br/>Transferencia
    participant CO as Cuenta Origen
    participant CD as Cuenta Destino
    participant SI as Servicio de Transferencia<br/>Interbancaria

    Note over CL,SI: 1. Autenticación

    CL->>AUTH: Iniciar Sesión<br/>POST /api/auth/token
    AUTH->>AUTH: Validar credenciales
    alt Credenciales válidas
        AUTH-->>CL: 200 OK<br/>{accessToken, refreshToken}
    else Credenciales inválidas
        AUTH-->>CL: 401 CREDENCIALES_INVALIDAS
    end

    Note over CL,SI: 2. Transferencia Local (mismo banco)

    CL->>ST: Solicitar transferencia<br/>POST /api/transferencias
    ST->>AUTH: Validar token Bearer
    AUTH-->>ST: Token válido, usuario autenticado

    ST->>CO: Verificar estado y saldo
    CO-->>ST: Cuenta ACTIVA, saldo disponible

    ST->>CD: Verificar estado
    CD-->>ST: Cuenta ACTIVA

    alt Monto >= RD$50,000
        ST-->>CL: 422 OPERACION_SOSPECHOSA<br/>Estado: EN_REVISION
    else Saldo insuficiente
        ST-->>CL: 403 SALDO_INSUFICIENTE
    else Límite diario excedido
        ST-->>CL: 403 LIMITE_DIARIO_EXCEDIDO
    else Transferencia válida
        ST->>CO: Debitar monto
        CO-->>ST: Saldo actualizado
        ST->>CD: Acreditar monto
        CD-->>ST: Saldo actualizado
        ST-->>CL: 201 Transferencia COMPLETADA
    end

    Note over CL,SI: 3. Consultar Histórico por Cuenta

    CL->>ST: Consultar histórico de cuenta<br/>GET /api/cuentas/{numeroCuenta}/transferencias
    ST->>AUTH: Validar token Bearer
    AUTH-->>ST: Token válido, usuario autenticado
    ST->>CO: Verificar titularidad de cuenta
    CO-->>ST: Cuenta pertenece al usuario
    ST->>ST: Filtrar transferencias por cuenta<br/>(origen o destino)
    ST-->>CL: 200 OK Historial paginado

    Note over CL,SI: 4. Transferencia Interbancaria (otro banco)

    CL->>ST: Solicitar transferencia interbancaria<br/>POST /api/transferencias/interbancaria
    ST->>AUTH: Validar token Bearer
    AUTH-->>ST: Token válido, usuario autenticado

    ST->>CO: Verificar estado y saldo
    CO-->>ST: Cuenta ACTIVA, saldo disponible

    ST->>SI: Enviar transferencia al banco destino<br/>{bancoDestino, cuentaDestino, monto}
    SI->>SI: Validar banco destino<br/>Procesar transferencia externa

    alt Banco destino no disponible
        SI-->>ST: Error: Banco no disponible
        ST-->>CL: 502 BANCO_NO_DISPONIBLE
    else Transferencia interbancaria válida
        SI-->>ST: Transferencia aceptada<br/>Código de referencia externo
        ST->>CO: Debitar monto + comisión
        CO-->>ST: Saldo actualizado
        ST-->>CL: 201 Transferencia interbancaria COMPLETADA
    end

    Note over CL,SI: 5. Renovar Token / Cerrar Sesión

    CL->>AUTH: POST /api/auth/refresh
    AUTH-->>CL: Nuevo accessToken

    CL->>AUTH: POST /api/auth/logout
    AUTH-->>CL: 204 Sesión cerrada
```

---

## Diagrama de Arquitectura de Seguridad

```mermaid
flowchart TD
    REQ["Request Entrante"] --> RID["Middleware: requestId<br/>Asigna ID único"]
    RID --> CORS["Middleware: CORS<br/>Headers de acceso"]
    CORS --> ROUTE{"¿Ruta pública?"}

    ROUTE -->|"Sí (login, refresh)"| HANDLER["Handler de Ruta"]
    ROUTE -->|"No (requiere auth)"| AUTH["Middleware: authMiddleware<br/>Valida Bearer Token"]

    AUTH -->|"Token inválido"| E401["401 No Autorizado"]
    AUTH -->|"Token válido"| ROLE{"Middleware: requireRole<br/>¿Rol permitido?"}

    ROLE -->|"Rol no permitido"| E403["403 Acceso Denegado"]
    ROLE -->|"Rol permitido"| HANDLER

    HANDLER --> DB[("JSON Database<br/>archivos .json")]
    HANDLER --> RES["Response al cliente"]

    RES --> ERR{"¿Error?"}
    ERR -->|"Sí"| ERRH["Middleware: errorHandler<br/>Formato ErrorResponse"]
    ERR -->|"No"| OK["✅ Response exitosa"]

    style E401 fill:#e74c3c,color:#fff
    style E403 fill:#e67e22,color:#fff
    style OK fill:#2ecc71,color:#fff
```

---

## Tabla de Roles y Permisos

| Endpoint | Método | CLIENTE | ADMIN_BANCO | AUDITOR | Público |
|----------|--------|:-------:|:-----------:|:-------:|:-------:|
| `/api/auth/token` | POST | — | — | — | ✅ |
| `/api/auth/refresh` | POST | — | — | — | ✅ |
| `/api/auth/logout` | POST | ✅ | ✅ | ✅ | — |
| `/api/clientes/me` | GET | ✅ | ✅ | ✅ | — |
| `/api/cuentas` | GET | ✅ | ✅ | ✅ | — |
| `/api/cuentas/{id}` | GET | ✅ | ✅ | ✅ | — |
| `/api/cuentas/{id}/transferencias` | GET | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios` | GET | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios` | POST | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios/{id}` | PUT | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios/{id}` | DELETE | ✅ | ✅ | ✅ | — |
| `/api/transferencias` | GET | ✅ | ✅ | ✅ | — |
| `/api/transferencias` | POST | ✅ | ✅ | ✅ | — |
| `/api/transferencias/interbancaria` | POST | ✅ | ✅ | ✅ | — |
| `/api/transferencias/{id}` | GET | ✅ | ✅ | ✅ | — |
| `/api/transferencias/{id}/comprobante` | GET | ✅ | ✅ | ✅ | — |
| `/api/admin/transferencias/sospechosas` | GET | ❌ | ✅ | ✅ | — |
| `/api/admin/transferencias/{id}/revision` | PATCH | ❌ | ✅ | ❌ | — |
| `/api/auditoria/eventos` | GET | ❌ | ❌ | ✅ | — |

### Descripción de Roles

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **CLIENTE** | Usuario bancario regular | Gestión de cuentas propias, beneficiarios, transferencias locales e interbancarias |
| **ADMIN_BANCO** | Administrador del banco | Todo lo de CLIENTE + revisar y aprobar/rechazar transferencias sospechosas |
| **AUDITOR** | Auditor del sistema | Todo lo de CLIENTE + ver transferencias sospechosas + consultar log de auditoría |
