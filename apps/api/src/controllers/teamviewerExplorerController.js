const { httpError } = require('../utils/httpError');
const service = require('../services/teamviewerExplorerService');

async function getExplorer(req, res, next) {
  try {
    const payload = await service.buildExplorerData();
    console.info(
      `[TeamViewer Explorer] groups=${payload.summary.groups_total} devices=${payload.summary.devices_total}`
    );
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
    console.info(`[TeamViewer Explorer] group requested group_id=${req.params.groupId}`);
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
    console.info(`[TeamViewer Explorer] device requested teamviewer_id=${req.params.teamviewerId}`);
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
