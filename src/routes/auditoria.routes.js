const express = require('express');
const { readData } = require('../helpers/db');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/auditoria/eventos - Consultar eventos de auditoría
router.get('/eventos', authMiddleware, requireRole('AUDITOR'), (req, res) => {
  const auditoria = readData('auditoria.json');
  let resultado = [...auditoria];

  // Filtro por usuario
  if (req.query.usuario) {
    resultado = resultado.filter(e => e.usuario === req.query.usuario);
  }

  // Filtro por tipo de evento
  if (req.query.tipoEvento) {
    resultado = resultado.filter(e => e.tipoEvento === req.query.tipoEvento.toUpperCase());
  }

  // Filtro por fechas
  if (req.query.fechaDesde) {
    const desde = new Date(req.query.fechaDesde);
    resultado = resultado.filter(e => new Date(e.fecha) >= desde);
  }
  if (req.query.fechaHasta) {
    const hasta = new Date(req.query.fechaHasta);
    resultado = resultado.filter(e => new Date(e.fecha) <= hasta);
  }

  // Ordenar por fecha descendente
  resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Paginación
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const tamanio = Math.min(100, Math.max(1, parseInt(req.query.tamanio) || 10));
  const totalRegistros = resultado.length;
  const totalPaginas = Math.ceil(totalRegistros / tamanio) || 1;
  const inicio = (pagina - 1) * tamanio;
  const paginado = resultado.slice(inicio, inicio + tamanio);

  res.json({
    data: paginado,
    paginacion: {
      pagina,
      tamanio,
      totalRegistros,
      totalPaginas
    }
  });
});

module.exports = router;
