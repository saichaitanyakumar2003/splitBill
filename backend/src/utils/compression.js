const zlib = require('zlib');

/**
 * Compress data using Brotli
 * @param {Object} data - Data to compress
 * @returns {Buffer} - Compressed buffer
 */
function compressData(data) {
  const json = JSON.stringify(data);
  return zlib.brotliCompressSync(Buffer.from(json), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 6 // Balance between speed and compression
    }
  });
}

/**
 * Decompress Brotli data
 * @param {Buffer} buffer - Compressed buffer
 * @returns {Object} - Decompressed data
 */
function decompressData(buffer) {
  if (!buffer) return {};
  const decompressed = zlib.brotliDecompressSync(buffer);
  return JSON.parse(decompressed.toString());
}

module.exports = { compressData, decompressData };

