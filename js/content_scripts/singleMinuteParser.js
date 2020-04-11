//method parse already declared等のエラーを避けるためにconstではなくvar宣言しているが、
//const宣言できるもっと良い方法があるかも

/*
  content = {
    result: "singleParsed" / "councilsParsed" / "schedulesParsed",
    filename: string,
    parsedContent: string
  }
*/
var parse = () => {
  let content = {};

  const councilTitle = $('#council-title').text();
  if(councilTitle) {
    const baseUrl = "https://ssp.kaigiroku.net";
    content.result = "singleParsed";
    content.filename = config.filename.removeSpaces ? councilTitle.replace(/\s+/g, "") : councilTitle;

    let html = "";
    if($('pre').length == 0) { //画像だけのページ（参考資料）
      html += "<figure><figcaption>" + councilTitle + "</figcaption>";
      $('tr.material_img img').each((idx, elm) => {
        const url = baseUrl + $(elm).attr("src");
        html += "<img src='" + url + "'/>";
      });
      html += "</figure>"
    } else {
      $('pre').each((idx, elm) => { //通常の会議録
        html += $(elm).html();
      });
    }
    content.parsedContent = html;
  }
  return content;
};

var awaitPageShown = () => {
  return new Promise(resolve => {
    var target = document.getElementById("lst-minute");
    var observer = new MutationObserver(mutations => {
      for(const record of mutations) {
        if(record.addedNodes.length > 0) {
          observer.disconnect();
          resolve();
          break;
        }
      }
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
    })
  });
}


var main = async () => {
  switch(config.mode) {
    case MODE_SINGLE_MINUTE_PARSE:
      break;
    case MODE_SINGLE_MINUTE_WAITLOAD_AND_PARSE:
      await awaitPageShown();
      break;
  }
  const content = parse();
  chrome.runtime.sendMessage({ content: content }); 
}

main();

