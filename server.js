const express = require('express');
const bodyParser = require('body-parser')
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3090;
let sockets = [];

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ type: 'application/json' }))

app.use((req, res, next) => {
  console.log(`${req.method}:${req.url}`);
  next();
})

app.post('/bar/all', (req, res) => {
  res.sendStatus(200);
})

app.post('/bar/update', (req, res) => {
  res.sendStatus(200);
})

app.post('/bar/delete', (req, res) => {
  res.sendStatus(200);
})

app.post('/calendar', (req, res) => {
  res.sendStatus(200);
})

app.get('/calendar', (req, res) => {
  res.sendStatus(200);
})

const server = require('http').Server(app);
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  console.log(`connect ${socket.id}`);
  sockets.push(socket);
  socket.on('disconnect', () => {
    console.log(`disconnect ${socket.id}`);
    sockets = sockets.filter( sock => sock.id != socket.id );
  })
});

server.listen(PORT, () => {
  console.log(`roulette server listening on port ${PORT}!`)
});
