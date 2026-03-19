const express = require('express');
const { login, refresh, logout, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/token - Autenticar usuario
router.post('/token', login);

// POST /api/auth/refresh - Renovar access token
router.post('/refresh', refresh);

// POST /api/auth/logout - Cerrar sesión (requiere autenticación)
router.post('/logout', authMiddleware, logout);

module.exports = router;
