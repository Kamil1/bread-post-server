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
var jsonParser = bodyParser.json();

app.listen(port, function() {
    console.log('App is running on http://localhost:%s', port);
});

app.use(bodyParser.json());

app.get('/', function(request, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('A-Ok');
});

app.post('/share_transaction', jsonParser, function(request, response) {
  if (!request.body) {
    reponse.status(400).json({error: "Bad Request"});
  }

  var transactionID = request.body.transaction_id;
  var transactionRef = firebaseDB.ref("transactions/" + transactionID);
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
      var postRef = firebaseDB.ref("posts");
      var userPostsRef = firebaseDB.ref("users/" + userID + "/posts");
      var message = "";
      if (quantity > 1) {
        message = "Just got " + quantity + " " + itemName + "s in " + clientName + "!";
      } else {
        message = "Just got a " + itemName + " in " + clientName + "!";
      }
    
      var newPostRef = postRef.push();
      var postID = newPostRef.key;
      newPostRef.set({
        message: message,
        timestamp: timestamp,
        user_id: userID,
        likes: 0
      }, function(error) {
        if (error) {
          response.status(500).json({error: "Internal Server Error"});
          return;
        } else {
          var postObject = {};
          postObject[postID] = true;
          userPostsRef.update(postObject, function(error) {
            if (error) {
              response.status(500).json({error: "Internal Server Error"});
              return;
            } else {
              response.status(200).json({result: "Post Successfully Created"});
              return;
            }
          });
        }
      });
    }

    getClientName(function() {
      getItemName(function() {
        createPost();
      })
    })

  });
});

app.post('/like_post', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
  }

  var postID = request.body.post_id;

  var postRef = firebaseDB.ref("posts/" + postID);
  postRef.transaction(function(likes) {
    return (likes || 0) + 1;
  }, function(error) {
    if (error) {
      response.status(500).json({error: "Internal Server Error"});
      console.log("Error saving data to firebase: " + error);
      return;
    } else {
      response.status(200).json({result: "Like Successful"});
      return;
    }
  });

});

app.post('/get_feed', jsonParser, function(request, response) {
  if (!request.body) {
    reponse.status(400).json({error: "Bad Request"});
  }

  

});
