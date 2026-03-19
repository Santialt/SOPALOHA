const { getHealthSnapshot } = require("../db/health");

function health(req, res) {
  const snapshot = getHealthSnapshot();
  const statusCode = snapshot.status === "error" ? 500 : 200;
  res.status(statusCode).json(snapshot);
}

module.exports = { health };
