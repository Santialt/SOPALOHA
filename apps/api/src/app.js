const path = require('path');
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}
const express = require('express');
const { health } = require('./controllers/healthController');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const weeklyTaskRoutes = require('./routes/weeklyTaskRoutes');
const taskRoutes = require('./routes/taskRoutes');
const locationNoteRoutes = require('./routes/locationNoteRoutes');
const teamviewerRoutes = require('./routes/teamviewerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const supportActionRoutes = require('./routes/supportActionRoutes');
const onCallShiftRoutes = require('./routes/onCallShiftRoutes');
const onCallTemplateRoutes = require('./routes/onCallTemplateRoutes');
const onCallTechnicianRoutes = require('./routes/onCallTechnicianRoutes');
const {
  corsMiddleware,
  getTrustProxyConfig,
  requireInternalAccess,
  requireApiKey,
  setSecurityHeaders
} = require('./middleware/security');
const { attachAuth, requireAuth } = require('./middleware/auth');
const { requestContext } = require('./middleware/requestContext');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const trustProxyConfig = getTrustProxyConfig();

app.disable('x-powered-by');
app.set('trust proxy', trustProxyConfig.expressValue);
app.use(setSecurityHeaders);
app.use(requestContext);
app.use(corsMiddleware());
app.use(express.json({ limit: '250kb' }));

app.get('/health', health.liveness);
app.get('/health/ready', requireApiKey, health.readiness);
app.use(requireInternalAccess);
app.use(attachAuth);
app.use('/auth', authRoutes);
app.use(requireAuth);
app.use('/users', userRoutes);
app.use('/locations', locationRoutes);
app.use('/devices', deviceRoutes);
app.use('/incidents', incidentRoutes);
app.use('/weekly-tasks', weeklyTaskRoutes);
app.use('/tasks', taskRoutes);
app.use('/location-notes', locationNoteRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/teamviewer', teamviewerRoutes);
app.use('/support-actions', supportActionRoutes);
app.use('/on-call-shifts', onCallShiftRoutes);
app.use('/on-call-templates', onCallTemplateRoutes);
app.use('/on-call-technicians', onCallTechnicianRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
