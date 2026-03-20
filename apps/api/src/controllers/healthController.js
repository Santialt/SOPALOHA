const { getHealthSnapshot } = require("../db/health");

function liveness(req, res) {
  res.status(200).json({ status: "ok" });
}

function readiness(req, res) {
  const snapshot = getHealthSnapshot();
  const statusCode = snapshot.status === "error" ? 500 : 200;
  res.status(statusCode).json(snapshot);
}

module.exports = { health: { liveness, readiness }, liveness, readiness };
