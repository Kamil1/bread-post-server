var firebase = require("firebase");
var express = require('express');

var app = express();
var port = process.env.PORT || 8081;

firebase.initializeApp({
    serviceAccount: 'conf/Bread-b1b218ad8f50.json',
    databaseURL: 'https://bread-e6858.firebaseio.com'
});

app.listen(port, function() {
    console.log('App is running on http://localhost:%s', port);
});

var firebaseDB = firebase.database();
var transactionRef = firebaseDB.ref("transactions");

transactionRef.on("child_added", function(snapshot) {
  console.log("child added");

  
  var post      = snapshot.val();
  var userID    = post.user_id;
  var quantity  = post.quantity;
  var timestamp = post.timestamp;
  var clientID  = post.client_id;
  var itemID    = post.item_id;

  var clientRef = firebaseDB.ref("clients/" + clientID);
  var clientName = "";
  clientRef.once("value", function(data) {
    clientName = data.val().app_name;
  });

  var itemRef = firebaseDB.ref("clients/" + clientID + "/items/" + itemID);
  var itemName = "";
  itemRef.once("value", function(data) {
    itemName = data.val().name;
  });

  var message = "";
  if (quantity > 1) {
    message = "Just got " + quantity + " " + itemName + "s in " + clientName + "!";
  } else {
    message = "Just got " + itemName + " in " + clientName + "!";
  }

  var postRef = firebaseDB.ref("users/" + userID + "/posts");
  postRef.push({
    message: message,
    timestamp: timestamp
  });

});