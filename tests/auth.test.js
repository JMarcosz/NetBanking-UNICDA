const request = require('supertest');
const app = require('../index');
const { activeSessions } = require('../src/middleware/auth');

describe('Auth Endpoints', () => {
  
  afterEach(() => {
    // Limpiar sesiones después de cada test
    activeSessions.clear();
  });

  describe('POST /api/auth/token', () => {
    test('debe autenticar con credenciales válidas', async () => {
      const res = await request(app)
        .post('/api/auth/token')
        .send({
          username: 'cliente01',
          password: 'ClaveSegura123!',
          grantType: 'password'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.expiresIn).toBe(900);
      expect(res.body.scope).toBe('transferencias cuentas perfil');
    });

    test('debe rechazar credenciales inválidas', async () => {
      const res = await request(app)
        .post('/api/auth/token')
        .send({
          username: 'cliente01',
          password: 'ClaveIncorrecta',
          grantType: 'password'
        });

      expect(res.status).toBe(401);
      expect(res.body.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    test('debe rechazar sin username o password', async () => {
      const res = await request(app)
        .post('/api/auth/token')
        .send({ grantType: 'password' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('ERROR_VALIDACION');
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('debe renovar access token con refresh token válido', async () => {
      // Primero login
      const loginRes = await request(app)
        .post('/api/auth/token')
        .send({ username: 'cliente01', password: 'ClaveSegura123!', grantType: 'password' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.accessToken).not.toBe(loginRes.body.accessToken);
    });

    test('debe rechazar refresh token inválido', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-invalido' });

      expect(res.status).toBe(401);
      expect(res.body.codigo).toBe('TOKEN_EXPIRADO');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('debe cerrar sesión exitosamente', async () => {
      const loginRes = await request(app)
        .post('/api/auth/token')
        .send({ username: 'cliente01', password: 'ClaveSegura123!', grantType: 'password' });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(204);
    });
  });
});
