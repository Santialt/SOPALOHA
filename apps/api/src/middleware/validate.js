const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && isBlank(value)) {
        errors.push(`Field '${rule.field}' is required`);
        continue;
      }

      if (!isBlank(value) && rule.type === 'integer' && !Number.isInteger(Number(value))) {
        errors.push(`Field '${rule.field}' must be an integer`);
        continue;
      }

      if (!isBlank(value) && rule.pattern && !rule.pattern.test(String(value))) {
        const expected = rule.patternDescription ? ` Expected: ${rule.patternDescription}` : '';
        errors.push(`Field '${rule.field}' has invalid format.${expected}`);
        continue;
      }

      if (!isBlank(value) && rule.allowedValues && !rule.allowedValues.includes(value)) {
        errors.push(
          `Field '${rule.field}' must be one of: ${rule.allowedValues.join(', ')}`
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'date') && !req.body.incident_date) {
      errors.push("Use 'incident_date' (YYYY-MM-DD) instead of 'date' for incidents");
    }

    if (errors.length > 0) {
      return next(httpError(400, errors.join(' | ')));
    }

    return next();
  };
}

module.exports = { validateBody };
