var bodyParser = require('body-parser');
var firebase = require("firebase");
var express = require('express');

firebase.initializeApp({
    serviceAccount: 'conf/Bread-b1b218ad8f50.json',
    databaseURL: 'https://bread-e6858.firebaseio.com'
});

var firebaseDB = firebase.database();

var app = express();
var port = process.env.PORT || 8081;

app.listen(port, function() {
    console.log('App is running on http://localhost:%s', port);
});

app.use(bodyParser.json());

app.get('/', function(request, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('A-Ok');
});

app.post('/share_transaction', function(request, response) {
  if (!request.body) {
    reponse.status(400).json({error: "Bad Request"});
  }

  var transactionID = response.body.transaction_id;
  var transactionRef = firebaseDB.ref("transactions/" + transaction_id);
  transactionRef.once("value", function(snapshot) {
    var transaction = snapshot.val();

    var clientID = transaction.client_id;
    var itemID = transaction.item_id;
    var userID = transaction.user_id;
    var quantity = transaction.quantity;
    var timestamp = transaction.timestamp;
    var itemID = transaction.item_id;

    var clientName = "";
    var itemName = "";

    function getClientName(callback) {
      var clientRef = firebaseDB.ref("clients/" + clientID);
      clientRef.once("value", function(data) {
        clientName = data.val().app_name;
        callback();
      });
    }

    function getItemName(callback) {
      var itemRef = firebaseDB.ref("clients/" + clientID + "/items/" + itemID);
      itemRef.once("value", function(data) {
        itemName = data.val().name;
        callback();
      });
    }

    function createPost() {
      var postRef = firebaseDB.ref("users/" + userID + "/posts");
      var message = "";
      if (quantity > 1) {
        message = "Just got " + quantity + " " + itemName + "s in " + clientName + "!";
      } else {
        message = "Just got " + itemName + " in " + clientName + "!";
      }
    
      postRef.push({
        message: message,
        timestamp: timestamp
      }, function(error) {
        if (error) {
          response.status(500).json({error: "Internal Server Error"});
          return;
        }
        response.status(500).json({result: "Post Successfully Created"});
        return;
      });
    }

    getClientName(function() {
      getItemName(function() {
        createPost();
      })
    })

  });
});
