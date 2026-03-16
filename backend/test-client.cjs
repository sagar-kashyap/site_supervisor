const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('Connected to server');
});

ws.on('message', (data) => {
    console.log('Received from server:', data.toString());
});

ws.on('close', () => {
    console.log('Disconnected from server');
});

ws.on('error', (err) => {
    console.error('Server connection error:', err);
});
