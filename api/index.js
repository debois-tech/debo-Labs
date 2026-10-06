// Serverless entry (Vercel): the pages render, live terminals do not (no pty, no WebSocket), so the app runs in preview mode.
module.exports = require('../src/server');
