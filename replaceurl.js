javascript: (() => {
  const groupRegex = new RegExp('.*members.*');
  const links = document.getElementsByTagName('a');
  for (const link of links) {
    if (groupRegex.test(link.href)) {
      console.log(link);
      link.addEventListener('click', e => {
        window.location = e.currentTarget.href;
      });
      link.href = link.href.replace('#members', '/members');
    }
  }
})();
