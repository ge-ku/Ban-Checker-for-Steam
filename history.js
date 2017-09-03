var lastRecordedGameTime = 0; // When last recorded game occured
var rightNow = Number (new Date); // Time right now, should be consistent for the duration of one routine call
var emptyStorage = false;
var allRecordedGames; // Contains all recorded games
                      // We're loading everything when routine is started
                      // And saving it back to storage once we're finished


function Game(time, appid, players) {
  this.time = time; // unix timestamp
  this.appid = appid; // Steam appid
  this.players = players; // array of Player objects
  this.lastScanTime = 0;
}

function Player(miniprofile, name, ban) {
  this.miniprofile = miniprofile; // miniprofile can be converted to steamid64 by adding 76561197960265728
  this.name = name; // Name when recorded
  this.bannedAfterRecording = ban; // true or false
  this.steamid = playerSteamID64(miniprofile);
}

function playerSteamID64(miniprofile) {
  // We can't just add these numbers because of JS limitations (see Number.MAX_SAFE_INTEGER)
  // Steam IDs are in ascending order so we should be fine by doing this little hack without
  // worrying too much. In any case we're storing correct miniprofile and can update this if needed.
  return "76" + (parseInt(miniprofile) + 561197960265728);
}

function gameTimeStamp(steamTime) {
  // Convert string like "Played on May 27 @ 10:33 PM for 43 minutes" into timestamp
  var regex = /on (.+) (\d+) @ (\d+):(\d+) (\w\w)/;
  var match = regex.exec(steamTime);

  if (match !== null) {
    var date = new Date();
    var year = date.getFullYear();
    var month = match[1];
    var day = match[2];
    var hours = match[3];
    var minutes = match[4];
    if (match[5] == "PM") hours = (parseInt(hours) + 12) % 24;
    // Only time when year can be not current are last two weeks of December:
    if (month == "Dec" && date.getMonth() == 1) {
      year--;
    }
    return Number(new Date(`${day} ${month} ${year} ${hours}:${minutes}`));
  } else {
    // "Played today @ 10:46 AM	for 1 minute"
    regex = /Played today @ (\d+):(\d+) (\w\w)/;
    match = regex.exec(steamTime);
    if (match !== null) {
      var hours = match[1];
      var minutes = match[2];
      if (match[3] == "PM") hours = (parseInt(hours) + 12) % 24;
      var now = new Date();
      var gameTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      return Number(gameTime);
    }
  }
}

// Steam allows us to see last 14 days, we'll terminate loop if we find one already recorded game
function scanPage(pageNumber, gamesArray, pagesAvailable) {
  var thisPageHasOldGames = false;
  fetch("http://steamcommunity.com/my/friends/coplay/?p=" + pageNumber + "&l=en", {
    credentials: 'include'
  })
  .then((response) => response.text())
  .then(function(htmlString){
    document.body.innerHTML = htmlString;
    var parser = new DOMParser();
    htmlDOM = parser.parseFromString(htmlString, "text/html");
    htmlDOM.querySelectorAll(".coplayGroup").forEach(function(coplayGroup){
      var gameTime = gameTimeStamp(coplayGroup.querySelector(".gameListRowItem").textContent);
      if (gameTime <= lastRecordedGameTime) {
        thisPageHasOldGames = true; // this page contains a game that was already recorded, marking it so we don't scan all pages after it
        return;
      } else {
        var steamAppLink = coplayGroup.querySelector(".gameLogo > a").getAttribute("href");
        var steamAppID = steamAppLink.substring(steamAppLink.lastIndexOf("/") + 1, steamAppLink.length); //Game.appid
        var players = []; // Game.players

        coplayGroup.querySelectorAll('.friendBlock').forEach(function(playerBlock) {
          var miniprofile = playerBlock.getAttribute("data-miniprofile");
          var name = playerBlock.querySelector(":nth-child(4)").firstChild.nodeValue.trim();
          if (players.filter(e => e.miniprofile == miniprofile).length == 0) {
            // Sometimes if player reconnected during a match he is shown twice in
            // recently played page, we add only unique ones
            players.push(new Player(miniprofile, name, false));
          }
        });

        var thisGame = new Game(gameTime, steamAppID, players);
        gamesArray.push(thisGame);
      }

    });
    console.log("Page " + pageNumber + " scanned.");
    if (pageNumber < pagesAvailable && !thisPageHasOldGames) {
      scanPage(pageNumber + 1, gamesArray, pagesAvailable);
    } else {
      if (thisPageHasOldGames) console.log ("This page contained one or more games that were already scanned, no need to scan next pages.")
      console.log("All pages were scanned, now saving everything to storage.");
      doneScanning(gamesArray);
    }
  });
}

function pagesToScan (gamesArray) {
  fetch("http://steamcommunity.com/my/friends/coplay?l=en", {
    credentials: 'include'
  })
  .then((response) => response.text())
  .then(function(htmlString) {
    document.body.innerHTML = htmlString;
    var parser = new DOMParser();
    htmlDOM = parser.parseFromString(htmlString, "text/html");
    if (htmlDOM.querySelector(".pagingPageLink") == undefined) {
      pagesAvailable = 1;
    } else {
      var pagination = htmlDOM.querySelectorAll(".pagingPageLink");
      pagesAvailable = pagination[pagination.length-1].text;
    }
    console.log("Starting to scan pages. " + pagesAvailable + " pages available.");
    scanPage (1, gamesArray, pagesAvailable);
  });
}

function doneScanning(gamesArray) {
  // This is called when we scanned all pages.
  // Here we sort the array of games scanned by time in descending oreder
  // before adding them to chrome.storage
  gamesArray.sort(function(a, b) {
    return b.time - a.time;
  });
  if (emptyStorage) {
    allRecordedGames = gamesArray;
  } else {
    allRecordedGames = gamesArray.concat(allRecordedGames);
  }
  chrome.storage.local.set({'games': allRecordedGames}, function() {
    console.log("Saved " + gamesArray.length + " new game" + (gamesArray.length == 1 ? "." : "s."));
    console.log("Now start checking recorded profiles for bans...");
    banCheckProfiles();
  });
}

function startScanningRoutine() {
  chrome.storage.local.get('games', function(data) {
    allRecordedGames = data.games;
    console.log(allRecordedGames);
    if (typeof allRecordedGames === 'undefined' || allRecordedGames === 0) {
      emptyStorage = true;
    } else {
      emptyStorage = false; // important!
      lastRecordedGameTime = allRecordedGames[0].time;
    }
    console.log("Last recorded game: " + lastRecordedGameTime);
    var gamesArray = [];
    pagesToScan(gamesArray);
  });
}


function scanGames(players, games, apikey, iteration) {
  var startFrom = 0;
  if (players.length > 100) {
    startFrom = iteration * 100;
  }
  listOfSteamID64 = [];
  for (var i = startFrom; i < (startFrom + 100); i++) {
    if (i >= players.length) break;
    listOfSteamID64.push(players[i].steamid);
  }
  fetchURL = 'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=' + apikey
           + '&steamids=' + listOfSteamID64.join(',');
  fetch(fetchURL)
  .then(response => response.json())
  .then(function(response){
    response.players.forEach(function(player){
      if (player.NumberOfVACBans > 0 || player.NumberOfGameBans > 0) {
        // Player has vac or game ban .Now we need to figure out if he was banned
        // after we recorded that game or before. If it was before we do nothing,
        // that is most likely ban from some other game that player already had.
        var timeSinceLastBan = player.DaysSinceLastBan * 24 * 60 * 60 * 1000 ; //in ms
        var endOfToday = Number( new Date().setHours(23,59,59,999) );
        var timeLastBan = endOfToday - timeSinceLastBan;

        // Find recorded game with this player
        var gameRecordedTime;
        games.forEach(function(game){
          game.players.forEach(function(gamePlayer){
            if (gamePlayer.steamid == player.SteamId) {
              gameRecordedTime = game.time;
              if (timeLastBan > gameRecordedTime && !gamePlayer.bannedAfterRecording){
                // Busted!
                Busted(gamePlayer, player.NumberOfVACBans, player.NumberOfGameBans);
              }
            }
          });
        });
      }
    });
    if (players.length > iteration*100 + 100) {
      setTimeout(function(){
        scanGames(players, games, apikey, iteration+1);
      }, 1000);
    } else {
      var rightNow = Number (new Date());
      games.forEach(function(gameScanned){
          var indexOfScannedGame = -1;
          for (var i=0; i < allRecordedGames.length; i++) {
            if (allRecordedGames[i].time == gameScanned.time
                && allRecordedGames[i].appid == gameScanned.appid
                && allRecordedGames[i].players.length == gameScanned.players.length
            ) {
              indexOfScannedGame = i;
              break;
            }
          }
          if (indexOfScannedGame > -1){
            console.log(allRecordedGames[indexOfScannedGame]);
            allRecordedGames[indexOfScannedGame].lastScanTime = rightNow;
          }
      });
      console.log (allRecordedGames);
      console.log ("Updated time for scanned games");
      chrome.storage.local.set({'lastTimeScanned': rightNow, 'games': allRecordedGames}, function() {
        console.log("Done for now.");
      });
    }
  });
}

function Busted(player, vacBans, gameBans) {
  // Player object is not a part of stored array, we need to find
  // every occurrence of player.steamid (in case we played with together multiple times)
  // in stored array and set bannedAfterRecording to true.
  // We'll also notify user about this, including time passed since the last game played together.
  var notified = false;
  var steamIdToFind = player.steamid;
  allRecordedGames.forEach(function(game){
    game.players.forEach(function(player){
      if (player.steamid == steamIdToFind) {
        player.bannedAfterRecording = true;
        if (!notified){
          notified = true; // we'll notify only for the last game played together with this player
          BanNotification(player, game, vacBans, gameBans);
        }
      }
    });
  });
  console.log ("Marked banned player.");
}

function BanNotification(player, game, vacBans, gameBans){
  chrome.permissions.contains({
    permissions: ['notifications']
  }, function(notificationsGranted) {
    if (notificationsGranted) {
      chrome.storage.sync.get(["notificationsSetting"], function(data) {
        if (typeof data['notificationsSetting'] == 'undefined' || data.notificationsSetting == 'false'){
          console.log ('We have notifications permissions but settings were disabled.');
        } else {
          var name = player.name;
          var lastTimePlayed = new Date(game.time);
          var banType = "banned";
          if (vacBans == 0){
            if (game.appid == 730) {
              banType = "an Overwatch ban";
            } else {
              banType = "a Game ban";
            }
          } else if (gameBans == 0) {
            banType = "VAC banned";
          }
          var text = "Player " + name + " got " + banType + ". Last time you played together: " + lastTimePlayed + ".";
          chrome.notifications.clear("banchecker_ban_notification", function() {
            var notificationObj = {
              type: "basic",
              title: "Ban Checker for Steam",
              message: text,
              iconUrl: "ow128.png"
            };
            chrome.notifications.create("banchecker_ban_notification", notificationObj, function() {
              console.log("Notification sent.");
            });
          });
        }
      });
    } else {
      console.log("Notifications permissions were not granted.");
    }
  });
}

function testNotification(){
  chrome.storage.local.get('games', function(data) {
    var game = data.games[0];
    var player = game.players[0];
    BanNotification(player, game, 5, 0);
    setTimeout(function(){
      BanNotification(player, game, 0, 5);
      setTimeout(function(){
        BanNotification(player, game, 5, 5);
      }, 5000);
    }, 5000);
  });
}

function banCheckProfiles() {
  // We can scan 100 profiles with one API call.
  // "You are limited to one hundred thousand (100,000) calls to the Steam Web API per day."
  // There are 56000 users of this extensions at the moment, so if every single one of them checks
  // two times a day - it's already over the limit. We'll scan periodically only for people
  // who provided their own API key. Otherwise scan only once a day last 100 profiles.
  var providedCustomAPIKey = false;

  chrome.storage.sync.get(["customapikey"], function(data) {
    if (typeof data['customapikey'] == 'undefined'){
      var defaultkeys = ["5DA40A4A4699DEE30C1C9A7BCE84C914",
      				"5970533AA2A0651E9105E706D0F8EDDC",
      				"2B3382EBA9E8C1B58054BD5C5EE1C36A"];
    	var apikey = defaultkeys[Math.floor(Math.random() * 3)];
    } else {
      providedCustomAPIKey = true;
      var apikey = data['customapikey'];
    }

    if (!providedCustomAPIKey) {
      chrome.storage.local.get(["lastTimeScanned"], function(lastTimeScannedData){
        console.log("Last time scanned: " + new Date(lastTimeScannedData.lastTimeScanned));
        var rightNow = Number(new Date());
        var yesterdaySameTime = rightNow - 24*60*60*1000;
        if (lastTimeScannedData.lastTimeScanned > yesterdaySameTime && lastTimeScannedData.lastTimeScanned != undefined){
          console.log ("No custom API key provided and not enough time passed since last scan.");
          return;
        }
        else {
          if (lastTimeScannedData.lastTimeScanned == undefined) lastTimeScannedData.lastTimeScanned = 0;
          // get latest games with hundred players or less to scan
          if (typeof allRecordedGames === 'undefined' || allRecordedGames.length === 0) {
            console.log("Nothing to scan, storage is empty.")
          } else {
            var gamesToScan = [];
            var playersToScan = [];
            allRecordedGames.forEach(function(game){
              if (playersToScan.length > 99) return;
              game.players.forEach(function(player){
                if (playersToScan.length > 99){
                  return;
                } else {
                  playersToScan.push(player);
                }
              });
              gamesToScan.push(game);
            });
            console.log("These players will be scanned now:"); console.log(playersToScan);
            console.log("From these games:"); console.log(gamesToScan);
            scanGames(playersToScan, gamesToScan, apikey, 0);
          }
        }
      });
    } else {
      // For people with their own API key we'll scan every recorded game in a loop.
      // Each routine cycle we'll scan latest 200 players (to give priority to the most recent games)
      // and 800 older ones, keeping track on the latest scanned game so we continue from that point.
      // That's 10 API calls, Dota 2 dev forums suggest to have 1 second delay between each call.
      if (typeof allRecordedGames === 'undefined' || allRecordedGames.length === 0) {
        console.log("Nothing to scan, storage is empty.")
      } else {
        // This array will store 10 arrays (or less if not enough games recorded).
        // Each array inside contains games with 100 players or less
        var BatchesOfGamesToScan = [];
        var gamesToScan = [];
        var playersToScan = [];
        var lastScannedGameTime; // time of the last recorded match during previous scan

        // 200 players from recent matches:
        allRecordedGames.forEach(function(game){
          if (playersToScan.length > 199) reutrn;
          game.players.forEach(function(player){
            if (playersToScan.length > 199){
              return;
            } else {
              playersToScan.push(player);
            }
          });
          gamesToScan.push(game);
        });

        // 800 players from older matches:
        chrome.storage.local.get('lastScannedGameTime', function(dataL) {
          if (typeof dataL.lastScannedGameTime === 'undefined') {
            console.log("No time recorded of prevous games.");
            lastScannedGameTime = gamesToScan[gamesToScan.length-1].time;
          } else {
            lastScannedGameTime = dataL.lastScannedGameTime;
            if (gamesToScan[gamesToScan.length-1].time < lastScannedGameTime) {
              lastScannedGameTime = gamesToScan[gamesToScan.length-1].time
            }
          }

          var lastGame = false;
          allRecordedGames.forEach(function(game){
            if (lastScannedGameTime < game.time) {
              return;
            } else if (lastScannedGameTime == game.time){
              //this is the last recorded game
              lastGame = true;
            }
            if (playersToScan.length > 999) reutrn;
            game.players.forEach(function(player){
              if (playersToScan.length > 999){
                return;
              } else {
                playersToScan.push(player);
              }
            });
            gamesToScan.push(game);
            lastScannedGameTime = game.time;
          });
          chrome.storage.local.set({'lastScannedGameTime': lastScannedGameTime}, function() {
            console.log("These players will be scanned now:"); console.log(playersToScan);
            console.log("From these games:"); console.log(gamesToScan);
            scanGames(playersToScan, gamesToScan, apikey, 0);
          });
        });
      }
    }
  });
}

// Initially we'll scan after 5 minute of Chrome starting, then every 2 hours.
chrome.alarms.create("historyRecordRoutine", {delayInMinutes: 5, periodInMinutes: 120});

// For testing:
//chrome.alarms.create("historyRecordRoutine", {delayInMinutes: 0.2, periodInMinutes: 1});
//chrome.storage.local.clear(function(){startScanningRoutine()}); // Test with empty storage

chrome.alarms.onAlarm.addListener(function(alarm){
  if (alarm.name == "historyRecordRoutine"){
    startScanningRoutine();
  }
});

chrome.runtime.onInstalled.addListener(function(details){
  console.log(details.previousVersion);
  if (details.previousVersion < '1.0.6'){
	console.log("old version detected, removing storage data...");
	chrome.storage.local.clear();
  }
});
