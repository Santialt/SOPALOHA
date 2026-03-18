const { execFile } = require('child_process');
const { promisify } = require('util');
const { httpError } = require('../utils/httpError');
const { isPrivateIpv4 } = require('../middleware/security');
const { logger } = require('../utils/logger');

const execFileAsync = promisify(execFile);

function isInternalPingTarget(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === 'localhost') {
    return true;
  }

  if (isPrivateIpv4(normalized)) {
    return true;
  }

  return /^[a-z0-9-]+(?:\.(?:local|lan|internal))?$/i.test(normalized);
}

function normalizeTeamviewerId(value) {
  return String(value || '').replace(/\s+/g, '');
}

async function pingDevice(req, res, next) {
  const ipOrHost = String(req.body?.ip || '').trim();

  if (!ipOrHost) {
    return next(httpError(400, "Field 'ip' is required"));
  }

  if (!isInternalPingTarget(ipOrHost)) {
    return next(httpError(400, "Field 'ip' must be a private IPv4 or internal hostname"));
  }

  try {
    const { stdout } = await execFileAsync('ping', ['-n', '2', ipOrHost], {
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    const success = /TTL=/i.test(stdout) && !/100%\s+loss/i.test(stdout);
    return res.json({
      success,
      ip: ipOrHost,
      output: String(stdout).split(/\r?\n/).slice(0, 12).join('\n')
    });
  } catch (error) {
    if (typeof error?.stdout === 'string' && error.stdout.length > 0) {
      const stdout = error.stdout;
      const success = /TTL=/i.test(stdout) && !/100%\s+loss/i.test(stdout);
      return res.json({
        success,
        ip: ipOrHost,
        output: String(stdout).split(/\r?\n/).slice(0, 12).join('\n')
      });
    }

    return next(httpError(500, 'Could not execute ping command'));
  }
}

async function openTeamviewer(req, res, next) {
  const teamviewerId = normalizeTeamviewerId(req.body?.teamviewer_id);

  if (!teamviewerId) {
    return next(httpError(400, "Field 'teamviewer_id' is required"));
  }

  if (!/^\d{6,12}$/.test(teamviewerId)) {
    return next(httpError(400, "Field 'teamviewer_id' must be numeric"));
  }

  const deepLinkUrl = `teamviewer10://control?device=${teamviewerId}`;

  logger.info('TeamViewer launch target requested', {
    request_id: req.requestId,
    teamviewer_id: teamviewerId
  });

  return res.json({
    success: true,
    deprecated_server_launch: true,
    launch_scope: 'client_only',
    teamviewer_id: teamviewerId,
    deep_link_url: deepLinkUrl,
    message:
      'This endpoint does not launch TeamViewer on the server. The client UI must open the deep link locally.'
  });
}

module.exports = { pingDevice, openTeamviewer };
