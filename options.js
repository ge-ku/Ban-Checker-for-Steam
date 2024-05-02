function saveOptions() {
  var customapikey = document.getElementById('customapikey').value;
  if (document.getElementById('radioCustom').checked && customapikey != '') {
    //use custom key
    chrome.storage.sync.set({ customapikey: customapikey }, function () {
      chrome.storage.sync.set(
        {
          greentext: !document.getElementById('chkGreentext').checked,
          showcommunitybans: document.getElementById('chkCommunityBans').checked
        },
        function () {
          var status = document.getElementById('statusSaved');
          status.style.visibility = 'visible';
          setTimeout(function () {
            status.style.visibility = 'hidden';
          }, 750);
        }
      );
    });
  } else if (
    document.getElementById('radioDefault').checked ||
    customapikey == ''
  ) {
    //use default key
    chrome.storage.sync.remove('customapikey', function () {
      chrome.storage.sync.set(
        {
          greentext: !document.getElementById('chkGreentext').checked,
          showcommunitybans: document.getElementById('chkCommunityBans').checked
        },
        function () {
          var status = document.getElementById('statusSaved');
          status.style.visibility = 'visible';
          document.getElementById('radioDefault').checked = true;
          document.getElementById('customapikey').value = '';
          setTimeout(function () {
            status.style.visibility = 'hidden';
          }, 750);
        }
      );
    });
  }
}

function restoreOptions() {
  chrome.storage.sync.get(
    ['customapikey', 'greentext', 'showcommunitybans'],
    function (data) {
      if (typeof data['customapikey'] == 'undefined') {
      } else {
        document.getElementById('customapikey').value = data['customapikey'];
        document.getElementById('radioCustom').checked = true;
      }
      if (typeof data['greentext'] == 'undefined') {
      } else if (data['greentext'] == false) {
        document.getElementById('chkGreentext').checked = true;
      }
      if (typeof data['showcommunitybans'] == 'undefined') {
      } else if (data['showcommunitybans'] == true) {
        document.getElementById('chkCommunityBans').checked = true;
      }
    }
  );
}

function getPermissions() {
  chrome.permissions
    .request({
      origins: ['*://steamcommunity.com/*', 'https://api.steampowered.com/*']
    })
    .then(() => {
      location.reload();
    });
}

function initOptions() {
  restoreOptions();
  document.getElementById('save').addEventListener('click', saveOptions);

  chrome.permissions?.contains(
    {
      origins: ['*://steamcommunity.com/*', 'https://api.steampowered.com/*']
    },
    hasPermissions => {
      if (!hasPermissions) {
        document.querySelector('#permissions').style.display = 'block';
        document
          .getElementById('grantPermissions')
          .addEventListener('click', getPermissions);
      }
    }
  );
}

if (
  document.location.protocol != 'http:' &&
  document.location.protocol != 'https:'
) {
  document.addEventListener('DOMContentLoaded', initOptions);
}
