const { httpError } = require('../utils/httpError');

function notFound(req, res, next) {
  next(httpError(404, 'Route not found', { code: 'ROUTE_NOT_FOUND' }));
}

module.exports = { notFound };
