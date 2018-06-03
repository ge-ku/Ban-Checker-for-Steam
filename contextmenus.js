let context_api, tabs_api;
if (chrome) {
  context_api = chrome.contextMenus;
  tabs_api = chrome.tabs;
} else if (browser) {
  context_api = browser.menus;
  tabs_api = browser.tabs;
} else {
  throw new Error('Could not find browser extension sdk');
}

const actions = {
  'csgo-matches': 'https://steamcommunity.com/my/gcpd/730?tab=matchhistorycompetitive',
  'community-friends': 'https://steamcommunity.com/my/friends/',
  'community-groups': 'https://steamcommunity.com/my/groups/',
  'github': 'https://github.com/ge-ku/Ban-Checker-for-Steam',
  'community-recently': 'https://steamcommunity.com/my/friends/coplay/'
};
const context_listener = (info, tab) => {
  if (info.menuItemId in actions) {
    tabs_api.create({'url':actions[info.menuItemId]});
  }
};
const context_defs = [
  {
    id: 'community-friends',
    type: 'normal',
    title: 'Steam Friends'
  },
  {
    id: 'community-groups',
    type: 'normal',
    title: 'Steam Groups'
  },
  {
    id: 'community-recently',
    type: 'normal',
    title: 'Recently Played With'
  },
  {
    id: 'csgo-matches',
    type: 'normal',
    title: 'CS:GO match history'
  },
  {
    id: 'separator-1',
    type: 'separator'
  },
  {
    id: 'github',
    type: 'normal',
    title: 'Github page'
  }
];
context_defs.forEach((context) => {
  context['contexts'] = ['browser_action','page_action'];
  context_api.create(context);
})
context_api.onClicked.addListener(context_listener);
