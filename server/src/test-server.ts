import express from 'express';
import http from 'http';

const app = express();
const server = http.createServer(app);

app.get('/test', (req, res) => {
  res.json({ message: 'Test works!' });
});

server.listen(3002, () => {
  console.log('Test server running on port 3002');
});
