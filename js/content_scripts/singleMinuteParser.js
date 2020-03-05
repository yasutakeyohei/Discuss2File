//method parse already declared等のエラーを避けるためにconstではなくvar宣言しているが、
//const宣言できるもっと良い方法があるかも

/*
  content = {
    result: "singleParsed" / "councsParsed" / "schedulesParsed",
    filename: string,
    parsedContent: string
  }
*/
var parse = () => {
  let content = {};

  const additionalCRLF = config.txtCrlf === "crlf" ? "\n\r"
                       : config.txtCrlf === "lf"  ? "\n" : "";

  const councilTitle = $('#council-title').text();
  if(councilTitle) {
    content.result = "singleParsed";
    content.filename = config.filename.removeSpaces ? councilTitle.replace(/\s+/g, "") : councilTitle;

    if(config.fileType === "html") {
      let html = "";
      $('pre').each((idx, elm) => {
        html += $(elm).html();
      });
      content.parsedContent = html;
    } else {
      let text = "";
      $('pre').each((idx, elm) => {
        text += $(elm).text();
        text += additionalCRLF;
      });
      content.parsedContent = text;
    }
  }
  return content;
};

var awaitPageShown = () => {
  return new Promise(resolve => {
    var target = document.getElementById("loader");
    var observer = new MutationObserver(mutations => {
      for(const record of mutations) {
        if(record.target.style.display === "none") {
          observer.disconnect();
          resolve();
          break;
        }
      }
    });
    observer.observe(target, {
      attributes: true,
      childList: false,
      characterData: false,
      attributeFilter: ['style'],
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

