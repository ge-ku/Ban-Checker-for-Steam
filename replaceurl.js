javascript:(function(){
	var groupRegex = new RegExp(".*#members.*");
	var links = document.getElementsByTagName("a");
	for(var i = 0; i < links.length; i++)
    {
        if (groupRegex.test(links[i].href))
		{
			links[i].href = links[i].href.replace("#members", "/members");
		}
    }
})();