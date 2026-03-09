const { httpError } = require('../utils/httpError');

function listTeamviewerConnections(req, res, next) {
  next(
    httpError(410, 'TeamViewer connections route is disabled in this build. Use /teamviewer/imported-cases instead.', {
      code: 'FEATURE_DISABLED'
    })
  );
}

module.exports = { listTeamviewerConnections };
