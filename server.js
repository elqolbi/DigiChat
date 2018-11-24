// Connection URL
const url = 'mongodb://digichat:6vAyVHGQAYAgzpyCvCpkFLtlMnDLl87wvYCVOCxPrTDQON5wAWNevWoT2FcgEOXuf3fqQnaI7CuvF8VjbZjpOA==@digichat.documents.azure.com:10255/?ssl=true&replicaSet=globaldb';
const dbName = 'digichat';
const port = process.env.PORT || 3232;

var jwt = require('jsonwebtoken');
var secret = 'asfSFsa@$gsaGSgsg353^#^3637';
var bcrypt = require('bcryptjs');

var app   = require('express')();
var http  = require('http').Server(app);
const bodyParser = require('body-parser');

const mdb = require('mongodb').MongoClient;
// const client = require('socket.io').listen(port).sockets;
const client = require('socket.io')(http);

// Configure bodyparser to handle post requests
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// Connect to MongoDB
mdb.connect(url, { useNewUrlParser: true }, function(err, db) {
  if (err) {
    throw err;
  }

  console.log('Mongo connected');
  let user = db.db(dbName).collection('users');

  // Route
  app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html')
  });
  app.post('/sign', function(data, ress) {
    data = data.body;
    user.find({username: data.username}).toArray(function(err, res) {
      if (err) {
        throw err;
      }

      if (res.length > 0) {
        res = res[0];
        var passwordIsValid = bcrypt.compareSync(data.password, res.password);
        if (!passwordIsValid) {
          return ress.status(400).send(JSON.stringify({success: false, message: 'Username is already exist or password is wrong.'}));
        } else {
          // Create a token
          var token = jwt.sign({ username: data.username }, secret, {
            expiresIn: 86400 // expires in 24 hours
          });

          return ress.status(200).send({success: true, data: {username: data.username, token: token}, exp: 1});
        }
      } else {
        user.insert({username: data.username, password: bcrypt.hashSync(data.password, 8)}, function(err, user) {
          if (err) {
            return ress.status(400).send({success: false, message: 'There was a problem when registering.'});
          } else {
            // Create a token
            var token = jwt.sign({ username: data.username }, secret, {
              expiresIn: 86400 // expires in 24 hours
            });

            return ress.status(200).send({success: true, data: {username: data.username, token: token}, exp: 1});
          }
        });
      }
    });
  });

  // Connect to Socket.io
  client.on('connection', function(socket) {
    let chat;
    let olUser = [];

    // Create function to send notice
    sendNotice = function(s) {
      socket.emit('notice', s);
    }

    // Create function to send notice
    sendStatus = function(s, to = '') {
      if (to === 'client') {
        client.emit('status', s);
      } else {
        socket.emit('status', s);
      }
    }

    // Check user login status
    socket.on('signCheck', function(data) {
      jwt.verify(data.token, secret, function(err, res) {
        if (err) {
          socket.emit('signStatus', {auth: false});
        } else {
          getMessages();
        }
      });

      var x = 0;
      for (var i = 0; i < olUser.length; i++) {
        if (olUser[i] === data.username) {
          x = 1;
          break;
        }
      }

      if (!x) {
        olUser.push(data.username);

        client.emit('onlineuser', data.username);
        sendStatus({
          error: false,
          message: data.username + ' is online.',
          clear: false
        }, 'client');
      }
    });

    // Get Messages
    getMessages = function() {
      chat = db.db(dbName).collection('chats');

      // Get chats from mongo collection
      chat.find().limit(100).sort({_id:1}).toArray(function(err, res) {
        if (err) {
          throw err;
        }

        // Emit the messages
        socket.emit('output', res);
      });
    }

    // Login/Register user
    // socket.on('sign', function(data) {
      // user.find({username: data.username}).toArray(function(err, res) {
      //   if (err) {
      //     throw err;
      //   }

      //   if (res.length > 0) {
      //     res = res[0];
      //     var passwordIsValid = bcrypt.compareSync(data.password, res.password);
      //     if (!passwordIsValid) {
      //       sendNotice('Username is already exist and password is wrong.');
      //     } else {
      //       // Create a token
      //       var token = jwt.sign({ username: data.username }, secret, {
      //         expiresIn: 86400 // expires in 24 hours
      //       });
  
      //       client.emit('signin', {data: {username: data.username, token: token}, exp: 1});
      //       getMessages();
      //     }
      //   } else {
      //     user.insertOne({username: data.username, password: bcrypt.hashSync(data.password, 8)}, function(err, user) {
      //       if (err) {
      //         sendNotice('There was a problem when registering.');
      //       } else {
      //         // Create a token
      //         var token = jwt.sign({ username: data.username }, secret, {
      //           expiresIn: 86400 // expires in 24 hours
      //         });
  
      //         client.emit('signin', {data: {username: data.username, token: token}, exp: 1});
      //         getMessages();
      //       }
      //     });
      //   }
      // });
    // });

    // Handle input events
    socket.on('input', function(data) {
      let username = data.username;
      let token = data.token;
      let message = data.message;

      // Check for username and message
      if (username === '' || message === '') {
        // Send error status
        sendStatus({
          error: true,
          message: 'Please insert a message',
          clear: false
        });
      } else {
        jwt.verify(token, secret, function(err, res) {
          if (err) {
            socket.emit('signStatus', {auth: false});
          } else {
            // Insert message
            chat.insert({username: username, message: message}, function() {
              client.emit('output', [data]);
            });

            // Send status object
            sendStatus({
              error: false,
              message: 'Message sent',
              clear: true
            });
          }
        });
      }
    });

    // // Handle Clear
    // socket.on('clear', function(data) {
    //   // Remove all chats from collection
    //   chat.remove({}, function() {
    //     // Emit cleared
    //     socket.emit('cleared');
    //   });
    // })
  });
});

http.listen(port, function() {
  console.log('Listening on ' + port)
})