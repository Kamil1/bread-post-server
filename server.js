var firebase = require("firebase");

firebase.initializeApp({
    serviceAccount: 'conf/Bread-b1b218ad8f50.json',
    databaseURL: 'https://bread-e6858.firebaseio.com'
});

var firebaseDB = firebase.database();
var transactionRef = firebaseDB.ref("transactions");

transactionRef.on("child_added", function(snapshot) {
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