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

function fanoutTimelines(followersSnapshot, post, fanoutObject) {
  var followers = Object.keys(followersSnapshot.val());
  followers.forEach((key) => fanoutObject["timeline/" + key] = post);
  return fanoutObject;
}

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
      var postRef = firebaseDB.ref("posts/" + userID);
      var clientMessageLength = clientName.length;
      var itemMessageLength = itemName.length;
      
      var message = "";
      var clientMessageIndex = 0;
      var itemMessageIndex = 0;
      if (quantity > 1) {
        message = "Just got " + quantity + " " + itemName + "s in " + clientName + "!";
        clientMessageIndex = 15 + quantity.toString().length + itemName.length;
        itemMessageIndex = 10 + quantity.toString().length;
      } else {
        message = "Just got a " + itemName + " in " + clientName + "!";
        clientMessageIndex = 15 + itemName.length;
        itemMessageIndex = 11;
      }
    
      var newPostRef = postRef.push();
      var postID = newPostRef.key;
      var postObject = {};
      postObject[postID] = {
        message: message,
        timestamp: timestamp,
        user_id: userID,
        likes: 0,
        client_id: clientID,
        client_message_index: clientMessageIndex,
        client_message_length: clientMessageLength,
        item_id: itemID,
        item_message_index: itemMessageIndex,
        item_message_length: itemMessageLength,
        has_video: false,
        has_image: false
      };

      var fanoutObject = {};
      fanoutObject["posts/" + userID] = postObject;

      var followersRef = firebaseDB.ref("users/" + userID + "/followers");
      followersRef.once('value').then(function(followersSnapshot) {
        var timelineRef = firebaseDB.ref("timeline");
        timelineRef.update(fanoutTimelines(followersSnapshot, postObject, fanoutObject), function(error) {
          console.log("in callback");
          if (error) {
            response.status(500).json({error: "Internal Server Error"});
            console.log("Error saving data to firebase: " + error);
            return;
          } else {
            response.status(200).json({result: "Post Successful"});
            return;
          }
        });
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

  //TODO: check if post exists before liking it

  var postID = request.body.post_id;

  var postRef = firebaseDB.ref("posts/" + postID + "/likes");
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

app.get('/top_posts', function(request, response) {

});

app.post('/get_feed', jsonParser, function(request, response) {
  if (!request.body) {
    reponse.status(400).json({error: "Bad Request"});
  }


  

});
