var app   = require('express')()
var http  = require('http').Server(app)
var io    = require('socket.io')(http)
var port  = process.env.PORT || 3000

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/public/index.html')
})

io.on('connection', function(socket) {
  // When there new message
  socket.on('newMessage', function(msg) {
    io.emit('newMessage', msg)
    console.log('New chat: ' + msg)
  })

  // When user has been disconnected
  socket.on('disconnect', function(msg) {
    console.log('User disconnected')
  })
})

http.listen(port, function() {
  console.log('Listening on ' + port)
})