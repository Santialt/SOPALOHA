const service = require('../services/teamviewerImportService');

async function getImportPreview(req, res, next) {
  try {
    const preview = await service.buildImportPreview();
    return res.json(preview);
  } catch (error) {
    return next(error);
  }
}

async function postImport(req, res, next) {
  try {
    const result = await service.runImport();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getImportPreview,
  postImport
};
