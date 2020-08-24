chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
  chrome.declarativeContent.onPageChanged.addRules([{
    conditions: [
      new chrome.declarativeContent.PageStateMatcher({
        pageUrl: {hostEquals: 'ssp.kaigiroku.net', schemes:['https'] },
      })
    ],
    actions: [
      new chrome.declarativeContent.ShowPageAction()
    ]
  }]);
});