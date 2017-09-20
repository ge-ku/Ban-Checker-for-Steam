const loadMoreValue = 15; // How many games to load each increment
var gamesShowingIndex = 0; // Index of a last game shown

// Add links to Ban Checker page
var banCheckerButton = document.createElement('a');
banCheckerButton.setAttribute('href', "//steamcommunity.com/my/friends/banchecker");
banCheckerButton.className = 'sectionTab';
var banCheckerButtonText = document.createElement('span');
banCheckerButtonText.appendChild(document.createTextNode('Ban Checker'));
banCheckerButton.appendChild(banCheckerButtonText);

var banCheckerMobileButton = document.createElement('option');
banCheckerMobileButton.value = "//steamcommunity.com/my/friends/banchecker";
banCheckerMobileButton.appendChild(document.createTextNode('Ban Checker'));
document.querySelector('.responsive_tab_select').appendChild(banCheckerMobileButton);

// Inject options.html if user opens settings from Ban Checker page 
// These are functions to show and hide settings
var settingsInjected = false;

// First time settings button is pressed inject part of options.html and show it
// If settings already injected just show them
function showSettings() {
  if (settingsInjected) {
    var settingsShade = document.getElementById('settingsShade');
    var settingsDiv = document.getElementById('settingsDiv');
    settingsShade.className = 'fadeIn';
    settingsDiv.className = 'fadeIn';
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
  settingsShade.className = 'fadeOut';
  settingsDiv.className = 'fadeOut';
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
  var friendBlockLinkOverlay = document.createElement('a');
  friendBlockLinkOverlay.href = '//steamcommunity.com/profiles/' + player.steamid;
  friendBlockLinkOverlay.className = 'friendBlockLinkOverlay';
  playerBody.appendChild(friendBlockLinkOverlay);
  var avatar = document.createElement('div');
  avatar.className = 'playerAvatar';
  // We'll load avatars like this so we don't waste Steam API calls
  fetch('http://steamcommunity.com/profiles/' + player.steamid + '?xml=1')
    .then(response => response.text())
    .then(function (xml) {
      var regex = /http:\/\/(.+)_medium.jpg/;
      var avatarURLs = xml.match(regex);
      if (avatarURLs != null) {
        var avatarURL = avatarURLs[0];
        avatarImgTag = document.createElement('img');
        avatarImgTag.src = avatarURL;
        avatar.appendChild(avatarImgTag);
      }
      var thisPlayer = document.querySelectorAll('.friendBlock[data-miniprofile="' + player.miniprofile + '"]');
      thisPlayer.forEach(function (thisOne) {
        if (thisOne.querySelector('.playerAvatar') == null) {
          thisOne.insertAdjacentElement('afterbegin', avatar);
        };
      });
    });
  var name = document.createElement('div');
  name.appendChild(document.createTextNode(player.name));
  var playerStatus = document.createElement('span');
  playerStatus.className = 'friendSmallText';
  name.appendChild(document.createElement('br'));
  name.appendChild(playerStatus);
  if (player.bannedAfterRecording) {
    playerBody.style.backgroundColor = "rgba(230,0,0,0.3)";
    var daysSinceLastBan = (Date.now() - player.lastBanTime) / (1000 * 60 * 60 * 24);
    var daysSinceLastBanMessage = 'Banned ' + Math.round(daysSinceLastBan) + ' days ago.';
    playerStatus.appendChild(document.createTextNode(daysSinceLastBanMessage));
  }
  playerBody.appendChild(name);
  return playerBody;
}

// This function returns DOM element which contains info about one game
// It show when the game was played, when last scan occured and info about each player
function createGameElement(game) {
  var gameBody = document.createElement('div');
  gameBody.className = 'coplayGroup';

  var gameInfo = document.createElement('div');
  gameInfo.className = 'gameListRow';

  var gameImage = document.createElement('div');
  gameImage.className = 'gameListRowLogo';

  var gameLogoHolder_default = document.createElement('div');
  gameLogoHolder_default.className = 'gameLogoHolder_default';
  var gameLogo = document.createElement('div');
  gameLogo.className = 'gameLogo';
  var logoLink = document.createElement('a');
  logoLink.href = 'http://steamcommunity.com/app/' + game.appid;
  var logoImg = document.createElement('img');
  logoImg.src = '//cdn.akamai.steamstatic.com/steam/apps/' + game.appid + '/header.jpg';
  logoLink.appendChild(logoImg);
  gameLogo.appendChild(logoLink);
  gameLogoHolder_default.appendChild(gameLogo);
  gameImage.appendChild(gameLogoHolder_default);

  var gameAbout = document.createElement('div');
  gameAbout.className = 'gameListRowItem';

  var gameAboutAppName = document.createElement('h4');
  gameAboutAppName.textContent = 'AppID: ' + game.appid;
  gameAbout.appendChild(gameAboutAppName);
  gameAbout.appendChild(document.createElement('br'));

  var textNodePlayed = document.createTextNode(
    'Played: ' + new Date(game.time)
  );
  gameAbout.appendChild(textNodePlayed);
  gameAbout.appendChild(document.createElement('br'));
  var textNodeScanned = document.createTextNode(
    'Last Time Scanned: ' + ((game.lastScanTime == 0) ? 'Never' : new Date(game.lastScanTime))
  )
  gameAbout.appendChild(textNodeScanned);

  gameInfo.appendChild(gameImage);
  gameInfo.appendChild(gameAbout);
  gameBody.appendChild(gameInfo);

  playersBody = document.createElement('div');
  playersBody.className = 'responsive_friendblocks';

  game.players.forEach(function (player) {
    playersBody.appendChild(createPlayerElement(player));
  });

  gameBody.appendChild(playersBody);

  gameBody.insertAdjacentHTML('beforeend', '<div style="clear: left;"></div>');
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
  extensionInfo.insertAdjacentHTML('beforeend', filterGames);
  body.appendChild(extensionInfo);

  var main = document.createElement('div');
  main.className = 'main';
  body.appendChild(main);

  var pagination = document.createElement('div');
  pagination.className = 'banchecker-pagination';
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