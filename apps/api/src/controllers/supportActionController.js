const { execFile } = require('child_process');
const { promisify } = require('util');
const { httpError } = require('../utils/httpError');

const execFileAsync = promisify(execFile);
const TEAMVIEWER_OPEN_LOCK_MS = 3000;
const teamviewerOpenLocks = new Map();

function isSafeHost(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9.\-:]+$/.test(value.trim());
}

function normalizeTeamviewerId(value) {
  return String(value || '').replace(/\s+/g, '');
}

async function pingDevice(req, res, next) {
  const ipOrHost = String(req.body?.ip || '').trim();

  if (!ipOrHost) {
    return next(httpError(400, "Field 'ip' is required"));
  }

  if (!isSafeHost(ipOrHost)) {
    return next(httpError(400, "Field 'ip' has invalid characters"));
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
      output: stdout
    });
  } catch (error) {
    if (typeof error?.stdout === 'string' && error.stdout.length > 0) {
      const stdout = error.stdout;
      const success = /TTL=/i.test(stdout) && !/100%\s+loss/i.test(stdout);
      return res.json({
        success,
        ip: ipOrHost,
        output: stdout
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
    console.info(`[SupportAction] TeamViewer open throttled teamviewer_id=${teamviewerId}`);
    return res.status(202).json({
      success: true,
      skipped: true,
      method: 'throttled',
      teamviewer_id: teamviewerId
    });
  }

  teamviewerOpenLocks.set(teamviewerId, now);
  console.info(`[SupportAction] TeamViewer open requested teamviewer_id=${teamviewerId}`);

  try {
    await execFileAsync('cmd', ['/c', 'start', '', `teamviewer10://control?device=${teamviewerId}`], {
      windowsHide: true
    });
    console.info(`[SupportAction] TeamViewer launched via protocol teamviewer_id=${teamviewerId}`);
    return res.json({ success: true, method: 'protocol', teamviewer_id: teamviewerId });
  } catch (protocolError) {
    const fallbackExecutables = [
      'C:\\Program Files\\TeamViewer\\TeamViewer.exe',
      'C:\\Program Files (x86)\\TeamViewer\\TeamViewer.exe'
    ];

    for (const executable of fallbackExecutables) {
      try {
        await execFileAsync(executable, ['-i', teamviewerId], { windowsHide: true });
        console.info(
          `[SupportAction] TeamViewer launched via executable teamviewer_id=${teamviewerId} executable="${executable}"`
        );
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
    console.error(`[SupportAction] TeamViewer launch failed teamviewer_id=${teamviewerId}`);
    return next(httpError(500, 'Could not launch TeamViewer from this machine'));
  }
}

module.exports = { pingDevice, openTeamviewer };
