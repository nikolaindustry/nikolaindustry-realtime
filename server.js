const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { handleConnection } = require('./utils/websocket');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

wss.on('connection', handleConnection);

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
