const express = require('express');
const bodyParser = require('body-parser')
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3090;
let sockets = [];
let barData = {};
let calendarData = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ type: 'application/json' }))

app.use((req, res, next) => {
  console.log(`${req.method}:${req.url}`);
  console.log(`${JSON.stringify(req.body,null,'  ')}`);
  next();
})

app.post('/bar/all', (req, res) => {
  res.json(Object.keys(barData).map( k => barData[k] ));
})

app.post('/bar/update', (req, res) => {
  req.body.barData.forEach( bar => {
    if (typeof(barData[bar.uuid]) === 'undefined') barData[bar.uuid] = {};
    Object.keys(bar).forEach( k => {
      barData[bar.uuid][k] = bar[k];
    })
  })
  res.sendStatus(200);
})

app.post('/bar/delete', (req, res) => {
  req.body.barData.forEach( bar => {
    delete barData[bar.uuid];
  })
  res.sendStatus(200);
})

app.post('/calendar', (req, res) => {
  calendarData = req.body.calendarData;
  res.sendStatus(200);
})

app.get('/calendar', (req, res) => {
  res.json(calendarData);
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
