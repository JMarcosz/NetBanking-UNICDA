const request = require('supertest');
const app = require('../index');
const { activeSessions } = require('../src/middleware/auth');
const { readData, writeData } = require('../src/helpers/db');
const fs = require('fs');
const path = require('path');

// Backup y restore de datos
const dataDir = path.join(__dirname, '..', 'src', 'data');
let beneficiariosBackup;

beforeAll(() => {
  beneficiariosBackup = fs.readFileSync(path.join(dataDir, 'beneficiarios.json'), 'utf-8');
});

afterAll(() => {
  fs.writeFileSync(path.join(dataDir, 'beneficiarios.json'), beneficiariosBackup, 'utf-8');
});

async function getToken(username = 'cliente01', password = 'ClaveSegura123!') {
  const res = await request(app)
    .post('/api/auth/token')
    .send({ username, password, grantType: 'password' });
  return res.body.accessToken;
}

describe('Beneficiarios Endpoints', () => {

  afterEach(() => {
    activeSessions.clear();
  });

  describe('GET /api/beneficiarios', () => {
    test('debe listar beneficiarios del cliente', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/beneficiarios')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach(b => {
        expect(b).toHaveProperty('idBeneficiario');
        expect(b).toHaveProperty('alias');
        expect(b).not.toHaveProperty('idCliente');
      });
    });
  });

  describe('POST /api/beneficiarios', () => {
    test('debe crear un nuevo beneficiario', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/beneficiarios')
        .set('Authorization', `Bearer ${token}`)
        .send({
          alias: 'Tío Test',
          nombreBeneficiario: 'Pedro Test',
          numeroCuenta: '1001-1111-2222-3333',
          banco: 'Banco Test',
          documentoIdentidad: '00100000001'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('idBeneficiario');
      expect(res.body.alias).toBe('Tío Test');
    });

    test('debe rechazar beneficiario duplicado por numeroCuenta', async () => {
      const token = await getToken();
      // Intentar crear uno con numeroCuenta ya existente
      const res = await request(app)
        .post('/api/beneficiarios')
        .set('Authorization', `Bearer ${token}`)
        .send({
          alias: 'Duplicado',
          nombreBeneficiario: 'María Pérez',
          numeroCuenta: '1001-8888-7777-0002',
          banco: 'Banco Demo',
          documentoIdentidad: '00198765432'
        });

      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('ERROR_VALIDACION');
    });

    test('debe rechazar datos incompletos', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/beneficiarios')
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: 'Solo alias' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('ERROR_VALIDACION');
    });
  });

  describe('PUT /api/beneficiarios/:id', () => {
    test('debe actualizar alias de un beneficiario', async () => {
      const token = await getToken();
      const res = await request(app)
        .put('/api/beneficiarios/BEN-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: 'Madre Actualizada' });

      expect(res.status).toBe(200);
      expect(res.body.alias).toBe('Madre Actualizada');
    });

    test('debe retornar 404 para beneficiario inexistente', async () => {
      const token = await getToken();
      const res = await request(app)
        .put('/api/beneficiarios/BEN-999')
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: 'No existe' });

      expect(res.status).toBe(404);
      expect(res.body.codigo).toBe('BENEFICIARIO_NO_ENCONTRADO');
    });
  });

  describe('DELETE /api/beneficiarios/:id', () => {
    test('debe retornar 404 para beneficiario inexistente', async () => {
      const token = await getToken();
      const res = await request(app)
        .delete('/api/beneficiarios/BEN-999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
