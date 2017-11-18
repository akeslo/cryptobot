# Cryptobot
Cryptobot is a versatile cryptocurrency bot that is built for both Slack and Discord. There are two different versions, each hosted on a separate branch in this repository.

## Configuration
* Create the following environmental variables:
  * process.env.BOT_NAME
  * process.env.BOT_ID
  * process.env.BOT_TOKEN
* Update config.json as needed
* Deploy!

*NOTE:* This was built with Heroku in mind. To keep the app alive, server.js contains an https request every 5 minutes.  Update/Remove as needed.

## Current features
Some of the current features of Cryptobot include:
* Price queries (ex. '$cryptobot show price *coin* ')
* Automatic price updates based on an "interest list"
* Updates on significant increases/decreases (pumps and dumps)
* Customizable alert + update thresholds/intervals

## Helpful links
If you are new to adding bots to your server, building a Discord bot, or running a Node.js application, there are a few guides/documents that will help you get started:
* [Discord.js documentation](//discord.js.org/#/docs/main/stable/general/welcome), [Github repo](//github.com/hydrabolt/discord.js), and [npm page](//www.npmjs.com/package/discord.js)
* [Official Discord documentation](//discordapp.com/developers/docs/topics/oauth2) on bots
* [How to add a bot](//www.youtube.com/watch?v=2YO96GFBSLw) to a Discord server

## Shoutouts
* This code was updated for discord and taken from [LuminoCo/cryptobot](//https://github.com/LuminoCo/cryptobot).  As their discord branch currently sits, discord does not deploy :-(.  However, a big thanks to them for the initial code base!
* No support for slack in this repo.
