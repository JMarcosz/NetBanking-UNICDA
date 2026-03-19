const request = require('supertest');
const app = require('../index');
const { activeSessions } = require('../src/middleware/auth');

// Helper para obtener token
async function getToken(username = 'cliente01', password = 'ClaveSegura123!') {
  const res = await request(app)
    .post('/api/auth/token')
    .send({ username, password, grantType: 'password' });
  return res.body.accessToken;
}

describe('Cuentas Endpoints', () => {
  
  afterEach(() => {
    activeSessions.clear();
  });

  describe('GET /api/cuentas', () => {
    test('debe listar cuentas del cliente autenticado', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/cuentas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach(cuenta => {
        expect(cuenta).toHaveProperty('numeroCuenta');
        expect(cuenta).toHaveProperty('saldoDisponible');
        expect(cuenta.titular.idCliente).toBe('CLI-1001');
      });
    });

    test('debe filtrar cuentas por estado', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/cuentas?estado=ACTIVA')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      res.body.forEach(cuenta => {
        expect(cuenta.estado).toBe('ACTIVA');
      });
    });

    test('debe filtrar cuentas por moneda', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/cuentas?moneda=DOP')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      res.body.forEach(cuenta => {
        expect(cuenta.moneda).toBe('DOP');
      });
    });

    test('debe rechazar sin autenticación', async () => {
      const res = await request(app).get('/api/cuentas');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/cuentas/:numeroCuenta', () => {
    test('debe obtener detalle de cuenta existente', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/cuentas/1001-2345-6789-0001')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.numeroCuenta).toBe('1001-2345-6789-0001');
      expect(res.body).toHaveProperty('saldoDisponible');
      expect(res.body).toHaveProperty('titular');
    });

    test('debe retornar 404 para cuenta inexistente', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/cuentas/9999-9999-9999-9999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.codigo).toBe('CUENTA_NO_ENCONTRADA');
    });
  });
});
