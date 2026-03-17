const app = require("./app");
const { initDatabase } = require("./db/initDb");
const { requireSessionSecret } = require("./utils/authSession");
const { logger } = require("./utils/logger");

function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 3001);
  requireSessionSecret();
  initDatabase();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info("API server started", {
        port: Number(server.address()?.port || port),
      });
      resolve(server);
    });

    server.on("error", reject);
  });
}

if (require.main === module) {
  startServer()
    .then((server) => {
      process.on("unhandledRejection", (error) => {
        logger.error("Unhandled promise rejection", { error });
      });

      process.on("uncaughtException", (error) => {
        logger.error("Uncaught exception", { error });
        server.close(() => process.exit(1));
        setTimeout(() => process.exit(1), 5000).unref();
      });
    })
    .catch((error) => {
      logger.error("API server failed to start", { error });
      process.exit(1);
    });
}

module.exports = { startServer };
