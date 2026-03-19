# Flujo de Autenticación y Roles — API Bancaria de Transferencias

## Diagrama de Flujo de Autenticación

```mermaid
sequenceDiagram
    participant C as Cliente/App
    participant API as API Server
    participant DB as JSON Database

    Note over C,DB: 1. Login - Obtener Tokens
    C->>API: POST /api/auth/token<br/>{"username", "password", "grantType"}
    API->>DB: Buscar usuario en usuarios.json
    alt Credenciales válidas
        DB-->>API: Usuario encontrado
        API->>API: Generar accessToken (15 min)<br/>Generar refreshToken (7 días)
        API->>DB: Registrar evento de auditoría
        API-->>C: 200 OK {accessToken, refreshToken, expiresIn}
    else Credenciales inválidas
        DB-->>API: Usuario no encontrado
        API-->>C: 401 {codigo: "CREDENCIALES_INVALIDAS"}
    end

    Note over C,DB: 2. Usar Token en Requests Protegidos
    C->>API: GET /api/cuentas<br/>Authorization: Bearer {accessToken}
    API->>API: Validar token en sesiones activas
    alt Token válido y no expirado
        API->>API: Verificar rol del usuario
        alt Rol autorizado
            API->>DB: Consultar datos
            DB-->>API: Datos solicitados
            API-->>C: 200 OK {datos}
        else Rol no autorizado
            API-->>C: 403 {codigo: "ACCESO_DENEGADO"}
        end
    else Token inválido o expirado
        API-->>C: 401 {codigo: "TOKEN_INVALIDO"}
    end

    Note over C,DB: 3. Renovar Token Expirado
    C->>API: POST /api/auth/refresh<br/>{"refreshToken"}
    API->>API: Validar refresh token
    alt Refresh token válido
        API->>API: Invalidar accessToken anterior<br/>Generar nuevo accessToken
        API-->>C: 200 OK {nuevo accessToken}
    else Refresh token expirado
        API-->>C: 401 {codigo: "TOKEN_EXPIRADO"}
    end

    Note over C,DB: 4. Cerrar Sesión
    C->>API: POST /api/auth/logout<br/>Authorization: Bearer {accessToken}
    API->>API: Invalidar accessToken + refreshToken
    API-->>C: 204 No Content
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
| `/api/beneficiarios` | GET | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios` | POST | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios/{id}` | PUT | ✅ | ✅ | ✅ | — |
| `/api/beneficiarios/{id}` | DELETE | ✅ | ✅ | ✅ | — |
| `/api/transferencias` | GET | ✅ | ✅ | ✅ | — |
| `/api/transferencias` | POST | ✅ | ✅ | ✅ | — |
| `/api/transferencias/{id}` | GET | ✅ | ✅ | ✅ | — |
| `/api/transferencias/{id}/comprobante` | GET | ✅ | ✅ | ✅ | — |
| `/api/admin/transferencias/sospechosas` | GET | ❌ | ✅ | ✅ | — |
| `/api/admin/transferencias/{id}/revision` | PATCH | ❌ | ✅ | ❌ | — |
| `/api/auditoria/eventos` | GET | ❌ | ❌ | ✅ | — |

### Descripción de Roles

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **CLIENTE** | Usuario bancario regular | Gestión de cuentas propias, beneficiarios y transferencias |
| **ADMIN_BANCO** | Administrador del banco | Todo lo de CLIENTE + revisar y aprobar/rechazar transferencias sospechosas |
| **AUDITOR** | Auditor del sistema | Todo lo de CLIENTE + ver transferencias sospechosas + consultar log de auditoría |
