// Serverless entry (Vercel). The pages render; live terminals do not (no pty, no WebSocket), so the app runs in preview mode.
const { createApp } = require('../src/server');

const { server } = createApp();
module.exports = (req, res) => server.emit('request', req, res);
