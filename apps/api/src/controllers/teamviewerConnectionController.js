function listTeamviewerConnections(req, res) {
  res.status(501).json({
    message: 'TeamViewer connections import/list is not implemented yet in this phase.'
  });
}

module.exports = { listTeamviewerConnections };
