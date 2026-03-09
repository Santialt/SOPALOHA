function sanitizeDevice(device) {
  if (!device) {
    return device;
  }

  const sanitized = { ...device };
  delete sanitized.password;
  return sanitized;
}

function sanitizeDeviceList(devices) {
  return Array.isArray(devices) ? devices.map(sanitizeDevice) : [];
}

module.exports = { sanitizeDevice, sanitizeDeviceList };
