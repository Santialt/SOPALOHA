const { httpError } = require('../utils/httpError');

function requireFields(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        return next(httpError(400, `Field '${field}' is required`));
      }
    }
    return next();
  };
}

module.exports = { requireFields };
