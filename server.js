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

function likePost(bool, postID, authorID, likerID, callback) {

  function updatePost(unary, callback) {
    var authorPostRef = firebaseDB.ref("posts/" + authorID + "/" + postID + "/likes");
    authorPostRef.transaction(function(likes) {
      return unary(likes);
    }, function(error, committed, snapshot) {
      //TODO: handle committed boolean
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        return;
      }
      updateTimelines(unary, callback);
    });
  }

  function updateTimelines(unary, callback) {
    var followersRef = firebaseDB.ref("users/" + authorID + "/followers");
    followersRef.once('value').then(function(followersSnapshot) {
      var likePaths = Object.keys(followersSnapshot.val()).map((followerID) => "timeline/" + followerID + "/" + postID + "/likes");
      likePaths.forEach(function(likePath) {
        var likeRef = firebaseDB.ref(likePath);
        likeRef.transaction(function(likes) {
          return unary(likes);
        }, function(error, committed, snapshot) {
          //TODO: handle committed boolean
          if (error) {
            response.status(500).json({error: "Internal Server Error"});
            return;
          }
          updateLikers(unary, callback);
        });
      });
    });
  }

  function updateLikers(callback) {
    var likersRef = firebaseDB.ref("likers/" + postID);
    likersRef.update({
      likerID: bool
    }, function(error) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        return;
      }
      likeOnTimeline(callback);
    });
  }

  function likeOnTimeline(callback) {
    var timelineRef = firebaseDB.ref("timeline/" + likerID + "/" + postID);
    timelineRef.update({liked: bool}, function(error) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        return;
      }
      callback();
    });
  }

  function addOne(likes) {
    return (likes || 0) + 1;
  }

  function minusOne(likes) {
    return (likes || 1) - 1;
  }

  if (bool) {
    updatePost(addOne, callback);
  } else {
    updatePost(minusOne, callback);
  }

}

app.listen(port, function() {
    console.log('App is running on http://localhost:%s', port);
});

app.use(bodyParser.json());

app.get('/', function(request, response) {
  response.status(200).json({result: 'A-Ok'});
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
    var username = "";

    function getClientName(callback) {
      var clientRef = firebaseDB.ref("clients/public/" + clientID);
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

    function getUsername(callback) {
      var userRef = firebaseDB.ref("users/" + userID + "/account");
      userRef.once("value", function(data) {
        username = data.val().username;
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
        username: username,
        client_id: clientID,
        client_message_index: clientMessageIndex,
        client_message_length: clientMessageLength,
        item_id: itemID,
        item_client_id: clientID,
        item_message_index: itemMessageIndex,
        item_message_length: itemMessageLength,
        liked: false
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
        getUsername(function() {
          createPost();
        })
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

  var token = request.body.user_token;
  var postID = request.body.post_id;
  var authorID = request.body.author_id;

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    likePost(true, postID, authorID, decodedToken.uid, function() {
      response.status(200).json({result: "Post Liked Successfully"})
    })
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  });

});

app.post('/unlike_post', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  //TODO: check if post exists before liking it
  //TODO: check to see if liker exists before liking it

  var token = request.body.user_token;
  var postID = request.body.post_id;
  var authorID = request.body.author_id;
  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    likePost(false, postID, authorID, decodedToken.uid, function() {
      response.status(200).json({result: "Post Unliked Successfully"})
    })
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  });

});

app.get('/top_posts', function(request, response) {

});

app.post('/feed_since', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var token = request.body.user_token;
  var since = request.body.since;

  function getFeed(userID) {
    var timelineRef = firebaseDB.ref("timeline/" + userID);
    timelineRef.orderByChild("timestamp").endAt(since).limitToLast(15).once("value", function(snapshot) {
      response.status(200).json({result: snapshot.val()});
      return;
    }, function(error) {
      response.status(500).json({error: "Internal Server Error"});
      console.log("Error retrieving timeline from Firebase: " + error);
      return;
    });
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    getFeed(decodedToken.uid);
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  });

});

app.post('/feed_until', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  // TODO: ensure none of these fields are null -- this should be checked on all endpoints in all servers
  var until  = request.body.until + 1;
  var token  = request.body.user_token;

  function getFeed(userID) {
    var timelineRef = firebaseDB.ref("timeline/" + userID);
    timelineRef.orderByChild("timestamp").startAt(until).limitToFirst(15).once("value", function(snapshot) {
      response.status(200).json({result: snapshot.val()});
      return;
    }, function(error) {
      response.status(500).json({error: "Internal Server Error"});
      console.log("Error retrieving timeline form Firebase: " + error);
      return;
    });
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    getFeed(decodedToken.uid);
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  });

});







