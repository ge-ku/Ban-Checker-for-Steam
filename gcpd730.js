let continue_token = null;
let sessionid = null;
let profileURI = null;
let tabURIparam = 'matchhistorycompetitive';

const maxRetries = 3;

let loadingWholeHistoryCounter = 0;
let loadingWholeHistory = false;

let providedCustomAPIKey = false;
let apikey = '';

const banStats = {
  vacBans: 0,
  gameBans: 0,
  recentBans: 0
};

const funStats = {
  numberOfMatches: 0,
  totalKills: 0,
  totalAssists: 0,
  totalDeaths: 0,
  totalWins: 0,
  totalWaitTime: 0,
  totalTime: 0
};

let waitTimeRowIndex = 3;
let timeRowIndex = 4;

const getSteamID64 = minProfile =>
  '76' + (parseInt(minProfile) + 561197960265728);

const parseTime = time => {
  let timeSecs = 0;
  if (time.includes(':')) {
    const i = time.indexOf(':');
    timeSecs += parseInt(time.substr(0, i)) * 60;
    timeSecs += parseInt(time.substr(i + 1));
  } else {
    timeSecs += parseInt(time);
  }
  return timeSecs;
};
const timeString = time => {
  let secs = time;
  const days = Math.floor(secs / (24 * 60 * 60));
  secs %= 86400;
  const hours = Math.floor(secs / (60 * 60))
    .toString()
    .padStart(2, '0');
  secs %= 3600;
  const mins = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  secs %= 60;
  secs = secs.toString().padStart(2, '0');

  let result = `${hours}:${mins}:${secs}`;
  if (days) result = `${days.toString()}d ${result}`;
  return result;
};

const statusBar = document.createElement('div');
statusBar.style.margin = '8px 0';
statusBar.style.whiteSpace = 'pre-wrap';
const updateStatus = (text, accumulate) => {
  if (accumulate) {
    statusBar.textContent = statusBar.textContent + '\n' + text;
  } else {
    statusBar.textContent = text;
  }
};

const initVariables = () => {
  const profileAnchor = document.querySelector('#global_actions .user_avatar');
  if (!profileAnchor) {
    updateStatus('Error: .user_avatar element was not found');
  }
  profileURI = profileAnchor.href;
  if (!document.querySelector('#load_more_button')) {
    updateStatus(
      'No "LOAD MORE HISTORY" button is present, seems like there are no more matches'
    );
  }
  const steamContinueScript = document.querySelector(
    '#personaldata_elements_container+script'
  );
  const matchContinueToken = steamContinueScript.text.match(
    /g_sGcContinueToken = '(\d+)'/
  );
  if (!matchContinueToken) {
    updateStatus('Error: g_sGcContinueToken was not found');
  }
  continue_token = matchContinueToken[1];
  const scriptTags = document.querySelectorAll('script');
  let matchSessionID = false;
  for (const scriptTag of scriptTags) {
    let g_sessionID = scriptTag.text.match(/g_sessionID = "(.+)"/);
    if (g_sessionID != null) {
      matchSessionID = g_sessionID;
      break;
    }
  }
  if (!matchSessionID) {
    updateStatus('Error: g_sessionID was not found');
  }
  sessionid = matchSessionID[1];
  const tabOnEl = document.querySelector('.tabOn');
  if (tabOnEl) {
    tabURIparam = tabOnEl.parentNode.id.split('_').pop();
  }

  if (tabURIparam === 'matchhistoryscrimmage') {
    waitTimeRowIndex = 2;
    timeRowIndex = 3;
  }

  if (typeof content !== 'undefined') fetch = content.fetch; // fix for Firefox with disabled third-party cookies
};

const funStatsBar = document.createElement('div');
funStatsBar.style.whiteSpace = 'pre-wrap';
funStatsBar.style.backgroundColor = 'rgba(17, 25, 35, .9)';
funStatsBar.style.borderRadius = '5px';
funStatsBar.style.border = '1px solid #000';
funStatsBar.style.padding = '14px';
funStatsBar.style.position = 'fixed';
funStatsBar.style.left = '0';
funStatsBar.style.bottom = '0';
funStatsBar.style.margin = '4px';
funStatsBar.style.zIndex = '9';

const updateStats = () => {
  if (tabURIparam === 'playerreports' || tabURIparam === 'playercommends')
    return;
  const profileURItrimmed = profileURI.replace(/\/$/, '');
  const myAnchors = document.querySelectorAll(
    '.inner_name .playerAvatar ' +
      `a[href="${profileURItrimmed}"]:not(.banchecker-counted)`
  );
  myAnchors.forEach(anchorEl => {
    myMatchStats = anchorEl.closest('tr').querySelectorAll('td');
    funStats.totalKills += parseInt(myMatchStats[2].textContent, 10);
    funStats.totalAssists += parseInt(myMatchStats[3].textContent, 10);
    funStats.totalDeaths += parseInt(myMatchStats[4].textContent, 10);
    anchorEl.classList.add('banchecker-counted');
  });
  const matchesData = document.querySelectorAll(
    '.val_left:not(.banchecker-counted)'
  );
  funStats.numberOfMatches += matchesData.length;
  matchesData.forEach(matchData => {
    matchData.querySelectorAll('td').forEach((dataEl, index) => {
      if (index < 2) return;
      const data = dataEl.innerText.trim();
      if (data.includes(':')) {
        const i = data.indexOf(':');
        const value = data.substr(i + 1);
        if (index === waitTimeRowIndex) {
          funStats.totalWaitTime += parseTime(value);
        } else if (index === timeRowIndex) {
          funStats.totalTime += parseTime(value);
        }
      }
    });
    matchData.classList.add('banchecker-counted');
  });
  funStatsBar.textContent =
    'Some fun stats for loaded matches:\n' +
    `Number of matches: ${funStats.numberOfMatches}\n` +
    `Total kills: ${funStats.totalKills}\n` +
    `Total assists: ${funStats.totalAssists}\n` +
    `Total deaths: ${funStats.totalDeaths}\n` +
    `K/D: ${(funStats.totalKills / funStats.totalDeaths).toFixed(3)} | ` +
    `(K+A)/D: ${(
      (funStats.totalKills + funStats.totalAssists) /
      funStats.totalDeaths
    ).toFixed(3)}\n` +
    `Total wait time: ${timeString(funStats.totalWaitTime)}\n` +
    `Total match time: ${timeString(funStats.totalTime)}`;
};

const formatMatchTables = () => {
  const daysSince = dateString => {
    const matchDate = dateString.match(
      /(20\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)/
    );
    let daysSinceMatch = -1;
    if (matchDate.length > 6) {
      const year = parseInt(matchDate[1], 10);
      const month = parseInt(matchDate[2], 10) - 1;
      const day = parseInt(matchDate[3], 10);
      const hour = parseInt(matchDate[4], 10);
      const minute = parseInt(matchDate[5], 10);
      const second = parseInt(matchDate[6], 10);
      const matchDateObj = new Date(year, month, day, hour, minute, second);
      const matchDayTime = matchDateObj.getTime();
      const currentTime = Date.now();
      const timePassed = currentTime - matchDayTime;
      daysSinceMatch = Math.ceil(timePassed / (1000 * 60 * 60 * 24));
    }
    return daysSinceMatch;
  };
  if (tabURIparam === 'playerreports' || tabURIparam === 'playercommends') {
    document
      .querySelectorAll(
        '.generic_kv_table > tbody > tr:not(:first-child):not(.banchecker-profile)'
      )
      .forEach(report => {
        const dateEl = report.querySelector('td:first-child');
        const daysSinceMatch = daysSince(dateEl.textContent);
        const minProfile =
          report.querySelector('.linkTitle').dataset.miniprofile;
        report.dataset.steamid64 = getSteamID64(minProfile);
        report.dataset.dayssince = daysSinceMatch;
        report.classList.add('banchecker-profile');
        report.classList.add('banchecker-formatted');
      });
  } else {
    document
      .querySelectorAll(
        '.csgo_scoreboard_inner_right:not(.banchecker-formatted)'
      )
      .forEach(table => {
        const leftColumn = table.parentElement.parentElement.querySelector(
          '.csgo_scoreboard_inner_left'
        );
        const daysSinceMatch = daysSince(leftColumn.textContent);
        table.querySelectorAll('tbody > tr').forEach((tr, i) => {
          if (i === 0 || tr.childElementCount < 3) return;
          const minProfile = tr.querySelector('.linkTitle').dataset.miniprofile;
          const steamID64 = getSteamID64(minProfile);
          tr.dataset.steamid64 = steamID64;
          tr.dataset.dayssince = daysSinceMatch;
          tr.classList.add('banchecker-profile');
        });
        table.classList.add('banchecker-formatted');
      });
  }
};

const fetchMatchHistory = () => {
  updateStatus('Loading Match history...');
  loadingWholeHistory = true;
  const continueTextEl = document.querySelector(
    '#load_more_button_continue_text'
  );
  const callback = (mutationList, observer) => {
    for (const mutation of mutationList) {
      if (mutation.attributeName === 'style') {
        if (loadMoreButton.style.display === 'none') {
          updateStatus('Looks like we fetched all available matches!', true);
        }
      }
    }
  };
  const continueTextObserver = new MutationObserver(callback);
  continueTextObserver.observe(continueTextEl, { attributes: true });
  document.querySelector('#load_more_button').click();
};

const checkBans = players => {
  const uniquePlayers = [...new Set(players)];
  let batches = uniquePlayers.reduce((arr, player, i) => {
    const batchIndex = Math.floor(i / 100);
    if (!arr[batchIndex]) {
      arr[batchIndex] = [player];
    } else {
      arr[batchIndex].push(player);
    }
    return arr;
  }, []);
  const fetchBatch = (i, retryCount) => {
    updateStatus(
      `Loaded unchecked matches contain ${uniquePlayers.length} players.\n` +
        `We can scan 100 players at a time so we're sending ${batches.length} ` +
        `request${batches.length > 1 ? 's' : ''}.\n` +
        `${i} successful request${i === 1 ? '' : 's'} so far...`
    );

    chrome.runtime.sendMessage(
      chrome.runtime.id,
      {
        action: 'fetchBans',
        apikey: apikey,
        batch: batches[i]
      },
      (json, error) => {
        if (error !== undefined) {
          updateStatus(
            `Error while scanning players for bans:\n${error}` +
              `${
                retryCount !== undefined && retryCount > 0
                  ? `\n\nRetrying to scan... ${maxRetries - retryCount}/3`
                  : `\n\nCouldn't scan for bans after ${maxRetries} retries :(`
              }`
          );
          if (retryCount > 0) {
            setTimeout(() => fetchBatch(i, retryCount - 1), 3000);
          }
          return;
        }
        json.players.forEach(player => {
          const playerEls = document.querySelectorAll(
            `tr[data-steamid64="${player.SteamId}"]`
          );
          const daySinceLastMatch = parseInt(
            playerEls[0].dataset.dayssince,
            10
          );
          let verdict = '';
          if (player.NumberOfVACBans > 0) {
            verdict += 'VAC';
            banStats.vacBans++;
          }
          if (player.NumberOfGameBans > 0) {
            if (verdict) verdict += ' &\n';
            verdict += 'Game';
            banStats.gameBans++;
          }
          if (verdict) {
            const daysAfter = daySinceLastMatch - player.DaysSinceLastBan;
            if (daySinceLastMatch > player.DaysSinceLastBan) {
              banStats.recentBans++;
              verdict += '+' + daysAfter;
            } else {
              verdict += daysAfter;
            }
          }
          playerEls.forEach(playerEl => {
            playerEl.classList.add('banchecker-checked');
            verdictEl = playerEl.querySelector('.banchecker-bans');
            if (verdict) {
              if (daySinceLastMatch > player.DaysSinceLastBan) {
                verdictEl.style.color = 'red';
              } else {
                verdictEl.style.color = 'grey';
              }
              verdictEl.style.cursor = 'help';
              verdictEl.textContent = verdict;
              verdictEl.title = `Days since last ban: ${player.DaysSinceLastBan}`;
            } else {
              verdictEl.textContent = '';
            }
          });
        });
        if (batches.length > i + 1 && providedCustomAPIKey) {
          setTimeout(() => fetchBatch(i + 1), 1000);
        } else if (batches.length > i + 1 && !providedCustomAPIKey) {
          updateStatus(
            `Looks like we're done.\n\n` +
              `Loaded unchecked matches contain ${uniquePlayers.length} players.\n` +
              'You did not provide your own Steam API key, only 100 players were scanned!'
          );
        } else {
          updateStatus(
            `Looks like we're done.\n\n` +
              `There were ${banStats.recentBans} players who got banned after playing with you!\n\n` +
              `Total ban stats: ${banStats.vacBans} VAC banned and ${banStats.gameBans} ` +
              `Game banned players in games we scanned (a lot of these could happen outside of CS:GO.)\n` +
              `Total amount of unique players encountered: ${uniquePlayers.length}` +
              `\n\nHover over ban status to check how many days have passed since last ban.`
          );
        }
      }
    );
  };
  fetchBatch(0, maxRetries);
};

const checkLoadedMatchesForBans = () => {
  if (tabURIparam === 'playerreports' || tabURIparam === 'playercommends') {
    const tableHeader = document.querySelector(
      '.generic_kv_table > tbody > tr:first-child'
    );
    if (!tableHeader.classList.contains('banchecker-withcolumn')) {
      tableHeader.classList.add('banchecker-withcolumn');
      const bansHeader = document.createElement('th');
      bansHeader.textContent = 'Ban';
      tableHeader.appendChild(bansHeader);
    }
    const uncheckedPlayers = document.querySelectorAll(
      '.generic_kv_table > tbody > tr:not(.banchecker-withcolumn)'
    );
    uncheckedPlayers.forEach(tr => {
      tr.classList.add('banchecker-withcolumn');
      const bansPlaceholder = document.createElement('td');
      bansPlaceholder.classList.add('banchecker-bans');
      bansPlaceholder.textContent = '?';
      tr.appendChild(bansPlaceholder);
    });
  } else {
    const tables = document.querySelectorAll(
      '.banchecker-formatted:not(.banchecker-withcolumn)'
    );
    tables.forEach(table => {
      table.classList.add('banchecker-withcolumn');
      table.querySelectorAll('tr').forEach((tr, i) => {
        if (i === 0) {
          const bansHeader = document.createElement('th');
          bansHeader.textContent = 'Bans';
          bansHeader.style.minWidth = '5.6em';
          tr.appendChild(bansHeader);
        } else if (tr.childElementCount > 3) {
          const bansPlaceholder = document.createElement('td');
          bansPlaceholder.classList.add('banchecker-bans');
          bansPlaceholder.textContent = '?';
          tr.appendChild(bansPlaceholder);
        } else {
          const scoreboard = tr.querySelector('td');
          if (scoreboard) scoreboard.setAttribute('colspan', '9');
        }
      });
    });
  }
  const playersEl = document.querySelectorAll(
    '.banchecker-profile:not(.banchecker-checked):not(.banchecker-checking)'
  );
  let playersArr = [];
  playersEl.forEach(player => {
    player.classList.add('banchecker-checking');
    playersArr.push(player.dataset.steamid64);
  });
  checkBans(playersArr);
};

const menu = document.createElement('div');
menu.style.padding = '0 14px';
menu.id = 'banchecker-menu';

const createSteamButton = (text, iconURI) => {
  const button = document.createElement('div');
  // pullup_item class style replication using js
  // TODO: move to separate css file for sanity
  button.style.display = 'inline-block';
  button.style.backgroundColor = 'rgba( 103, 193, 245, 0.2 )';
  button.style.padding = '3px 8px 0px 0px';
  button.style.borderRadius = '2px';
  button.style.marginRight = '6px';
  button.style.cursor = 'pointer';
  button.style.lineHeight = '18px';
  button.style.color = '#66c0f4';
  button.style.fontSize = '11px';
  button.onmouseover = () => {
    button.style.backgroundColor = 'rgba( 102, 192, 244, 0.4 )';
    button.style.color = '#ffffff';
  };
  button.onmouseout = () => {
    button.style.backgroundColor = 'rgba( 103, 193, 245, 0.2 )';
    button.style.color = '#66c0f4';
  };
  const iconEl = document.createElement('div');
  iconEl.className = 'menu_ico';
  iconEl.style.display = 'inline-block';
  iconEl.style.verticalAlign = 'top';
  iconEl.style.padding = iconURI ? '1px 7px 0 6px' : '1px 8px 0 0';
  iconEl.style.minHeight = '22px';
  if (iconURI) {
    const image = document.createElement('img');
    image.src = iconURI;
    image.width = '16';
    image.height = '16';
    image.border = '0';
    iconEl.appendChild(image);
  }
  button.appendChild(iconEl);
  const textNode = document.createTextNode(text);
  button.appendChild(textNode);
  return button;
};

const fetchButton = createSteamButton('Load whole match history');
fetchButton.onclick = () => {
  fetchMatchHistory();
  fetchButton.onclick = () => {
    updateStatus(
      'This button was already pressed. Reload the page if you want to start over.'
    );
  };
};
menu.appendChild(fetchButton);

const checkBansButton = createSteamButton('Check loaded matches for bans');
checkBansButton.onclick = () => {
  checkLoadedMatchesForBans();
  if (!providedCustomAPIKey) checkBansButton.onclick = null;
};
chrome.storage.sync.get(['customapikey'], data => {
  if (typeof data.customapikey === 'undefined') {
    const defaultkeys = [
      '5DA40A4A4699DEE30C1C9A7BCE84C914',
      '5970533AA2A0651E9105E706D0F8EDDC',
      '2B3382EBA9E8C1B58054BD5C5EE1C36A'
    ];
    apikey = defaultkeys[Math.floor(Math.random() * 3)];
    statusBar.textContent =
      'Only 100 players from the most recent matches will be scanned without providing your own API key!';
  } else {
    providedCustomAPIKey = true;
    apikey = data.customapikey;
  }
  fetchButton.insertAdjacentElement('afterend', checkBansButton);
});

menu.appendChild(statusBar);
menu.appendChild(funStatsBar);

document.querySelector('#subtabs').insertAdjacentElement('afterend', menu);

initVariables();
formatMatchTables();
updateStats();

const loadMoreButton = document.querySelector(
  '.load_more_history_area #load_more_clickable'
);
const callback = (mutationList, observer) => {
  for (const mutation of mutationList) {
    if (mutation.attributeName === 'style') {
      if (loadMoreButton.style.display !== 'none') {
        formatMatchTables();
        updateStats();
        if (loadingWholeHistory) {
          loadingWholeHistoryCounter++;
          updateStatus(
            `Loading Match history... Pages loaded: ${loadingWholeHistoryCounter}`
          );
          loadMoreButton.click();
        }
      }
    }
  }
};
const observer = new MutationObserver(callback);
observer.observe(loadMoreButton, { attributes: true });

// embed settings
let settingsInjected = false;
const showSettings = () => {
  if (settingsInjected) {
    const settingsShade = document.getElementById('settingsShade');
    const settingsDiv = document.getElementById('settingsDiv');
    settingsShade.className = 'fadeIn';
    settingsDiv.className = 'fadeIn';
  } else {
    settingsInjected = true;
    fetch(chrome.extension.getURL('/options.html'))
      .then(resp => resp.text())
      .then(settingsHTML => {
        const settingsDiv = document.createElement('div');
        settingsDiv.id = 'settingsDiv';
        settingsDiv.innerHTML = settingsHTML;
        document.body.appendChild(settingsDiv);
        const settingsShade = document.createElement('div');
        settingsShade.id = 'settingsShade';
        settingsShade.addEventListener('click', hideSettings);
        document.body.appendChild(settingsShade);
        initOptions();
        showSettings();
      });
  }
};
const hideSettings = () => {
  const settingsShade = document.getElementById('settingsShade');
  const settingsDiv = document.getElementById('settingsDiv');
  settingsShade.className = 'fadeOut';
  settingsDiv.className = 'fadeOut';
  chrome.storage.sync.get(['customapikey'], data => {
    if (typeof data.customapikey !== 'undefined' && !providedCustomAPIKey) {
      location.reload();
    } else {
      updateStatus('Reload the page if you changed API key!');
    }
  });
};
const bancheckerSettingsButton = createSteamButton('Set Steam API key');
bancheckerSettingsButton.onclick = () => showSettings();
statusBar.insertAdjacentElement('beforeBegin', bancheckerSettingsButton);
