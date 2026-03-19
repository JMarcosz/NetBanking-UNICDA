const path = require('path');
const express = require('express');

/**
 * Configura Swagger UI para servir documentación en /api-docs
 */
function setupSwagger(app) {
  const swaggerUiDistPath = path.dirname(require.resolve('swagger-ui-dist/package.json'));
  const swaggerDocument = require('./swagger.json');

  // Endpoint para obtener la especificación JSON
  app.get('/api-docs/swagger.json', (req, res) => {
    res.json(swaggerDocument);
  });

  // Servir swagger-ui-dist assets
  app.use('/api-docs', express.static(swaggerUiDistPath, { index: false }));

  // Página principal de Swagger UI
  app.get('/api-docs', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Bancaria de Transferencias - Documentación</title>
  <link rel="stylesheet" href="/api-docs/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/swagger-ui-bundle.js"></script>
  <script src="/api-docs/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api-docs/swagger.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      plugins: [
        SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: 'StandaloneLayout'
    });
  </script>
</body>
</html>
    `);
  });
}

module.exports = setupSwagger;
