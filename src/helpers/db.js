const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

/**
 * Lee y parsea un archivo JSON de la carpeta data
 * @param {string} filename - Nombre del archivo JSON
 * @returns {Array|Object} Datos parseados
 */
function readData(filename) {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Escribe datos en un archivo JSON de la carpeta data
 * @param {string} filename - Nombre del archivo JSON
 * @param {Array|Object} data - Datos a escribir
 */
function writeData(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readData, writeData };
