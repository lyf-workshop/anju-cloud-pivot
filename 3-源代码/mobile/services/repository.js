// An API failure never falls back to local showcase data.
module.exports = require('../config/index').mode === 'showcase'
  ? require('./showcase-repository')
  : require('./api-repository');
