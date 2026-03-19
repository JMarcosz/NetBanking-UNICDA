const express = require('express');
const path = require('path');
const requestIdMiddleware = require('./src/middleware/requestId');
const errorHandler = require('./src/middleware/errorHandler');
const setupSwagger = require('./src/swagger');

// Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const clientesRoutes = require('./src/routes/clientes.routes');
const cuentasRoutes = require('./src/routes/cuentas.routes');
const beneficiariosRoutes = require('./src/routes/beneficiarios.routes');
const transferenciasRoutes = require('./src/routes/transferencias.routes');
const adminRoutes = require('./src/routes/admin.routes');
const auditoriaRoutes = require('./src/routes/auditoria.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware global
app.use(express.json());
app.use(requestIdMiddleware);

// CORS básico para pruebas
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configurar Swagger UI
setupSwagger(app);

// Montar rutas
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/beneficiarios', beneficiariosRoutes);
app.use('/api/transferencias', transferenciasRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    nombre: 'API Bancaria de Transferencias',
    version: '1.0.0',
    descripcion: 'API REST para operaciones bancarias de transferencias',
    documentacion: '/api-docs',
    endpoints: {
      autenticacion: '/api/auth',
      clientes: '/api/clientes',
      cuentas: '/api/cuentas',
      beneficiarios: '/api/beneficiarios',
      transferencias: '/api/transferencias',
      administracion: '/api/admin',
      auditoria: '/api/auditoria'
    }
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    codigo: 'RUTA_NO_ENCONTRADA',
    mensaje: `La ruta ${req.method} ${req.originalUrl} no existe`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    requestId: req.requestId
  });
});

// Manejo global de errores
app.use(errorHandler);

// Solo iniciar servidor si no se está ejecutando desde tests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🏦 API Bancaria de Transferencias v1.0.0`);
    console.log(`   Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`   Documentación Swagger: http://localhost:${PORT}/api-docs`);
    console.log(`\n📋 Usuarios de prueba:`);
    console.log(`   cliente01  / ClaveSegura123!   (rol: CLIENTE)`);
    console.log(`   cliente02  / ClaveSegura456!   (rol: CLIENTE)`);
    console.log(`   admin01   / AdminSegura789!   (rol: ADMIN_BANCO)`);
    console.log(`   auditor01 / AuditorSegura321! (rol: AUDITOR)\n`);
  });
}

module.exports = app;
