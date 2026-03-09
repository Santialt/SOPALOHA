const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const { health } = require('./controllers/healthController');
const locationRoutes = require('./routes/locationRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const weeklyTaskRoutes = require('./routes/weeklyTaskRoutes');
const taskRoutes = require('./routes/taskRoutes');
const locationNoteRoutes = require('./routes/locationNoteRoutes');
const teamviewerConnectionRoutes = require('./routes/teamviewerConnectionRoutes');
const teamviewerRoutes = require('./routes/teamviewerRoutes');
const supportActionRoutes = require('./routes/supportActionRoutes');
const onCallShiftRoutes = require('./routes/onCallShiftRoutes');
const onCallTemplateRoutes = require('./routes/onCallTemplateRoutes');
const onCallTechnicianRoutes = require('./routes/onCallTechnicianRoutes');
const {
  corsMiddleware,
  requireInternalAccess,
  setSecurityHeaders
} = require('./middleware/security');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(setSecurityHeaders);
app.use(corsMiddleware());
app.use(express.json({ limit: '250kb' }));

app.get('/health', health);
app.use(requireInternalAccess);
app.use('/locations', locationRoutes);
app.use('/devices', deviceRoutes);
app.use('/incidents', incidentRoutes);
app.use('/weekly-tasks', weeklyTaskRoutes);
app.use('/tasks', taskRoutes);
app.use('/location-notes', locationNoteRoutes);
app.use('/teamviewer-connections', teamviewerConnectionRoutes);
app.use('/teamviewer', teamviewerRoutes);
app.use('/support-actions', supportActionRoutes);
app.use('/on-call-shifts', onCallShiftRoutes);
app.use('/on-call-templates', onCallTemplateRoutes);
app.use('/on-call-technicians', onCallTechnicianRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
