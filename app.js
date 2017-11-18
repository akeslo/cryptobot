'use strict';

//import our dependencies
var Discord = require('discord.js'),
    https = require('https'),
    fs = require('fs');

//declare some variables that help the bot function
var bot_token = process.env.BOT_TOKEN,
    bot_name,
    bot_id;

//declare the config file path
var dir = __dirname,
    config = dir + '/config.json',
    interest_list = dir + '/interestlist.json',
    sayings = require('./sayings.json');

//make a new bot object
const bot = new Discord.Client();

//let's get the coin data from coinmarketcap.com
var tickerUpdateInterval = 30,
    tickerData = [],
    tickerDataOptions = {
      "method": "GET",
      "hostname": "api.coinmarketcap.com",
      "port": 443,
      "path": "/v1/ticker/",
      "headers": {
        "cache-control": "no-cache"
      }
    };

//get the data initially and continue to refresh it every 'tickerUpdateInterval' seconds
getTickerData();
var dataInterval = setInterval(getTickerData, tickerUpdateInterval * 1000);

function getTickerData() {
  let cmcGET = new Promise(function(resolve, reject) {
    var request = https.request(tickerDataOptions, function(response) {
      var chunks = [];
      response.on("data", function(chunk) {
        chunks.push(chunk);
      });

      response.on("end", function() {
        var data = Buffer.concat(chunks);
        resolve(data.toString());
      });
    });

    request.on('error', (err) => {
      console.log('ERROR CONTACTING THE API! %s', err);
      reject(Error(err));
    });

    request.end();
  });

  cmcGET.then(function(data){
    if (data && data != 'undefined') {
      tickerData = data;
      tickerData = JSON.parse(tickerData);
      return data;
    }
  }).catch(function(err){
    console.log(err);
    return 'There was an error! ' + err;
  });
}

function selectCoinInfo(coin) {
  return new Promise(function(resolve, reject) {
    //check tickerData for that coin's symbol
    for (var ticker in tickerData) {
      if (tickerData[ticker].symbol && tickerData[ticker].symbol !== "undefined" && typeof tickerData[ticker].symbol === 'string' && tickerData[ticker].symbol.toLowerCase() === coin.toLowerCase()){
        //if/when that coin's symbol is found, return all of that coin's information and stop searching
        resolve(tickerData[ticker]);
        break;
      }
    }
  });
}

function getCoinList() {
  return new Promise(function(resolve, reject) {
    ((!tickerData) ? reject("There is no data for me to work with!") : tickerData);

    var coinList = [];
    for (var ticker in tickerData) {
      coinList.push(tickerData[ticker].symbol);
      if ((parseInt(ticker) + 1) == tickerData.length) {
        resolve(coinList);
      }
    }
  });
}

//the client will emit an RTM.AUTHENTICATED event on successful connection
var botConfig = require(config);

var automaticUpdatesEnabled = botConfig.updates.enabled,
    updateInterval = botConfig.updates.interval,
    updateChannel = botConfig.updates.channel,
    alertsEnabled = botConfig.alerts.enabled,
    alertThreshold = botConfig.alerts.threshold,
    alertInterval = botConfig.alerts.interval,
    automaticUpdates,
    automaticAlerts;

bot.on('ready', () => {
  bot_name =  process.env.BOT_NAME;
  bot_id =  process.env.BOT_ID;
  console.log('Successfully logged in as %s. Bot online. Bleep bloop.', bot_name);

  var interestList = require(interest_list);

  setUpdateInterval(updateInterval);
  setInterval(alert, (alertInterval) * 1000, interestList);

  function updateTimed(updateList, channel) {
    console.log("Automatic Updates Are: " + automaticUpdatesEnabled)
    if (automaticUpdatesEnabled) {
    ((channel.send) ? channel : channel = bot.channels.find('name', channel));
    ((channel.send) ? channel.send("**--- Price Update ---**") : console.log(updateMessage));
    update(updateList, channel)
    }
  }

  function update(updateList, channel) {
    if (tickerData.length !== 0 && updateList.length !== 0) {
      for (var coin in updateList) {
        var updateMessage,
            target = updateList[coin];

        selectCoinInfo(target).then(function(coinInfo){
          ((coinInfo && coinInfo.symbol) ? updateMessage = "*" + coinInfo.symbol.toUpperCase() + "*: " + "$" + coinInfo.price_usd + " ("+ coinInfo.price_btc + " BTC ) | *" + coinInfo.percent_change_24h + "%* in 24 hours (" + coinInfo.percent_change_1h + "% last hour)." : updateMessage = "Uh oh! Something went wrong with retrieving the data.");
          ((channel.send) ? channel.send(updateMessage) : console.log(updateMessage));
        }).catch(function(err){
          ((channel.send) ? channel.send(err) : console.log(err));
        });
      }
    } else {
      //no data to send
      ((channel.send) ? channel.send("Uh oh! Looks like there's no data for me to send you... coinmarketcap.com might be down or I might be disconnected from their server." ) : console.log(err));
    }
  }

  function alert(alertList) {
    console.log("Alerts Are: " + alertsEnabled)
    if (alertsEnabled) {
      var channel = bot.channels.find('name', updateChannel);
      if (tickerData.length !== 0 && alertList.length !== 0) {
        for (var coin in alertList) {
          var alertMessage,
              target = alertList[coin];

          selectCoinInfo(target).then(function(coinInfo){
            if ((coinInfo.percent_change_1h > alertThreshold) || (coinInfo.percent_change_1h < alertThreshold * -1)) {
            ((coinInfo && coinInfo.symbol) ? alertMessage = "@everyone *ALERT*: It looks like " + coinInfo.symbol.toUpperCase() + " is making a large shift in price (" + coinInfo.percent_change_1h + "% last hour)." : updateMessage = "Uh oh! Something went wrong with retrieving the data.");
            channel.send(alertMessage );
            }
          }).catch(function(err){
            ((channel) ? channel.send(err) : console.log(err));
          });
        }
      } else {
        //no data to send
        channel.send("Uh oh! Looks like there's no data for me to send you... coinmarketcap.com might be down or I might be disconnected from their server.");
      }
    }
  }

  //////////// AUTOMATIC INTERACTION ///////////////


  bot.on('guildMemberAdd', function(user){
    user.send("Welcome to the team! My name is " + bot_name + " and I'm here to keep you updated on cryptocurrency prices. Allow me to send you a list of my commands.", user.id);
    displayHelp(user.id);
  });


  function enableAutomaticUpdates(bool){
    ((bool === true) ? automaticUpdatesEnabled = true : automaticUpdatesEnabled = false);
    saveConfig();
  }

  function setUpdateInterval(interval) {
    return new Promise(function(resolve, reject){
      if (typeof interval === 'number') {
        updateInterval = interval * 60 * 60; //convert to hours
        saveConfig();

        clearInterval(automaticUpdates);
        automaticUpdates = null;
        automaticUpdates = setInterval(function(){
          ((interestList && updateChannel) ? updateTimed(interestList, updateChannel) : interestList);
        }, updateInterval * 1000);
        resolve(true);
      } else {
        reject("Sorry, I didn't see a number.");
      }
    });
  }

  function setUpdateChannel(channel){
    updateChannel = channel;
    saveConfig();
  }

  function enableAlerts(bool){
    ((bool) ? alertsEnabled = true : alertsEnabled = false);
    saveConfig();
  }

  function setAlertThreshold(threshold) {
    return new Promise(function(resolve, reject){
      if (typeof threshold === 'number') {
        alertThreshold = threshold;
        saveConfig();

        resolve(true);
      } else {
        reject("Sorry, I didn't see a number.");
      }
    });
  }

  function saveConfig(){
    var config_object = {
      bot: {
        id: bot_id,
        name: bot_name
      },
      updates: {
        enabled: automaticUpdatesEnabled,
        interval: updateInterval,
        channel: updateChannel
      },
      alerts: {
        enabled: alertsEnabled,
        threshold: alertThreshold,
      }
    };

    fs.writeFile(config, JSON.stringify(config_object), 'utf8', function(){});
  }

  function saveInterestList() {
    fs.writeFile(interest_list, JSON.stringify(interestList), function(){});
  }

  //////////// MANUAL INTERACTION ///////////////
  bot.on('message', function(payload){
    var noUnderstand = "I'm sorry, I didn't understand what you asked. Type *$cryptobot help* to see a detail of my commands.";

    var message = payload.content,
        author = payload.author,
        channel = payload.channel;

    if (message && message.includes("$" + bot_name.toLowerCase()) && author.username !== bot_name) {
      if (message.includes("help")) {
        //display the list of functions
        payload.reply(displayHelp());

      /* interestlist add coin interestlist remove coin interestlist show interestlist show prices */
      } else if (message.includes("interestlist")) {
        if (message.includes("add")) {
          parseCoins(message).then(function(parsedCoins){
            ((parsedCoins.length > 0) ? addInterest(message, channel) : payload.reply("Sorry, I didn't recognize any of those coin symbols. I encourage you to try again."));
          }).catch(function(err){
            payload.reply(err);
          });
        } else if (message.includes("remove")) {
          removeInterest(message, channel);
        } else if (message.includes("show") && message.includes("prices")) {
          ((interestList.length > 0) ? update(interestList, channel) : payload.reply("It looks like your interest list is currently empty! *Add* to it by typing '$cryptobot interestlist add BTC.'"));
        } else if (message.includes("show")) {
          ((interestList.length > 0) ? payload.reply(displayInterests(channel)) : payload.reply("It looks like your interest list is currently empty! *Add* to it by typing '$cryptobot interestlist add BTC.'"));
        }

      /*  enable alerts disable alerts set (percent) alert threshold set alert channel show alerts enabled show alerts interval show alerts channel */
      } else if (message.includes("alert")) {
        if ((message.includes("enable") || message.includes("disable")) && ! message.includes("enabled")) {
          ((message.includes("enable")) ? enableAlerts(true) : enableAlerts(false));
          payload.reply(saySuccessMessage());
        } else if (message.includes("set") && message.includes("threshold")) {
            parseFloatComplex(message).then(function(num){
            setAlertThreshold(num).then(function(resolved){
            payload.reply(saySuccessMessage("You'll be automagically updated on coins that reach " + num + "% increase/decrease."));
           }).catch(function(err){
             payload.reply(err);
           });
         }).catch(function(err){
           payload.reply(err);
         });
        } else if (message.includes("set") && message.includes("channel")) {
          setUpdateChannel(channel.name);
          channel.send(saySuccessMessage("I set the update channel to " + channel.name + ". That's where you'll get updated automatically from now on."));
        } else if (message.includes("show") && message.includes("enabled")) {
          ((alertsEnabled) ? payload.reply("Pump and dump alerts are indeed enabled! You'll be updated when a coin reaches " + alertThreshold + "% increase/decrease." ) : payload.reply("It seems as though automatic updates are disabled." ));
        } else if (message.includes("show") && message.includes("threshold")) {
          payload.reply("The current pump and dump threshold is set to " + alertThreshold + "% in one hour.");
        } else if (message.includes("show") && message.includes("channel")) {
          payload.reply("The current channel receiving the rapid price increase alerts and automatic updates is " + updateChannel + "." );
        }


      /*  enable updates; disable updates; set (hours) update interval; set update channel; show updates enabled; show updates interval; show updates channel */
      } else if (message.includes("updates") || message.includes("update")) {
        if ((message.includes("enable") || message.includes("disable") ) && ! (message.includes("show"))) {
          ((message.includes("enable")) ? enableAutomaticUpdates(true) : enableAutomaticUpdates(false));
          payload.reply(saySuccessMessage());

        } else if (message.includes("show")) {

          if (message.includes("enabled")) {
            ((automaticUpdatesEnabled) ? payload.reply("Automatic updates are indeed enabled! You'll be updated every " + (updateInterval / 60 / 60) + " hours." ) : payload.reply("It seems as though automatic updates are disabled." ));
          } else if (message.includes("interval")) {
            payload.reply("The current automatic update interval is set to " + (updateInterval / 60 / 60) + " hours." );
          } else if (message.includes("channel")) {
            payload.reply("The current channel receiving the automatic updates and rapid price increase alerts is " + updateChannel + "." );
          }

        } else if (message.includes("set")) {
          if (message.includes("channel")) {
            setUpdateChannel(channel.name);
            channel.send(saySuccessMessage("I set the update channel to " + channel.name + ". That's where you'll get updated automatically from now on."));
          } else if (message.includes("interval")) {
              parseFloatComplex(message).then(function(num){
              setUpdateInterval(num).then(function(resolved){
                channel.send(saySuccessMessage("You'll be automagically updated on your coins interests every " + num + " hours from now on."));
              }).catch(function(err){
                payload.reply(err);
              });
            }).catch(function(err){
              payload.reply(err);
            });
          }

        }

      } else if (message.includes("show") && (message.includes("price"))) {
        //parse text for all coin references
        parseCoins(message).then(function(parsedCoins){
          ((parsedCoins.length > 0) ? update(parsedCoins, channel) : payload.reply("Sorry, I didn't recognize any of those coin symbols. I encourage you to try again."));
        }).catch(function(err){
          payload.reply(err);
        });

      } else {
        payload.reply(noUnderstand);
      }


    }


    function parseCoins(message) {
      return new Promise(function(resolve, reject){
        getCoinList().then(function(coinList){
          var words = message.split(" "),
              coinsMentioned = [];
          for (var word in words) {
            var useable = words[word].toUpperCase();
            if (coinList.indexOf(useable) > -1) {
              coinsMentioned.push(useable);
            }
            if ((parseInt(word) + 1) == words.length) {
              resolve(coinsMentioned);
            }
          }
        }).catch(function(err){
          reject(err);
        });
      });
    }

    function parseFloatComplex(message) {
      console.log(message);
      return new Promise(function(resolve, reject){
        if (/\d+/.test(message)) {
          minusBotReference(message).then(function(clean){
            var num;
            ((/.\d+/.test(clean)) ? num = clean.match(/.\d+/) : num = clean.match(/\d+/)); //check for decimals representing hours, too
            resolve(parseFloat(num[0]));
          }).catch(function(err){
            reject(err);
          });
        } else {
          reject("It looks like I was not supplied with a real number.");
        }
      });
    }

    function minusBotReference(str){
      return new Promise(function(resolve, reject){
        if (str && typeof str === 'string' && str !== "") {
          var re_id = new RegExp(bot_id.toString(), "g"),
              re_name = new RegExp(bot_name.toString(), "g");
          str = str.replace(re_id, "");
          str = str.replace(re_name, "");
          resolve(str);
        } else {
          reject("Hmm... there seems to be no readable text here. Strange.");
        }
      });
    }

    function sayGreeting(channel, addition) {
      var greetingList = sayings.greeting,
          rand = Math.floor((Math.random() * greetingList.length)),
          greeting = greetingList[rand];
      ((addition) ? greeting = greeting + " " + addition : greeting);
      return greeting;
    }

    function saySuccessMessage(addition) {
      var successMessageList = sayings.success,
          rand = Math.floor((Math.random() * successMessageList.length)),
          successMessage = successMessageList[rand];
      ((addition) ? successMessage = successMessage + " " + addition : successMessage);
      return successMessage;
    }

    function sayErrorMessage(addition) {
      var errorMessageList = sayings.error,
          rand = Math.floor((Math.random() * successMessageList.length)),
          errorMessage = errorMessageList[rand];
      ((addition) ? errorMessage = errorMessage + " " + addition : errorMessage);
      return errorMessage;
    }

    function addInterest(string, channel) {
      //parse text for all coin references
      parseCoins(string).then(function(parsedCoins){
        for (var coin in parsedCoins) {
          //add the parsed coins to the list (if it's not already there)
          ((interestList.indexOf(parsedCoins[coin]) > -1) ? payload.reply(parsedCoins[coin] + " is already on the interest list." ) : interestList.push(parsedCoins[coin]));
          if ((parseInt(coin) + 1) == parsedCoins.length) {
            //update the user on the last cycle of the loop
            channel.send(saySuccessMessage("I made sure that the coins you mentioned are now the interest list. You can type '$cryptobot interestlist show' to confirm."));
            //... and save the new interest list as 'interestlist.json'
            saveInterestList();
          }
        }
      }).catch(function(err){
        channel.send(err);
      });
    }

    function removeInterest(string) {
      //parse text for all coin references
      parseCoins(string).then(function(parsedCoins){
        for (var coin in parsedCoins) {
          //remove the parsed coins from the list
          var index = interestList.indexOf(parsedCoins[coin]);
          ((interestList.indexOf(parsedCoins[coin]) > -1) ? interestList.splice(index, 1) : payload.reply("Hmm, I don't see " + parsedCoins[coin] + " on the list." ));
          if ((parseInt(coin) + 1) == parsedCoins.length) {
            //update the user on the last cycle of the loop
            channel.send(saySuccessMessage("I can assure you that the coins you mentioned are not on the interest list anymore. You can type '$cryptobot interestlist show' to confirm."));
            //... and save the new interest list as 'interestlist.json'
            saveInterestList();
          }
        }
      }).catch(function(err){
        channel.send(err);
      });
    }

    function displayInterests(channel) {
      if (interestList && interestList.length > 0) {
        var concatInterests = interestList.join(", ");
        return "The current interest list includes: " + concatInterests + ".";
      } else {
        return "It looks like the interest list is empty! *Add* to it by typing '$cryptobot add BTC to the interest list'.";
      }
    }

    function displayHelp() {
      return `Here is what I can do:

      *All commands must begin with $cryptobot*

      **Price: Display current coin price**
                show price *coin*

      **Interest List: A coin watch list**
                interestlist add *coin*
                interestlist remove *coin*
                interestlist show
                interestlist show prices

      **Updates: Send periodic price updates to the channel.**
                enable updates
                disable updates
                set update interval *hours*
                set update channel
                show updates enabled
                show updates interval
                show updates channel

      **Alerts: Percent based threshold alerts**
                enable alerts
                disable alerts
                set alert threshold *percent*
                set alert channel
                show alerts enabled
                show alerts threshold
                show alerts channel
                `;
    }
  });
});

//log the bot into the server
bot.login(bot_token);
module.exports = bot;
