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

function allPostPaths(postID, authorID) {
  var postPaths = [];
  var followersRef = firebaseDB.ref("users"/ + authorID + "/followers");
  followersRef.once('value').then(function(followersSnapshot) {
    postPaths = Object.keys(followersSnapshot.val()).map((followerID) => "timeline/" + followerID + "/" + postID);
  });

  postPaths.push("posts/" + authorID + "/" + postID);

  return postPaths;
}

function likePost(bool, postID, authorID, likerID, response, callback) {

  function updatePost(unary) {
    var authorPostRef = firebaseDB.ref("posts/" + authorID + "/" + postID + "/likes");
    authorPostRef.transaction(function(likes) {
      console.log(unary(likes));
      return unary(likes);
    }, function(error, committed, snapshot) {
      //TODO: handle committed boolean
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        return;
      }
      updateTimelines(unary);
    });
  }

  function updateTimelines(unary) {
    var followersRef = firebaseDB.ref("users/" + authorID + "/followers");
    followersRef.once('value').then(function(followersSnapshot) {
      var likePaths = Object.keys(followersSnapshot.val()).map((followerID) => "timeline/" + followerID + "/" + postID + "/likes");
      likePaths.forEach(function(likePath) {
        var likeRef = firebaseDB.ref(likePath);
        likeRef.transaction(function(likes) {
          console.log(unary(likes));
          return unary(likes);
        }, function(error, committed, snapshot) {
          //TODO: handle committed boolean
          if (error) {
            response.status(500).json({error: "Internal Server Error"});
            return;
          }
          if (bool) {
            addLiker();
          } else {
            removeLiker();
          }
        });
      });
    });
  }

  function addLiker() {
    var likersRef = firebaseDB.ref("likers/" + postID);
    var likerObj = {};
    likerObj[likerID] = true;
    likersRef.update(likerObj, function(error) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        return;
      }
      likeOnTimeline();
    });
  }

  function removeLiker() {
    firebaseDB.ref("likers/" + postID + "/" + likerID).remove();
  }

  function likeOnTimeline() {
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

function createComment(comment, postID, postUserID, authorID, response, callback) {
  var timestamp = (new Date).getTime() / 1000;
  var commentRef = firebaseDB.ref("comments/" + commentUserID).push();
  var commentObj = {
    comment: comment,
    post_id: postID,
    post_user_id: postUserID,
    author_id: authorID,
    num_replies: 0,
    timestamp: timestamp
  };

  commentRef.set(commentObj, function(error) {
    if (error) {
      response.status(500).json({error: "Internal Server Error"});
      return;
    }
    callback(commentRef.key, authorID);
  });
}

function createReply(reply, commentID, commentUserID, authorID, response, callback) {
  var timestamp = (new Date).getTime() / 1000;
  var replyRef = firebaseDB.ref("comments/" + commentUserID).push();
  var replyObj = {
    comment: reply,
    comment_id: commentID,
    comment_user_id: commentUserID,
    author_id: authorID
    num_replies: 0,
    timestamp: timestamp
  };

  replyRef.set(replyObj, function(error) {
    if (error) {
      response.status(500).json({error: "Internal Server Error"});
      return;
    }
    callback(replyRef.key, authorID);
  });

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
      var clientRef = firebaseDB.ref("clients/" + clientID + "/public/");
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
        post_user_id: userID,
        username: username,
        client_id: clientID,
        client_message_index: clientMessageIndex,
        client_message_length: clientMessageLength,
        item_id: itemID,
        item_client_id: clientID,
        item_message_index: itemMessageIndex,
        item_message_length: itemMessageLength,
        liked: false,
        likes: 0,
        reply_count: 0
      };

      var followersRef = firebaseDB.ref("users/" + userID + "/followers");
      followersRef.once('value').then(function(followersSnapshot) {
        var rootRef = firebaseDB.ref();
        var fanoutObject = fanoutTimelines(followersSnapshot, postObject, postID);
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

app.post('/create_post', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var token = request.body.user_token;
  var message = request.body.message;
  var timestamp = (new Date).getTime() / 1000;

  function getUsername(userID) {
    var usernameRef = firebaseDB.ref("users/" + userID + "/account/username");
    usernameRef.once("value").then(function(snapshot) {
      createPost(userID, snapshot.val());
    })
  }

  function createPost(userID, username) {
    var postRef = firebaseDB.ref("posts/" + userID);
    var newPostRef = postRef.push();
    var postID = newPostRef.key;
    var postObject = {
      message: message,
      timestamp: timestamp,
      user_id: userID,
      username: username,
      liked: false,
      reply_count: 0
    };

    
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    getUsername(decodedToken.uid);
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  })


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
    likePost(true, postID, authorID, decodedToken.uid, response, function() {
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
    likePost(false, postID, authorID, decodedToken.uid, response, function() {
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
  var token  = request.body.user_token;
  var until  = request.body.until + 1;

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

app.post('/post_comment', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var postID = request.body.post_id;
  var postUserID = request.body.post_user_id;
  var comment = request.body.comment;
  var token = request.body.user_token;

  function referenceComment(commentID, commentUserID) {
    var replyObj = {};
    replyObj[commentID] = commentUserID;

    var fanoutObject = {};
    var postPaths = allPostPaths(postID, postUserID);
    var replyPaths = postPaths.map((path) => path + "/replies");
    replyPaths.forEach((path) => fanoutObject[path] = replyObj);

    var rootRef = firebaseDB.ref();
    rootRef.update(fanoutObject, function(error) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        console.log("Error saving data to firebase: " + error);
        return;
      } else {
        incrementReplyCounts(postPaths);
      }
    });
  }

  function incrementReplyCounts(postPaths) {
    postPaths.forEach(function(path) {
      var ref = firebaseDB.ref(path + "/reply_count");
      ref.transaction(function(count) {
        return (count || 0) + 1;
      }, function(error, committed, snapshot) {
        if (error) {
          response.status(500).json({error: "Internal Server Error"});
          return;
        }
        response.status(500).json({result: "Comment Successful"});
      });
    })
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    createComment(comment, postID, postUserID, decodedToken.uid, response, referenceComment);
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  });

});

app.post('/comment_reply', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var token = request.body.user_token;
  var commentID = request.body.comment;
  var commentAuthorID = request.body.comment_user_id;
  var comment = request.body.comment;

  function referenceComment(replyCommentID, commentUserID) {
    var originalCommentRef = firebaseDB.ref("comments/" + commentAuthorID + "/" + commentID + "/replies");
    var replyObj = {};
    replyObj[replyCommentID] = commentUserID;
    originalCommentRef.update(replyObj, function(error) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        console.log("Error saving data to firebase: " + error);
        return;
      }
      incrementReplyCount(replyCommentID, commentUserID);
    });
  }

  function incrementReplyCount(replyCommentID, commentUserID) {
    var origininalCommentRef = firebaseDB.ref("comments/" + commentAuthorID + "/" + commentID + "/reply_count");
    origininalCommentRef.transaction(function(count) {
      return (count || 0) + 1;
    }, function(error, committed, snapshot) {
      if (error) {
        response.status(500).json({error: "Internal Server Error"});
        return;
      }
      response.status(500).json({result: "Comment Successful"});
    });
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    createReply(comment, commentID, commentAuthorID, decodedToken.uid, response, referenceComment);
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  });
});

app.post('/comments_since', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var userID = request.body.user_id;
  var postID = request.body.post_id;
  var since  = request.body.since;
  var token  = request.body.user_token;

  function getComments() {
    var commentsRef = firebaseDB.ref("posts/" + userID + "/" + postID + "/replies");
    commentsRef.orderByChild("timestamp").endAt(since).limitToLast(15).once("value", function(snapshot) {
      response.status(200).json({result: snapshot.val()});
      return;
    }, function(error) {
      response.status(500).json({error: "Internal Server Error"});
      console.log("Error retrieving comments from Firebase: " + error);
      return;
    });
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    getComments();
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  })

});

app.post('/comment_replies', jsonParser, function(request, response) {
  if (!request.body) {
    response.status(400).json({error: "Bad Request"});
    return;
  }

  var userID = request.body.user_id;
  var commentID = request.body.comment_id;
  var since = request.body.since;
  var token = request.body.user_token;

  function getComments() {
    var commentsRef = firebaseDB.ref("comments/" + userID + "/" + commentID + "/replies");
    commentsRef.orderByChild("timestamp").endAt(since).limitToLast(15).once("value", function(snapshot) {
      response.status(200).json({result: snapshot.val()});
      return;
    }, function(error) {
      response.status(500).json({error: "Internal Server Error"});
      console.log("Error retrieving comments from Firebase: " + error);
      return;
    });
  }

  firebase.auth().verifyIdToken(token).then(function(decodedToken) {
    getComments();
  }).catch(function(error) {
    console.log(error);
    response.status(401).json({error: "Unauthorized"});
  })
});