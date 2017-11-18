var express = require('express');
var bodyParser = require('body-parser');

var app = express();
var port = process.env.PORT || 3030;

const bot = require('./app');

var http = require("https");
setInterval(function() {
    https.get("https://discordcrypto.herokuapp.com/");
    console.log("5 minute timeout trigger");
}, 300000); // every 5 minutes (300000)

app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(req, res){
  res.status(200).send('CryptoBot listening service online. Bleep bloop.')
});

app.listen(port, function(){
  console.log('Listening on port %s.', port);
});

app.post('/check', function(req, res, next){
  var userName = req.body.user_name;
  var botPayload = {
    text: 'Bleep bloop.'
  }

  if (userName !== 'slackbot'){
    return res.status(200).json(botPayload);
  } else {
    return res.status(200).end();
  }
});
