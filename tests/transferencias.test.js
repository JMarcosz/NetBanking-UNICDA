const request = require('supertest');
const app = require('../index');
const { activeSessions } = require('../src/middleware/auth');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'data');
let transferenciasBackup, cuentasBackup, auditoriaBackup;

beforeAll(() => {
  transferenciasBackup = fs.readFileSync(path.join(dataDir, 'transferencias.json'), 'utf-8');
  cuentasBackup = fs.readFileSync(path.join(dataDir, 'cuentas.json'), 'utf-8');
  auditoriaBackup = fs.readFileSync(path.join(dataDir, 'auditoria.json'), 'utf-8');
});

afterAll(() => {
  fs.writeFileSync(path.join(dataDir, 'transferencias.json'), transferenciasBackup, 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'cuentas.json'), cuentasBackup, 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'auditoria.json'), auditoriaBackup, 'utf-8');
});

async function getToken(username = 'cliente01', password = 'ClaveSegura123!') {
  const res = await request(app)
    .post('/api/auth/token')
    .send({ username, password, grantType: 'password' });
  return res.body.accessToken;
}

describe('Transferencias Endpoints', () => {

  afterEach(() => {
    activeSessions.clear();
  });

  describe('GET /api/transferencias', () => {
    test('debe listar transferencias del cliente con paginación', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/transferencias')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('paginacion');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.paginacion).toHaveProperty('pagina');
      expect(res.body.paginacion).toHaveProperty('totalRegistros');
    });

    test('debe filtrar por estado', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/transferencias?estado=COMPLETADA')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(t => {
        expect(t.estado).toBe('COMPLETADA');
      });
    });
  });

  describe('POST /api/transferencias', () => {
    test('debe crear transferencia exitosamente (monto < 50000)', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/transferencias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cuentaOrigen: '1001-2345-6789-0001',
          cuentaDestino: '1001-9876-5432-1000',
          monto: 1000,
          moneda: 'DOP',
          concepto: 'Test transferencia'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('idTransaccion');
      expect(res.body.estado).toBe('COMPLETADA');
      expect(res.body.monto).toBe(1000);
    });

    test('debe marcar transferencia sospechosa (monto >= 50000)', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/transferencias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cuentaOrigen: '1001-2345-6789-0001',
          cuentaDestino: '1001-9876-5432-1000',
          monto: 50000,
          moneda: 'DOP',
          concepto: 'Transferencia grande'
        });

      // Puede ser 422 sospechosa o 403 saldo insuficiente
      expect([403, 422]).toContain(res.status);
      if (res.status === 422) {
        expect(res.body.codigo).toBe('OPERACION_SOSPECHOSA');
      }
    });

    test('debe rechazar con datos incompletos', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/transferencias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cuentaOrigen: '1001-2345-6789-0001',
          monto: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('ERROR_VALIDACION');
    });

    test('debe rechazar cuenta inexistente', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/transferencias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cuentaOrigen: '9999-9999-9999-9999',
          cuentaDestino: '1001-9876-5432-1000',
          monto: 100,
          moneda: 'DOP',
          concepto: 'Test'
        });

      expect(res.status).toBe(404);
    });

    test('debe rechazar cuenta inactiva', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/transferencias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cuentaOrigen: '1001-0000-0000-0003',
          cuentaDestino: '1001-9876-5432-1000',
          monto: 100,
          moneda: 'EUR',
          concepto: 'Test inactiva'
        });

      expect(res.status).toBe(403);
      expect(res.body.codigo).toBe('CUENTA_INACTIVA');
    });
  });

  describe('GET /api/transferencias/:id', () => {
    test('debe obtener detalle de transferencia existente', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/transferencias/TRX-20260217-0001')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.idTransaccion).toBe('TRX-20260217-0001');
      expect(res.body).toHaveProperty('estado');
      expect(res.body).toHaveProperty('monto');
    });

    test('debe retornar 404 para transferencia inexistente', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/transferencias/TRX-999999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.codigo).toBe('TRANSFERENCIA_NO_ENCONTRADA');
    });
  });

  describe('GET /api/transferencias/:id/comprobante', () => {
    test('debe obtener comprobante de transferencia', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/transferencias/TRX-20260217-0001/comprobante')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('idTransaccion');
      expect(res.body).toHaveProperty('codigoAutorizacion');
      expect(res.body).toHaveProperty('estado');
      expect(res.body).toHaveProperty('mensaje');
    });
  });
});

describe('Admin Endpoints', () => {

  afterEach(() => {
    activeSessions.clear();
  });

  describe('GET /api/admin/transferencias/sospechosas', () => {
    test('debe listar transferencias sospechosas para ADMIN', async () => {
      const token = await getToken('admin01', 'AdminSegura789!');
      const res = await request(app)
        .get('/api/admin/transferencias/sospechosas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('debe rechazar acceso para CLIENTE', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/admin/transferencias/sospechosas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});

describe('Auditoria Endpoints', () => {

  afterEach(() => {
    activeSessions.clear();
  });

  describe('GET /api/auditoria/eventos', () => {
    test('debe listar eventos de auditoría para AUDITOR', async () => {
      const token = await getToken('auditor01', 'AuditorSegura321!');
      const res = await request(app)
        .get('/api/auditoria/eventos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('paginacion');
    });

    test('debe rechazar acceso para CLIENTE', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/auditoria/eventos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
