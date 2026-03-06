const express = require('express');
const { health } = require('./controllers/healthController');
const locationRoutes = require('./routes/locationRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const weeklyTaskRoutes = require('./routes/weeklyTaskRoutes');
const locationNoteRoutes = require('./routes/locationNoteRoutes');
const teamviewerConnectionRoutes = require('./routes/teamviewerConnectionRoutes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.get('/health', health);
app.use('/locations', locationRoutes);
app.use('/devices', deviceRoutes);
app.use('/incidents', incidentRoutes);
app.use('/weekly-tasks', weeklyTaskRoutes);
app.use('/location-notes', locationNoteRoutes);
app.use('/teamviewer-connections', teamviewerConnectionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
