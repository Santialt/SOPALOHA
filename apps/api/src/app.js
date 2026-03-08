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
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

app.get('/health', health);
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
