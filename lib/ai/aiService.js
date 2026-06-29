/**
 * Backward-compatible export surface.
 * All modules must use runCompletion() / streamCompletion() from this module (gateway).
 */
module.exports = require('./gateway');
