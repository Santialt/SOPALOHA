const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];
    const allowedFields = new Set(rules.map((rule) => rule.field));

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(httpError(400, 'Request body must be a JSON object'));
    }

    for (const field of Object.keys(req.body)) {
      if (!allowedFields.has(field)) {
        errors.push(`Field '${field}' is not allowed`);
      }
    }

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

      if (!isBlank(value) && rule.type === 'number' && Number.isNaN(Number(value))) {
        errors.push(`Field '${rule.field}' must be a number`);
        continue;
      }

      if (!isBlank(value) && rule.type === 'boolean') {
        const normalized = String(value).toLowerCase();
        const isBooleanLike =
          value === true ||
          value === false ||
          value === 1 ||
          value === 0 ||
          normalized === 'true' ||
          normalized === 'false' ||
          normalized === '1' ||
          normalized === '0';

        if (!isBooleanLike) {
          errors.push(`Field '${rule.field}' must be a boolean`);
          continue;
        }
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
