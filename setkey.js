function save_options() {
  var customapikey = document.getElementById('customapikey').value;
  if(document.getElementById('radioCustom').checked && customapikey != '') {
  //use custom key
	chrome.storage.sync.set({"customapikey": customapikey}, function() {
		chrome.storage.sync.set({"greentext": !(document.getElementById('chkGreentext').checked)}, function() {
			var status = document.getElementById('status');
			status.textContent = 'Options saved.';
			setTimeout(function() {
				status.innerHTML = '<br>';
			}, 750);
		});
	});
  }else if(document.getElementById('radioDefault').checked || customapikey == '') {
  //use default key
	chrome.storage.sync.remove('customapikey', function() {
		chrome.storage.sync.set({"greentext": !(document.getElementById('chkGreentext').checked)}, function() {
			var status = document.getElementById('status');
			status.textContent = 'Options saved.';
			document.getElementById('radioDefault').checked = true;
			document.getElementById('customapikey').value = '';
			setTimeout(function() {
				status.innerHTML = '<br>';
			}, 750);
		});
	});
  }
}

function restore_options() {
	chrome.storage.sync.get(["customapikey", "greentext"], function(data){
		if (typeof data['customapikey'] == 'undefined'){
			
		}else{
			document.getElementById('customapikey').value = data['customapikey'];
			document.getElementById('radioCustom').checked = true;
		}
		if (typeof data['greentext'] == 'undefined'){
			
		} else if (data['greentext'] == false){
			document.getElementById('chkGreentext').checked = true;
		}
	})
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
