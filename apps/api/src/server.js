require('./db/initDb');
const app = require('./app');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info('API server started', { port: Number(PORT) });
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', { error });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
});
