function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    code: error.code || null,
    status: Number.isInteger(error.status) ? error.status : null,
    source: error.source || null,
    retryable: typeof error.retryable === 'boolean' ? error.retryable : null,
    stack: error.stack || null
  };
}

function baseLog(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message
  };

  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined) {
      entry[key] = key === 'error' ? serializeError(value) : value;
    }
  }

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const logger = {
  info(message, meta) {
    baseLog('info', message, meta);
  },
  warn(message, meta) {
    baseLog('warn', message, meta);
  },
  error(message, meta) {
    baseLog('error', message, meta);
  }
};

module.exports = { logger };
