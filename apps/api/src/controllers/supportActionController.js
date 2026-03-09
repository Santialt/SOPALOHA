const { execFile } = require('child_process');
const { promisify } = require('util');
const { httpError } = require('../utils/httpError');
const { isPrivateIpv4 } = require('../middleware/security');
const { logger } = require('../utils/logger');

const execFileAsync = promisify(execFile);
const TEAMVIEWER_OPEN_LOCK_MS = 3000;
const teamviewerOpenLocks = new Map();

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

  if (process.platform !== 'win32') {
    return next(httpError(501, 'Launching TeamViewer is supported only on Windows'));
  }

  const now = Date.now();
  const lastOpenAt = teamviewerOpenLocks.get(teamviewerId) || 0;
  if (now - lastOpenAt < TEAMVIEWER_OPEN_LOCK_MS) {
    logger.info('TeamViewer open throttled', {
      request_id: req.requestId,
      teamviewer_id: teamviewerId
    });
    return res.status(202).json({
      success: true,
      skipped: true,
      method: 'throttled',
      teamviewer_id: teamviewerId
    });
  }

  teamviewerOpenLocks.set(teamviewerId, now);
  logger.info('TeamViewer open requested', {
    request_id: req.requestId,
    teamviewer_id: teamviewerId
  });

  try {
    await execFileAsync('cmd', ['/c', 'start', '', `teamviewer10://control?device=${teamviewerId}`], {
      windowsHide: true
    });
    logger.info('TeamViewer launched via protocol', {
      request_id: req.requestId,
      teamviewer_id: teamviewerId
    });
    return res.json({ success: true, method: 'protocol', teamviewer_id: teamviewerId });
  } catch (protocolError) {
    const fallbackExecutables = [
      'C:\\Program Files\\TeamViewer\\TeamViewer.exe',
      'C:\\Program Files (x86)\\TeamViewer\\TeamViewer.exe'
    ];

    for (const executable of fallbackExecutables) {
      try {
        await execFileAsync(executable, ['-i', teamviewerId], { windowsHide: true });
        logger.info('TeamViewer launched via executable', {
          request_id: req.requestId,
          teamviewer_id: teamviewerId,
          executable
        });
        return res.json({
          success: true,
          method: 'executable',
          executable,
          teamviewer_id: teamviewerId
        });
      } catch (fallbackError) {
        // Try next executable path.
      }
    }

    teamviewerOpenLocks.delete(teamviewerId);
    logger.error('TeamViewer launch failed', {
      request_id: req.requestId,
      teamviewer_id: teamviewerId,
      error: protocolError
    });
    return next(httpError(500, 'Could not launch TeamViewer from this machine', { code: 'TEAMVIEWER_LAUNCH_FAILED' }));
  }
}

module.exports = { pingDevice, openTeamviewer };
