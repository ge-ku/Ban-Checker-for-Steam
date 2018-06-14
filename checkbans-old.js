// Javascript does not work well with integers greater than 53 bits precision... So we need
// to do our maths using strings.
function getDigit(x, digitIndex) {
    return (digitIndex >= x.length) ? "0" : x.charAt(x.length - digitIndex - 1);
}
function prefixZeros(strint, zeroCount) {
    var result = strint;
    for (var i = 0; i < zeroCount; i++) {
        result = "0" + result;
    }
    return result;
}
//Only works for positive numbers, which is fine in our use case.
function add(x, y) {
    var maxLength = Math.max(x.length, y.length);
    var result = "";
    var borrow = 0;
    var leadingZeros = 0;
    for (var i = 0; i < maxLength; i++) {
        var lhs = Number(getDigit(x, i));
        var rhs = Number(getDigit(y, i));
        var digit = lhs + rhs + borrow;
        borrow = 0;
        while (digit >= 10) {
            digit -= 10;
            borrow++;
        }
        if (digit === 0) {
            leadingZeros++;
        } else {
            result = String(digit) + prefixZeros(result, leadingZeros);
            leadingZeros = 0;
        }
    }
    if (borrow > 0) {
        result = String(borrow) + result;
    }
    return result;
}

function getId(friend) {
    var steam64identifier = "76561197960265728";
    var miniProfileId = friend.attributes.getNamedItem('data-miniprofile').value;
    return add(steam64identifier, miniProfileId);
}

var friends = [].slice.call(document.querySelectorAll('#memberList .member_block, #memberManageList .member_block, .friendHolder, .friendBlock '));
var lookup = {};

friends.forEach(function(friend) {
    var id = getId(friend);
    if (!lookup[id]) {
        lookup[id] = [];
    }
    lookup[id].push(friend);
});

function setVacation(player) {
    var friendElements = lookup[player.SteamId];

    friendElements.forEach(function(friend) {
        var inGameText = friend.querySelector('.linkFriend_in-game');
        var span = document.createElement('span');
        span.style.fontWeight = 'bold';
        span.style.display = 'block';

        if (inGameText) {
            var inGameTextSeparator = document.createTextNode(' - ');
            inGameText.replaceChild(inGameTextSeparator, inGameText.querySelector('br'));
        }

        if (player.NumberOfVACBans || player.NumberOfGameBans) {
            var text = '';

            if (player.NumberOfGameBans) {
                text += player.NumberOfGameBans + ' OW ban' + (player.NumberOfGameBans > 1 ? 's' : '');
            }

            if (player.NumberOfVACBans) {
                text += (text === '' ? '' : ', ') + player.NumberOfVACBans + ' VAC ban' + (player.NumberOfVACBans > 1 ? 's' : '');
            }
            text += ' ' + player.DaysSinceLastBan + ' day' + (player.DaysSinceLastBan > 1 ? 's' : '') + ' ago.';

            span.style.color = 'rgb(255, 73, 73)';
            span.textContent = text;
        } else if (greentext){
            span.style.color = 'rgb(43, 203, 64)';
            span.textContent = 'No Bans for this player.';
        }

        friend.querySelector('.friendSmallText').appendChild(span);
    });
}

function onData(xmlHttp) {
    if (xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200) {
        var data = JSON.parse(xmlHttp.responseText);
        data.players.forEach(setVacation);
    }
}

function makeApiCall(ids, apikey) {
    var xmlHttp = new XMLHttpRequest();
    //API only allows 100 steam ids at once.
    var endpointRoot = 'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key='+apikey+'&steamids=';
    var endpoint = endpointRoot + ids.join(',');

    xmlHttp.onreadystatechange = function() { onData(xmlHttp); };
    xmlHttp.open('GET', endpoint, true);
    xmlHttp.send();
}

var defaultkeys = ["5DA40A4A4699DEE30C1C9A7BCE84C914",
				"5970533AA2A0651E9105E706D0F8EDDC",
				"2B3382EBA9E8C1B58054BD5C5EE1C36A"];
var greentext = true;
chrome.storage.sync.get(["customapikey", "greentext"], function(data) {
if (typeof data['greentext'] == 'undefined'){
	chrome.storage.sync.set({
		'greentext': true
	});
} else {
	greentext = data['greentext'];
}
if (typeof data['customapikey'] == 'undefined'){
	var apikey = defaultkeys[Math.floor(Math.random() * 3)];
}else{
	var apikey = data['customapikey'];
}
var ids = Object.keys(lookup);
while (ids.length > 0) {
	var batch = ids.splice(0, 100);
	makeApiCall(batch, apikey);
}
});