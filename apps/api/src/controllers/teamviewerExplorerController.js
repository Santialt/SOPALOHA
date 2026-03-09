const { httpError } = require('../utils/httpError');
const service = require('../services/teamviewerExplorerService');
const { logger } = require('../utils/logger');

async function getExplorer(req, res, next) {
  try {
    const payload = await service.buildExplorerData();
    logger.info('TeamViewer explorer snapshot generated', {
      request_id: req.requestId,
      groups_total: payload.summary.groups_total,
      devices_total: payload.summary.devices_total
    });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getGroup(req, res, next) {
  try {
    const payload = await service.getGroupDetail(req.params.groupId);
    if (!payload.group) {
      return next(httpError(404, 'TeamViewer group not found'));
    }
    logger.info('TeamViewer explorer group requested', {
      request_id: req.requestId,
      group_id: req.params.groupId
    });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getDevice(req, res, next) {
  try {
    const payload = await service.getDeviceDetail(req.params.teamviewerId);
    if (!payload.device) {
      return next(httpError(404, 'TeamViewer device not found'));
    }
    logger.info('TeamViewer explorer device requested', {
      request_id: req.requestId,
      teamviewer_id: req.params.teamviewerId
    });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getExplorer,
  getGroup,
  getDevice
};
