let continue_token = null;
let sessionid = null;
let profileURI = null;

let providedCustomAPIKey = false;
let apikey = '';

const banStats = {
    vacBans: 0,
    gameBans: 0
}

const getSteamID64 = minProfile => '76' + (parseInt(minProfile) + 561197960265728);

const statusBar = document.createElement('div');
statusBar.style.margin = '8px 0';
statusBar.style.whiteSpace = 'pre-wrap';
const updateStatus = (text, accumulate) => {
    if (accumulate) {
        statusBar.textContent = statusBar.textContent + '\n' + text; 
    } else {
        statusBar.textContent = text;
    }
}

const initVariables = () => {
    const profileAnchor = document.querySelector('#global_actions .user_avatar');
    if (!profileAnchor) {
        updateStatus('Error: .user_avatar element was not found');
    }
    profileURI = profileAnchor.href;
    if (!document.querySelector('#load_more_button')) {
        updateStatus('No "LOAD MORE HISTORY" button is present, seems like there are no more matches');
    }
    const steamContinueScript = document.querySelector('#personaldata_elements_container+script');
    const matchContinueToken = steamContinueScript.text.match(/g_sGcContinueToken = '(\d+)'/);
    if (!matchContinueToken) {
        updateStatus('Error: g_sGcContinueToken was not found');
    }
    continue_token = matchContinueToken[1];
    const steamSessionScript = document.querySelector('#global_header+script');
    const matchSessionID = steamSessionScript.text.match(/g_sessionID = "(.+)"/);
    if (!matchSessionID) {
        updateStatus('Error: g_sessionID was not found');
    }
    sessionid = matchSessionID[1];
}

const funStatsBar = document.createElement('div');
funStatsBar.style.whiteSpace = 'pre-wrap';
const updateStats = () => {
    let totalKills = 0;
    let totalAssists = 0;
    let totalDeaths = 0;
    
    const profileURItrimmed = profileURI.replace(/\/$/, '');
    const myAnchors = document.querySelectorAll(`.inner_name .playerAvatar a[href="${profileURItrimmed}"]`);
    myAnchors.forEach(anchorEl => {
        myMatchStats = anchorEl.closest('tr').querySelectorAll('td');
        totalKills += parseInt(myMatchStats[2].textContent, 10);
        totalAssists += parseInt(myMatchStats[3].textContent, 10);
        totalDeaths += parseInt(myMatchStats[4].textContent, 10);
    });
    funStatsBar.textContent = 'Some fun stats for loaded matches:\n' +
                              `Total kills: ${totalKills}\n` +
                              `Total assists: ${totalAssists}\n` +
                              `Total deaths: ${totalDeaths}\n` + 
                              `K/D: ${(totalKills/totalDeaths).toFixed(3)} | ` + 
                              `(K+A)/D: ${((totalKills+totalAssists)/totalDeaths).toFixed(3)}`;
}

const formatMatchTables = () => {
    document.querySelectorAll('.csgo_scoreboard_inner_right:not(.banchecker-formatted)').forEach(table => {
        table.querySelectorAll('tbody > tr').forEach((tr, i) => {
            if (i === 0 || tr.childElementCount < 3) return;
            const minProfile = tr.querySelector('.linkTitle').dataset.miniprofile;
            const steamID64 = getSteamID64(minProfile);
            tr.dataset.steamid64 = steamID64;
            tr.classList.add('banchecker-profile');
        });
        table.classList.add('banchecker-formatted');
    });
}

const fetchMatchHistoryPage = (recursively, page) => {
    document.querySelector('#load_more_button').style.display = 'none';
    document.querySelector('#inventory_history_loading').style.display = 'block';
    fetch (`${profileURI}gcpd/730?ajax=1&tab=matchhistorycompetitive&continue_token=${continue_token}&sessionid=${sessionid}`,
        {
            credentials: "same-origin"
        })
    .then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw Error(res.statusText);
        }
    })
    .then(json => {
        if (json.continue_token) {
            continue_token = json.continue_token;
        } else {
            updateStatus('No continue_token returned from Steam, looks like there are no more matches to load!');
            continue_token = null;
        }
        const parser = new DOMParser(); // todo: don't create new parser for each request
        const newData = parser.parseFromString(json.html, 'text/html');
        newData.querySelectorAll('.csgo_scoreboard_root > tbody > tr').forEach((tr, i) => {
            if (i > 0) document.querySelector('.csgo_scoreboard_root').appendChild(tr);
        })
        updateStats();
        formatMatchTables();
        if (recursively && continue_token) {
            updateStatus(`Loaded ${page ? page + 1 : 1} page${page ? 's' : ''} ` + 
                         `(${document.querySelectorAll('.val_left').length} matches)...`);
            fetchMatchHistoryPage(true, page ? page + 1 : 1);
        } else if (!continue_token) {
            document.querySelector('#inventory_history_loading').style.display = 'none';
        } else {
            document.querySelector('#load_more_button').style.display = 'inline-block';
            document.querySelector('#inventory_history_loading').style.display = 'none';
        }
    })
    .catch((error) => {
        updateStatus(`Error while loading match history: ${error}`);
        document.querySelector('#load_more_button').style.display = 'inline-block';
        document.querySelector('#inventory_history_loading').style.display = 'none';
    })
}

const fetchMatchHistory = () => {
    if (continue_token && sessionid && profileURI) {
        console.log(`Continue token: ${continue_token} | SessionID: ${sessionid} | Profile: ${profileURI}`);
        updateStatus('Loading Match history...')
        fetchMatchHistoryPage(true);
    }
}

const checkBans = (players) => {
    const uniquePlayers = [...new Set(players)];
    let batches = uniquePlayers.reduce((arr, player, i) => {
        const batchIndex = Math.floor(i/100);
        if (!arr[batchIndex]) {
            arr[batchIndex] = [player];
        } else {
            arr[batchIndex].push(player);
        }
        return arr;
    }, []);
    updateStatus(`Loaded unchecked matches contain ${uniquePlayers.length} players.\n` + 
                 `We can scan 100 players at a time so we're sending ${batches.length} ` +
                 `request${batches.length > 1 ? 's' : ''}.`);
    const fetchBatch = (i) => {
        fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${apikey}&steamids=${batches[i].join(',')}`)
            .then(res => res.json())
            .then(json => {
                json.players.forEach(player => {
                    let verdict = '';
                    if (player.NumberOfVACBans > 0) {
                        verdict += 'VAC';
                        banStats.vacBans++;
                    }
                    if (player.NumberOfGameBans > 0) {
                        if (verdict) verdict += ' & ';
                        verdict += 'Game';
                        banStats.gameBans++;
                    }
                    const playerEls = document.querySelectorAll(`tr[data-steamid64="${player.SteamId}"]`);
                    playerEls.forEach(playerEl => {
                        playerEl.classList.add('banchecker-checked');
                        verdictEl = playerEl.querySelector('.banchecker-bans');
                        if (verdict) {
                            verdictEl.style.color = 'red';
                            verdictEl.style.cursor = 'help';
                            verdictEl.textContent = verdict;
                            verdictEl.title = `Days since last ban: ${player.DaysSinceLastBan}`;
                        } else {
                            verdictEl.textContent = '';
                        }
                    })
                })
                if (batches.length > i+1 && providedCustomAPIKey) {
                    setTimeout(() => fetchBatch(i+1), 1000);
                }
                else if (batches.length > i+1 && !providedCustomAPIKey) {
                    updateStatus('You did not provide your own Steam API key, only 100 players were scanned!', true);
                } else {
                    updateStatus(`Looks like we're done!\n` + 
                                `There were ${banStats.vacBans} VAC banned and ${banStats.gameBans} ` + 
                                `Game banned players in games we scanned.\n` +
                                `Note that not every one of those bans occured after you played together. ` +
                                `They could receive a ban in some other game previously.\nHover over ban status ` + 
                                `to check how many days passed since last ban.\n` + 
                                `Marking only those who received a ban after playing with you is planned.`);
                }
            })
    }
    fetchBatch(0);
}

const checkLoadedMatchesForBans = () => {
    const tables = document.querySelectorAll('.banchecker-formatted:not(.banchecker-withcolumn)');
    tables.forEach(table => {
        table.classList.add('banchecker-withcolumn');
        table.querySelectorAll('tr').forEach((tr, i) => {
            if (i === 0) {
                const bansHeader = document.createElement('th');
                bansHeader.textContent = 'Bans';
                tr.appendChild(bansHeader);
            } else if (tr.childElementCount > 3) {
                const bansPlaceholder = document.createElement('td');
                bansPlaceholder.classList.add('banchecker-bans');
                bansPlaceholder.textContent = '?';
                tr.appendChild(bansPlaceholder);
            }
        });;
    })
    const playersEl = document.querySelectorAll('.banchecker-profile:not(.banchecker-checked):not(.banchecker-checking)');
    let playersArr = [];
    playersEl.forEach(player => {
        player.classList.add('banchecker-checking');
        playersArr.push(player.dataset.steamid64);
    })
    checkBans(playersArr);
}

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
    }
    button.onmouseout = () => {
        button.style.backgroundColor = 'rgba( 103, 193, 245, 0.2 )';
        button.style.color = '#66c0f4';
    }
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
}

const fetchButton = createSteamButton('Load whole match history');
fetchButton.onclick = () => {
    fetchMatchHistory();
    fetchButton.onclick = () => {
        updateStatus('This button was already pressed. Reload the page if you want to start over.');
    }
}
menu.appendChild(fetchButton);

const checkBansButton = createSteamButton('Check loaded matches for bans');
checkBansButton.onclick = () => {
    checkLoadedMatchesForBans();
    if (!providedCustomAPIKey) checkBansButton.onclick = null;
}
chrome.storage.sync.get(['customapikey'], data => {
    if (typeof data.customapikey === 'undefined'){
        const defaultkeys = [
            '5DA40A4A4699DEE30C1C9A7BCE84C914',
      		'5970533AA2A0651E9105E706D0F8EDDC',
            '2B3382EBA9E8C1B58054BD5C5EE1C36A',
        ];
        apikey = defaultkeys[Math.floor(Math.random() * 3)];
        statusBar.textContent = 'Only 100 players from the most recent matches will be scanned without providing your own API key!'
    } else {
        providedCustomAPIKey = true;
        apikey = data.customapikey;
    }
    fetchButton.insertAdjacentElement('afterend', checkBansButton);
});


menu.appendChild(statusBar);

//updateStats();
menu.appendChild(funStatsBar);

document.querySelector('#subtabs').insertAdjacentElement('afterend', menu);

initVariables();
formatMatchTables();

const loadMoreButton = document.querySelector('#load_more_button');
document.querySelector('.load_more_history_area').appendChild(loadMoreButton);
document.querySelector('.load_more_history_area a').remove();
loadMoreButton.onclick = () => fetchMatchHistoryPage();


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
            .then((resp) => resp.text())
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
}
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
}
const bancheckerSettingsButton = createSteamButton('Set Steam API key');
bancheckerSettingsButton.onclick = () => showSettings();
statusBar.insertAdjacentElement('beforeBegin', bancheckerSettingsButton);