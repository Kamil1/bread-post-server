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

function fanoutTimelines(followersSnapshot, post, postID) {
  var fanoutObject = {};
  var followers = Object.keys(followersSnapshot.val());
  followers.forEach((key) => fanoutObject["timeline/" + key + "/" + postID] = post);
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
    response.status(400).json({error: "Bad Request"});
    return;
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
      var postObject = {
        message: message,
        timestamp: timestamp,
        user_id: userID,
        client_id: clientID,
        client_message_index: clientMessageIndex,
        client_message_length: clientMessageLength,
        item_id: itemID,
        item_message_index: itemMessageIndex,
        item_message_length: itemMessageLength,
        has_video: false,
        has_image: false
      };

      var followersRef = firebaseDB.ref("users/" + userID + "/followers");
      followersRef.once('value').then(function(followersSnapshot) {
        var rootRef = firebaseDB.ref();
        var fanoutObject = fanoutTimelines(followersSnapshot, postObject, postID, fanoutObject);
        fanoutObject["posts/" + userID + "/" + postID] = postObject;
        rootRef.update(fanoutObject, function(error) {
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
    return;
  }

  //TODO: check if post exists before liking it
  //TODO: check to see if liker exists before liking it

  var postID = request.body.post_id;
  var authorID = request.body.author_id;
  var likerID = request.body.liker_id;

  var fanoutObject = {};
  fanoutObject["posts/" + authorID + "/" + postID + "/likers/" + likerID] = true;
  var followersRef = firebaseDB.ref("users/" + authorID + "/followers");
  followersRef.once('value').then(function(followersSnapshot) {
    var likePaths = Object.keys(followersSnapshot.val()).map((followerID) => "timeline/" + followerID + "/" + postID + "/likers/" + likerID);
    likePaths.forEach(function(likePath) {
      fanoutObject[likePath] = true;
    });
    var rootRef = firebaseDB.ref();
    rootRef.update(fanoutObject, function(error) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        console.log("Error saving post like to firebase: " + error);
      } else {
        response.status(200).json({result: "Like Successful"});
        return;
      }
    });
  });
});

app.get('/top_posts', function(request, response) {

});

app.post('/feed_tail', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var userID = request.body.user_id;
  var since = request.body.since;
  if (since == null) {
    since = new Date().getTime() / 1000;
  }

  var timelineRef = firebaseDB.ref("timeline/" + userID);
  timelineRef.orderByChild("timestamp").endAt(since).limitToLast(15).once("value", function(snapshot) {
    response.status(200).json({result: snapshot.val()});
    return;
  }, function(error) {
    response.status(500).json({error: "Internal Server Error"});
    console.log("Error retrieving timeline from Firebase: " + error);
    return;
  });

});

app.post('/feed_head', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  // TODO: ensure none of these fields are null -- this should be checked on all endpoints in all servers
  var userID = request.body.user_id;
  var until = request.body.until;

  var timelineRef = firebaseDB.ref("timeline/" + userID);
  timelineRef.orderByChild("timestamp").endAt(until).limitToFirst(15).once("value", function(snapshot) {
    response.status(200).json({result: snapshot.val()});
    return;
  }, function(error) {
    response.status(500).json({error: "Internal Server Error"});
    console.log("Error retrieving timeline form Firebase: " + error);
    return;
  });

});







