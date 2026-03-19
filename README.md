# 🏦 API Bancaria de Transferencias

API REST para operaciones bancarias de transferencias, diseñada para fines académicos de Ingeniería de Servicios Web.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Ejecutar tests
npm test
```

- **API:** http://localhost:3000
- **Swagger UI:** http://localhost:3000/api-docs

## 👤 Usuarios de Prueba

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `cliente01` | `ClaveSegura123!` | CLIENTE |
| `cliente02` | `ClaveSegura456!` | CLIENTE |
| `admin01` | `AdminSegura789!` | ADMIN_BANCO |
| `auditor01` | `AuditorSegura321!` | AUDITOR |

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [📘 Documentación de la API](API_DOCUMENTATION.md) | Referencia completa de todos los endpoints, schemas y ejemplos |
| [🔐 Flujo de Autenticación y Roles](explicacion/flujo_autenticacion_y_roles.md) | Diagramas del flujo de auth + tabla de permisos por rol |
| [❌ Catálogo de Errores](explicacion/catalogo_errores.md) | Todos los códigos de error con ejemplos y descripciones |
| [📋 Walkthrough](explicacion/walkthrough.md) | Resumen del proyecto, estructura, pruebas y capturas |

## 🧪 Tests

33 pruebas unitarias con **Jest + Supertest**:

| Suite | Tests | Estado |
|-------|-------|--------|
| auth.test.js | 5 | ✅ |
| cuentas.test.js | 5 | ✅ |
| beneficiarios.test.js | 5 | ✅ |
| transferencias.test.js | 18 | ✅ |

## 🛠️ Stack Tecnológico

- **Runtime:** Node.js
- **Framework:** Express 5
- **Base de datos:** Archivos JSON (simulada)
- **Documentación:** Swagger UI (swagger-ui-dist)
- **Testing:** Jest + Supertest
