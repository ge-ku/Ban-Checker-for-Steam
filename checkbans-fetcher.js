chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action == "fetchBans")  {
    	fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${request.apikey}&steamids=${request.batch.join(',')}`)
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
