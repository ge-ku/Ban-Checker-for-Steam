var loadMoreValue = 15; // How many games to load each increment
var gamesShowingIndex = 0; // Index of a last game shown

// Add links to Ban Checker page
var banCheckerButton = document.createElement('a');
banCheckerButton.setAttribute('href', "//steamcommunity.com/my/friends/banchecker");
banCheckerButton.classList.add('sectionTab');
banCheckerButton.innerHTML = "<span>Ban Checker</span>";
document.querySelector('.responsive_tab_select').innerHTML += '<option value="//steamcommunity.com/my/friends/banchecker">Ban Checker</option>';

// Inject options.html if user opens settings from Ban Checker page 
// These are functions to show and hide settings
var settingsInjected = false;

// First time settings button is pressed inject part of options.html and show it
// If settings already injected just show them
function showSettings() {
  if (settingsInjected) {
    var settingsShade = document.getElementById('settingsShade');
    var settingsDiv = document.getElementById('settingsDiv');
    // Not yet! chrome 61+
    //settingsShade.classList.replace('fadeOut', 'fadeIn');
    //settingsDiv.classList.replace('fadeOut', 'fadeIn');
    settingsShade.classList.remove('fadeOut');
    settingsShade.classList.add('fadeIn');
    settingsDiv.classList.remove('fadeOut');
    settingsDiv.classList.add('fadeIn');
  } else {
    settingsInjected = true;
    fetch(chrome.extension.getURL('/options.html'))
      .then((resp) => resp.text())
      .then(function (settingsHTML) {
        var settingsDiv = document.createElement('div');
        settingsDiv.id = 'settingsDiv';
        settingsDiv.innerHTML = settingsHTML;
        document.body.appendChild(settingsDiv);
        var settingsShade = document.createElement('div');
        settingsShade.id = 'settingsShade';
        settingsShade.addEventListener('click', hideSettings);
        document.body.appendChild(settingsShade);
        initOptions();
        showSettings();
      });
  }
}
function hideSettings() {
  var settingsShade = document.getElementById('settingsShade');
  var settingsDiv = document.getElementById('settingsDiv');
  // Not yet! chrome 61+
  //settingsShade.classList.replace('fadeIn', 'fadeOut');
  //settingsDiv.classList.replace('fadeOut', 'fadeIn');
  settingsShade.classList.remove('fadeIn');
  settingsShade.classList.add('fadeOut');
  settingsDiv.classList.remove('fadeIn');
  settingsDiv.classList.add('fadeOut');
}

// If this page is BanChecker page (ends with "/banchecker")
// we actually start showing out content, as well as indicate it visually
if (window.location.pathname.split("/").pop() == 'banchecker') {
  document.querySelector('.sectionTabs a:first-child').classList.remove('active');
  banCheckerButton.classList.add('active');
  renderBanCheker();
}
document.querySelector('.sectionTabs').appendChild(banCheckerButton);

// This function returns DOM element which contains info about one player
// It's called from createGameElement function for each player of a game
function createPlayerElement(player) {
  var playerBody = document.createElement('div');
  playerBody.classList.add('friendBlock', 'persona');
  if (player.bannedAfterRecording) playerBody.classList.add('banned');
  playerBody.setAttribute('data-miniprofile', player.miniprofile);
  playerBody.setAttribute('href', "//steamcommunity.com/profiles/" + player.steamid);
  playerBody.innerHTML = '<a class="friendBlockLinkOverlay" href="//steamcommunity.com/profiles/' + player.steamid + '"></a>';
  var avatar = document.createElement('div');
  avatar.classList.add('playerAvatar');
  // We'll load avatars like this so we don't waste Steam API calls
  fetch('http://steamcommunity.com/profiles/' + player.steamid + '?xml=1')
    .then(response => response.text())
    .then(function (xml) {
      var regex = /http:\/\/(.+)_medium.jpg/;
      var avatarURLs = xml.match(regex);
      if (avatarURLs != null) {
        var avatarURL = avatarURLs[0];
        avatar.innerHTML = '<img src=' + avatarURL + '>';
      }
      var thisPlayer = document.querySelectorAll('.friendBlock[data-miniprofile="' + player.miniprofile + '"]');
      thisPlayer.forEach(function (thisOne) {
        if (thisOne.querySelector('.playerAvatar') == null) {
          thisOne.insertAdjacentElement('afterbegin', avatar);
        };
      });
    });
  var name = document.createElement('div');
  name.innerHTML = player.name;
  playerBody.appendChild(name);
  if (player.bannedAfterRecording) {
    playerBody.style.backgroundColor = "rgba(230,0,0,0.3)";
  }
  return playerBody;
}

// This function returns DOM element which contains info about one game
// It show when the game was played, when last scan occured and info about each player
function createGameElement(game) {
  var gameBody = document.createElement('div');
  gameBody.classList.add('coplayGroup');

  var gameInfo = document.createElement('div');
  gameInfo.classList.add('gameListRow');

  var gameImage = document.createElement('div');
  gameImage.classList.add('gameListRowLogo');
  gameImage.innerHTML = '<div class="gameLogoHolder_default"><div class="gameLogo"><a href="http://steamcommunity.com/app/' + game.appid + '"><img src="//cdn.akamai.steamstatic.com/steam/apps/' + game.appid + '/header.jpg"></a></div></div>';

  var gameAbout = document.createElement('div');
  gameAbout.classList.add('gameListRowItem');
  gameAbout.innerHTML = "<h4>AppID: " + game.appid + "</h4><br/>Played: " + new Date(game.time)
    + "<br/>Last Time Scanned: " + ((game.lastScanTime == 0) ? 'Never' : new Date(game.lastScanTime));

  gameInfo.appendChild(gameImage);
  gameInfo.appendChild(gameAbout);
  gameBody.appendChild(gameInfo);

  playersBody = document.createElement('div');
  playersBody.classList.add('responsive_friendblocks');

  game.players.forEach(function (player) {
    playersBody.appendChild(createPlayerElement(player));
  });

  gameBody.appendChild(playersBody);

  gameBody.innerHTML += '<div style="clear: left;"></div>';
  return gameBody;
}

// This function renders games that correspond to selected filters
// and continues to render next batches of games when needed
function gamesRendering(div, appid, bannedOnly, tenPlayers, allPages) {
  chrome.storage.local.get('games', function (data) {
    if (typeof data.games === 'undefined' || data.games.length === 0) {
      div.innerHTML = 'No recorded games yet.';
    } else {
      if (gamesShowingIndex == data.games.length) {
        var message = document.querySelector('#paginationNoMore');
        message.style.visibility = 'visible';
        setTimeout(function () {
          message.style.visibility = 'hidden';
        }, 500);
        return;
      }
      div.classList.add('profile_friends');
      var lastGameToShowThisCycle;
      if (allPages) {
        lastGameToShowThisCycle = data.games.length;
      } else {
        lastGameToShowThisCycle = gamesShowingIndex + loadMoreValue;
      }
      for (var i = gamesShowingIndex; i < lastGameToShowThisCycle && i < data.games.length; i++) {
        var game = data.games[i];
        if ((appid == 0 || game.appid == appid) && (tenPlayers == false || (tenPlayers == true && game.players.length == 9))) {
          if (bannedOnly) {
            var showThis = false;
            game.players.forEach(function (player) {
              if (player.bannedAfterRecording) showThis = true;
            });
            if (showThis) {
              div.appendChild(createGameElement(game));
            }
            else lastGameToShowThisCycle++; //not showing the game (no banned players) so we shift last games index forward
          } else {
            div.appendChild(createGameElement(game));
          }
        } else {
          lastGameToShowThisCycle++; //not showing the game so we shift last games index forward
        }
        gamesShowingIndex++; //move index forward, doesn't matter if we show this game or not
      }
    }
  });
}

// This function clears all shown games and starts counter from start
// It's called initially and when new filter is applied
function initiateGamesRendering(div, appid, bannedOnly, tenPlayers) {
  div.innerHTML = '';
  gamesShowingIndex = 0;
  gamesRendering(div, appid, bannedOnly, tenPlayers, false);
}

// This function calls gamesRendering to load more games with old filters
// If allPages parameter is set to 'true' it will tell gamesRendering to
// load ALL available pages
function loadMore(allPages) {
  var appidFilter = document.querySelector('#appidFilter');
  var newFilter = document.querySelector('#gamesAvailable').value;
  var mainDiv = document.querySelector('div.main');
  var bannedOnly = document.querySelector('#checkbox').checked;
  if (newFilter == 'custom') {
    document.querySelector('#appidFilter').style.display = 'inline';
    newFilter = appidFilter.value;
  } else {
    document.querySelector('#appidFilter').style.display = 'none';
  }
  switch (newFilter) {
    case '730_ten':
      gamesRendering(mainDiv, 730, bannedOnly, true, allPages);
      break;
    default:
      gamesRendering(mainDiv, newFilter, bannedOnly, false, allPages);
      break;
  }
}

// This function is called when new filter is applied
function applyFilter() {
  var appidFilter = document.querySelector('#appidFilter');
  var newFilter = document.querySelector('#gamesAvailable').value;
  var mainDiv = document.querySelector('div.main');
  var bannedOnly = document.querySelector('#checkbox').checked;
  if (newFilter == 'custom') {
    document.querySelector('#appidFilter').style.display = 'inline';
    newFilter = appidFilter.value;
  } else {
    document.querySelector('#appidFilter').style.display = 'none';
  }
  switch (newFilter) {
    case '730_ten':
      initiateGamesRendering(mainDiv, 730, bannedOnly, true);
      break;
    default:
      initiateGamesRendering(mainDiv, newFilter, bannedOnly, false);
      break;
  }
}

// This function prepares UI, it's called only from /banchecker page
function renderBanCheker() {
  var body = document.querySelector('.responsive_friendblocks_ctn');
  body.innerHTML = '';

  var extensionInfo = document.createElement('div');
  extensionInfo.style.paddingBottom = "1.5em";
  var InfoMessage = `<p>This page will show only those bans which occured after you played together.</p>
                     <p>Extension records games periodically every few hours, they don't appear here immediately.</p>
                     <p>With your own Steam API key extension will periodically scan every recorded game for recent bans.<br>
                     Without the key it will only scan last 100 players once a day. You can set your API key in <span class="openSettings" style="text-decoration:underline; cursor:pointer">settings</span>.</p>`;
  extensionInfo.innerHTML = InfoMessage;

  var filterGames = `<label style="padding-right: 4em"><input type="checkbox" id="checkbox">Games with banned players only</label>
  Filter by game:
  <select id="gamesAvailable">
    <option value="0">All games</option>
    <option value="730">CS:GO</option>
    <option value="730_ten">CS:GO with 10 players</option>
    <option value="570">Dota 2</option>
    <option value="440">Team Fortress 2</option>
    <option value="custom">Filter by appid</option>
  </select>
  <input id="appidFilter" style="display:none" type="text" value="" placeholder="appid, for example 730"/>`;
  extensionInfo.innerHTML += filterGames;
  body.appendChild(extensionInfo);

  var main = document.createElement('div');
  main.classList.add('main');
  body.appendChild(main);

  var pagination = document.createElement('div');
  pagination.classList.add('banchecker-pagination');
  pagination.innerHTML = `<input id="loadMore" type="button" value="Load ` + loadMoreValue + ` more games">
                          <input id="loadAll" type="button" value="Load all games (may lag)">
                          <div id="paginationNoMore" style="visibility:hidden; padding-top:.5em">No more games to load</div>`;
  body.appendChild(pagination);
  document.querySelector('#loadMore').addEventListener("click", function () { loadMore(false) });
  document.querySelector('#loadAll').addEventListener("click", function () { loadMore(true) });

  document.querySelector('#gamesAvailable').addEventListener("change", applyFilter);
  document.querySelector('#appidFilter').addEventListener("change", applyFilter);
  document.querySelector('#checkbox').addEventListener("change", applyFilter);

  document.querySelector('.openSettings').addEventListener('click', showSettings);

  initiateGamesRendering(main, 0, false, false);
}