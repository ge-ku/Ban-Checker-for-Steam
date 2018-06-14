const maxRetries = 3;
let apikey = '';
let greentext = true;

checkBans = () => {
    const friendEls = document.querySelectorAll('.friends_content .persona');
    let list = [];
    friendEls.forEach(persona => {
        list.push(persona.dataset.steamid);
    });
    const uniquePlayers = [...new Set(list)];
    let batches = uniquePlayers.reduce((arr, player, i) => {
        const batchIndex = Math.floor(i/100);
        if (!arr[batchIndex]) {
            arr[batchIndex] = [player];
        } else {
            arr[batchIndex].push(player);
        }
        return arr;
    }, []);

    const fetchBatch = (i, retryCount) => {
        fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${apikey}&steamids=${batches[i].join(',')}`)
            .then(res => {
                if (res.ok) {
                    return res.json();
                } else {
                    throw Error(`Code ${res.status}. ${res.statusText}`);
                }
            })
            .then(json => {
                json.players.forEach(player => {
                    playerEls = document.querySelectorAll(`.friends_content .persona[data-steamid="${player.SteamId}"`);
                    playerEls.forEach(playerEl => {
                        let verdict = '';
                        let verdictEl = document.createElement('span');
                        if (player.NumberOfVACBans > 0) {
                            verdict += 'VAC';
                        }
                        if (player.NumberOfGameBans > 0) {
                            if (verdict) verdict += ' & ';
                            verdict += 'Game Ban';
                        } 
                        if (!verdict) {
                            if (greentext) {
                                verdict = 'No bans for this player';
                                verdictEl.style.color = 'green';
                            }                            
                        } else {
                            verdict += ` ${player.DaysSinceLastBan} day${player.DaysSinceLastBan > 1 ? 's' : ''} ago.`;
                            verdictEl.style.color = 'red';
                        }
                        verdictEl.textContent = verdict;
                        playerEl.querySelector('.friend_block_content').appendChild(verdictEl);
                    });
                })
                if (batches.length > i+1) {
                    setTimeout(() => fetchBatch(i+1), 1000);
                } else {
                    console.log('Looks like we\'re done.');
                }
            })
            .catch((error) => {
                console.log(`Error while scanning players for bans:\n${error}` +
                `${retryCount !== undefined && retryCount > 0 ? `\n\nRetrying to scan... ${maxRetries - retryCount}/3`
                                                              : `\n\nCouldn't scan for bans after ${maxRetries} retries :(`}`);
                if (retryCount > 0) {
                    setTimeout(() => fetchBatch(i, retryCount - 1), 3000);
                }
            });
    }
    fetchBatch(0, maxRetries);
}

const defaultkeys = ['5DA40A4A4699DEE30C1C9A7BCE84C914',
				     '5970533AA2A0651E9105E706D0F8EDDC',
				     '2B3382EBA9E8C1B58054BD5C5EE1C36A'];

chrome.storage.sync.get(['customapikey', 'greentext'], function(data) {
    if (typeof data['greentext'] == 'undefined'){
        chrome.storage.sync.set({
            'greentext': true
        });
    } else {
        greentext = data['greentext'];
    }
    if (typeof data['customapikey'] == 'undefined'){
        apikey = defaultkeys[Math.floor(Math.random() * 3)];
    } else {
        apikey = data['customapikey'];
    }
    checkBans();
});

let container = document.querySelector('.friends_content');
const callback = (mutationsList) => {
    for (let mutation of mutationsList) {
        if (!mutation.target.classList.contains('loading')) checkBans();
    }
};
const observer = new MutationObserver(callback);
observer.observe(container, {attributes: true});