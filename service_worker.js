// Context menus
chrome.runtime.onInstalled.addListener(() => {
  const context_defs = [
    {
      id: 'community-friends',
      title: 'Steam Friends'
    },
    {
      id: 'community-groups',
      title: 'Steam Groups'
    },
    {
      id: 'community-recently',
      title: 'Recently Played With'
    },
    {
      id: 'cs-premier-matches',
      title: 'Counter-Strike Premier Matches'
    },
    {
      id: 'cs-competitive-matches',
      title: 'Counter-Strike Ranked Competitive Matches'
    },
    {
      id: 'github',
      title: 'Github page'
    }
  ];
  for (const def of context_defs) {
    chrome.contextMenus.create({ ...def, contexts: ['action'] });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const actions = {
    'cs-competitive-matches':
      'https://steamcommunity.com/my/gcpd/730?tab=matchhistorycompetitivepermap',
    'cs-premier-matches':
      'https://steamcommunity.com/my/gcpd/730?tab=matchhistorypremier',
    'community-friends': 'https://steamcommunity.com/my/friends/',
    'community-groups': 'https://steamcommunity.com/my/groups/',
    github: 'https://github.com/ge-ku/Ban-Checker-for-Steam',
    'community-recently': 'https://steamcommunity.com/my/friends/coplay/'
  };
  if (info.menuItemId in actions) {
    chrome.tabs.create({ url: actions[info.menuItemId] });
  }
});

// Fetch bans using Steam API
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == 'fetchBans') {
    fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${
        request.apikey
      }&steamids=${request.batch.join(',')}`
    )
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          throw Error(`Code ${res.status}. ${res.statusText}`);
        }
      })
      .then(data => sendResponse(data))
      .catch(error => sendResponse(undefined, error));
  }
  return true;
});
