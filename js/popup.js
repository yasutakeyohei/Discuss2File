const fontFamilyBoldMap = new Map([
  ["UD デジタル 教科書体 N-R", "UD デジタル 教科書体 N-B"], 
  ["UD デジタル 教科書体 NP-R", "UD デジタル 教科書体 NP-B"], 
  ["UD デジタル 教科書体 NK-R", "UD デジタル 教科書体 NK-B"], 
]);
const fontsUrl = browser.extension.getURL("fonts");
const fontFaceStyle = `
<style type="text/css" id="fontFaceStyle">
  @font-face {
    font-family: "Koruri";
    src: url("${fontsUrl}/Koruri-Regular.ttf");
  }
  @font-face {
    font-family: "Koruri";
    src: url("${fontsUrl}/Koruri-Bold.ttf");
    font-weight: bold;
  }
</style>
`;

let fontStyle = `
  <style type="text/css" id="fontStyle"></style>
`;

const defaultStyle = `
<style type="text/css" id="defaultStyle">
  h1 {font-size: 1.3rem;}
  h2 {font-size: 1.1rem;}
  h3 {font-size: 1.1rem;}
  #linkMenu {display: inline-block;}
  #linkMenu legend {font-size: 1rem;}
  #linkMenu ul {list-style:none;margin:0;padding:0;}
  #linkMenu li.h2 {margin-left: 10px;}
  #linkMenu li.h3 {margin-left: 20px;}
  #linkMenu li.h4 {margin-left: 30px;}
  #linkMenu li.h5 {margin-left: 40px;}
  #linkMenu li.h6 {margin-left: 40px;}
  #linkMenu li a{font-size: 0.8rem;}
  #linkMenu li.h1 a{font-size: 1rem;}
  #linkMenu li.h2 a{font-size: 0.9rem;}
  figure {page-break-after: always;}
</style>
`

let content = {}; // see singleMinuteParase or councilsParser
let fontModule = null;
let urlInfo = { cityName: "", pageMode: -1 }


const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const awaitParseSingleMinute = (mode) => {
  return new Promise(async (resolve) => {
    var config = {
      mode: mode,
      filename: {
        removeSpaces: $("#removeSpacesFromFilename").is(':checked')
      },
    };
    await browser.tabs.executeScript(null, { code: 'var config = ' + JSON.stringify(config) });
    const listener = (message, sender) => {
      content = message.content;
      if(content.result === "singleParsed") {
        browser.runtime.onMessage.removeListener(listener);
        if(urlInfo.pageMode === PAGE_MODE_SINGLE) {
          $("#filename").val(content.filename);
          hankakuNumber();
        }
        resolve();
      }
    }
    browser.runtime.onMessage.addListener(listener);
    browser.tabs.executeScript(null, { file: "js/content_scripts/singleMinuteParser.js" });
  });
}

const awaitParseCouncils = () => {
  return new Promise(async (resolve) => {
    var config = {
      pageMode: urlInfo.pageMode,
      mode: MODE_COUNCILS_PARSE
    }
    await browser.tabs.executeScript(null, { code: 'var config = ' + JSON.stringify(config) });
    const listener = (message, sender) => {
      content = message.content;
      if(content.result === "councilsParsed") {
        browser.runtime.onMessage.removeListener(listener);
        $("#loading").hide();

        let currentGroup = "";
        for (const council of content.councils) {
          if(currentGroup !== council.group) {
            $('#councils').append('<div class="group-title">' + council.group + '</div>');
            currentGroup = council.group;
          }
          $('#councils').append('<label><input type="radio" name="councils" data-id="' + council.id + '" data-title="'+ council.title + '" />' + council.title + '</label><br />');
        }
        $("[name=councils]").change( async () => {
          //saveCouncilOptions();
          let selectedCouncils = [];
          $('[name="councils"]:checked').each((idx, elm) => {
            selectedCouncils.push({id: $(elm).attr("data-id"), title: $(elm).attr("data-title")});
            $("#filename").val($(elm).attr("data-title"));
            hankakuNumber();
          });
          await awaitParseSchedulesFromCouncils(selectedCouncils);
        });

        resolve();
      }
    }
    browser.runtime.onMessage.addListener(listener);
    $("#loading").show();
    browser.tabs.executeScript(null, { file: "js/content_scripts/councilsParser.js" });  
  });
}

const awaitParseSchedulesFromCouncils = (councils) => {
  return new Promise(async (resolve) => {
    var config = {
      pageMode: urlInfo.pageMode,
      mode: MODE_SCHEDULES_SHOW_AND_PARSE_IDS,
      councils: councils
    }
    await browser.tabs.executeScript(null, { code: 'var config = ' + JSON.stringify(config) });
    const listener = (message, sender) => {
      content = message.content;
      if(content.result === "scheduleParsed") {
        browser.runtime.onMessage.removeListener(listener);
        $("#loading").hide();

        const councilId = content.councilId;
        $('#schedules').html("");
        for (const council of content.councils) {
          $('#schedules').append('<div class="council-title"><div>' + council.title + '</div><div><input type="checkbox" id="allchk" data-save-option="false" checked="checked"></div>');
          $('#allchk').change(() => {
            if($('#allchk').is(":checked")) {
              $('input[name=schedules]').prop("checked", true);
            } else {
              $('input[name=schedules]').prop("checked", false);
            }
          });
          for (const schedule of council.schedules) {
            $('#schedules').append('<label><input type="checkbox" name="schedules" data-council-id="' + council.id + '" data-schedule-id="' + schedule.id + '" data-minute-id="' + schedule.minute_id + '" data-material="' + schedule.material + '" data-save-option="false" checked="checked" />' + schedule.title + '</label><br />');
          }
        }
        if($('#schedules').text().length > 0) {
          $("#schedules").show('fast');
        } else {
          $("#schedules").hide('fast');
        }
      }
    }
    browser.runtime.onMessage.addListener(listener);
    $("#loading").show();
    browser.tabs.executeScript(null, { file: "js/content_scripts/councilsParser.js" });
  });
}

const downloadFromSchedules = async () => {
  const baseUrl = "https://ssp.kaigiroku.net/tenant/" + urlInfo.cityName + "/SpMinuteView.html?";
  const baseMaterialUrl = "https://ssp.kaigiroku.net/tenant/" + urlInfo.cityName + "/SpMaterial.html?minute_id=1&";
  let idpairs = [];
  let firstCouncilId = -1; //チェックされたうちの最初のcouncilIdを得る→そのIdのタイトルでファイル名を作成する
  $('input[name=schedules]:checked').each((idx, elm) => {
    if(firstCouncilId === -1) firstCouncilId = $(elm).attr("data-council-id");
    idpairs.push({councilId: $(elm).attr("data-council-id"), scheduleId: $(elm).attr("data-schedule-id"), minuteId: $(elm).attr("data-minute-id"), material: ($(elm).attr("data-material").toLowerCase() === "true") });
  });

  /*
  if(idpairs.length > 12) {
    alert("サーバーへの負荷を考慮し、一度に選択できる項目を12個までに制限しております。");
    $("#loading").hide();
    return;
  }
  */

  $("#loading").show();
  let loopCount = 0;
  let multipleParsedContent = "";
  for (let idpair of idpairs) {
    if(loopCount++ != 0) {
      let waitMSec = (loopCount > 8) ? "5000" : 1000 + loopCount * 500;
      $("#loading > span").text(" " + waitMSec/1000 + "秒待機（負荷対策）");
      //await sleep(waitMSec);
await sleep(100);
    }
    let url ="";
    console.log(idpair.material);
    if (idpair.material) {
      url = baseMaterialUrl + "council_id=" +  idpair.councilId + "&schedule_id=" + idpair.scheduleId + "&minute_id=" + idpair.minuteId;
    } else {
      url = baseUrl + "council_id=" +  idpair.councilId + "&schedule_id=" + idpair.scheduleId;
    }
    console.log(url);
    // executescript前にupdate（ページ遷移）がcompleteするのを待つ必要がある
    // でないと、ページ遷移前のページでscriptをexecuteすることになってしまう
    // https://stackoverflow.com/questions/4584517/chrome-tabs-problems-with-chrome-tabs-update-and-chrome-tabs-executescript
    await awaitBrowserTabUpdate(url);
    await awaitParseSingleMinute(MODE_SINGLE_MINUTE_WAITLOAD_AND_PARSE);
    multipleParsedContent += content.parsedContent;
  }
  $("#loading span").text("");
  $("#loading").hide();

  downloadSingleMinuteHTML(multipleParsedContent);
//  parseContent(id);
}

const awaitBrowserTabUpdate = (url) => {
  return new Promise(resolve => {
    const listener = (tabId, changeInfo, tab) => {
      if(changeInfo.status === 'complete') {
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    browser.tabs.onUpdated.addListener(listener);
    browser.tabs.update(null, {url: url, active: true});
  });
}

const downloadSingleMinuteHTML = async (parsedContent) => {
  const debugMode = $("#debugMode").is(":checked");
  $("#replaceRegexErr").hide();
  const filename = $("#filename").val();

  const baseUrl = 'https://ssp.kaigiroku.net/tenant/' + urlInfo.cityName + '/';

  //const startTime = performance.now();

  let regexes = $("#replaceRegex").val().split(/\r?\n/g);
  //console.log(regexes);

  if(debugMode) {
    console.groupCollapsed("オリジナル文書データ");
    console.log(parsedContent);
    console.groupEnd();
  }

  // regex parse
  let err = {};
  for (let i = 0; i < regexes.length; i++) {
    let regex = regexes[i];

    if(regex === "" || (/^[ 　]*\{.*\}/).test(regex)) continue;
    if((/^[^/]+/).test(regex)){
      err = { index: i + 1, message: "無効な文字で始まっています。正規表現は/（半角スラッシュ）、コメントは{（半角波括弧）で始める必要があります。" };
      break;
    }

    //置換文字列の""もしくは''で括られた部分を抽出後、正規表現の抽出
    let replacer = ""; //置換文字列
    // https://stackoverflow.com/questions/6525556/regular-expression-to-match-escaped-characters-quotes
    regex = regex.replace(/(?<!\\)(?:\\{2})*"(?:(?<!\\)(?:\\{2})*\\"|[^"])*(?<!\\)(?:\\{2})*"/, (match) => {
      replacer = match;
      return "";
    });

    if(replacer.length >= 2) { //""の分が二文字
      // ダブルクオーテーションを削除
      replacer = replacer.slice(1).slice(0, -1);
      //最後のカンマを削除
      regex = regex.replace(/^(.*),[^,]*$/g, "$1");
      let flag = "";
      regex = regex.replace(/^\/(.*)\/([gimsui]*)$/, (match, p1, p2) => {
        flag = p2;
        return p1;
      });

      replacer = replacer.replace(/\\"/g, '"');
      replacer = replacer.replace(/\{baseUrl\}/g, baseUrl);

      const r = new RegExp(regex, flag);
      if(debugMode) {
        const matched = parsedContent.match(r);
        if(matched) {
          console.groupCollapsed("マッチあり：" + r);
          console.log("マッチ内容：", matched);
          console.groupCollapsed("置換前");
          console.log(parsedContent);
          console.groupEnd();
          parsedContent = parsedContent.replace(r, replacer);
          console.groupCollapsed("置換後");
          console.log(parsedContent);
          console.groupEnd();
          console.groupEnd();
        } else {
          console.log("マッチなし：正規表現" + r);
        }
      } else {
        parsedContent = parsedContent.replace(r, replacer);
      }
    } else {
      err = { index: i + 1, message: "置換文字列が見つかりません" + replacer.length };
      break;
    }

    // escape regex
    // https://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript/9310752#9310752
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
  }
  //エラーの表示
  if(Object.keys(err).length > 0) {
    $("#replaceRegexErr")
    .text(("[エラー：" + err.index + "行目] " + err.message))
    .show()
    .on( 'click', evt =>{
      $(evt.target).hide();
    });
    if($('[data-role=toggler]').next().is(":hidden")) $('[data-role=toggler]').click();
    return;
  }

//  parsedContent = parsedContent.replace(/\<strong\>\<a href=\"(.*)\"\ target\=\"_self\"\>(.*)\<\/a\>\<\/strong\>/gm, hyperLink);

  //const endTime = performance.now(); // 終了時間
  //console.log(endTime - startTime);
  
  const head = '<style type="text/css">\n' + $("#customCss").val() + '</style><div class="a4">';
  const foot = '</div>';

  parsedContent = head + parsedContent + foot;

  const mo = await import('./htmlSanitizer.js');
  let sanitizedContent = mo.sanitizeHtml(parsedContent);

  //h1-h6に対してリンクメニューを作成
  let sanitizedDom = $("<div>").append(sanitizedContent); //なぜかdivにつけないとDOM操作が正しく行えない。bodyもhtmlもダメ。
  if($("#addMenu").is(":checked")) {
    let linkMenuDiv = $("<fieldset>").attr("id", "linkMenu").append($("<legend>").text("自動作成目次"));
    let indices = [];
    let ulDom = $("<ul>");
    $(sanitizedDom).find(':header').each((idx, elm) => {
      let anchor = $('<a>');

      const hIndex = parseInt(elm.nodeName.substring(1)) - 1;
      if(indices[hIndex] === undefined) indices[hIndex] = 0;
      indices[hIndex]++;

      if($(elm).attr("id")) {
        $(anchor).attr("href", '#' + $(elm).attr("id"));
      } else {
        const hid = (hIndex+1) + "-" + indices[hIndex];
        $(elm).attr("id", hid);
        $(anchor).attr("href", "#" + hid);
      }
      $(anchor).text($(elm).text());
      $(ulDom).append($("<li>").addClass("h"+(hIndex+1)).html(anchor));
    });
    $(sanitizedDom).find("style").first().after($(linkMenuDiv).append(ulDom));
    //console.log(, linkMenuDiv, $(sanitizedDom));
  }
  sanitizedContent = $(sanitizedDom).html();
  const hasImg = ($(sanitizedDom).has("img").length) ? true : false;

  //https://stackoverflow.com/questions/4535816/how-to-use-font-face-on-a-chrome-extension-in-a-content-script

  /*
  body {
    font-family: "UDD";
  }
  */

  sanitizedContent = `
<!DOCTYPE HTML>
<html lang="jp">
  <head>
    <meta charset="utf-8">
    <title>${filename}</title>
  ${defaultStyle}
  ${fontFaceStyle}
  ${fontStyle}
  </head>
  <body>
${sanitizedContent}
  </body>
</html>`;
  //console.log(sanitizedContent);

  const htmlSaveChecked = $("[type='radio'][name='htmlSave'][value='save']").is(":checked");
  if(htmlSaveChecked || hasImg){
    if(!htmlSaveChecked) {
      alert("文書に画像が含まれているため、直接印刷ダイアログを開いてのPDF保存ができません。HTMLファイルをダウンロードしますので、それをブラウザで開き、「印刷」メニューから「PDFに保存」を行ってください。");
    }
    var elm = document.createElement('a');
    elm.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(sanitizedContent));
    elm.setAttribute('download', filename + ".html");
    elm.style.display = 'none';
    $("#downloadLink").append(elm);
    elm.click();
    $("#downloadLink").empty();
  } else {
    let w = window.open("");
    w.document.write(sanitizedContent);
    w.print();
    w.close();
  }
}

const saveOptions = async () => {
  let options = [];
  $("[type=radio]:not([name='tabs']), [type=checkbox]:not([data-save-option='false'])").each((idx, elm) => {
    options.push({type: elm.type, name: elm.name, value: elm.value, checked: elm.checked});
  });

  $("textarea, [name=fontFamily], [name=fontSize], [name=lineHeight], [name=letterSpacing]").each((idx, elm) => {
    options.push({type: elm.type, name: elm.name, value: elm.value, checked: null});
  });

  await browser.storage.local.set({ 'options': options });
}

const loadOptions = async () => {
  const data = await browser.storage.local.get('options');
  
  if (data && data.options) {
    $("[type=radio]:not([name='tabs']), [type=checkbox]:not([data-save-option='false'])").each((idx, elm) => {
      const obj = data.options.find(item => {
        return (item.type === elm.type && item.name === elm.name && item.value === elm.value);
      });
      if(obj) {
        if(obj.checked) {
          $(elm).prop("checked", true);
        } else {
          $(elm).prop("checked", false);
        }
      } 
    });
    $("textarea, [name=fontFamily], [name=fontSize], [name=lineHeight], [name=letterSpacing]").each((idx, elm) => {
      const obj = data.options.find(item => {
        return (item.type === elm.type && item.name === elm.name);
      });
      if(obj && obj.value) $(elm).val(obj.value);
    });
  }
}

const hankakuNumber = () => {
  if($("#hankakuNumber").is(":checked")){
    const name = $("#filename").val().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    //console.log(name);
    $("#filename").val(name);
  }
}

const updateFontSettingSampleText = () => {
  const fontFamily = $("select[name=fontFamily]").val();
  const fontSize = $("[name=fontSize]").val();
  const lineHeight = $("[name=lineHeight]").val();
  const letterSpacing = $("[name=letterSpacing]").val();

  let fontFamilyBold = fontFamilyBoldMap.has(fontFamily) ? fontFamilyBoldMap.get(fontFamily) : fontFamily;
  fontStyle = `
<style type="text/css" id="fontStyle">
  html, body {
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    letter-spacing: ${letterSpacing}px;
  }
  h1,h2,h3,h4,h5,h6,strong,b {
    font-family: ${fontFamilyBold};
  }
</style>
    `;

  let content;
  var d = $("#sampleText")[0].contentWindow.document;
  content = $("body", d).html();
  d.open(); d.close();
  $("head", d).append(fontStyle);
  $("body", d).html(content);
  $("body", d).css("margin", 0);
}

const removeUnsupportedFont = () => {
  $("select[name=fontFamily]>option").each((idx, elm) => {
    if($(elm).val() != "Koruri" && !isInstalledFont($(elm).val())) {
      $(elm).remove();
    }
  });
}

const main = async () => {
  removeUnsupportedFont();
  $("head").append(fontFaceStyle);
  await loadOptions();
  const tabs = await browser.tabs.query({'active': true, 'lastFocusedWindow': true});
  const url = tabs[0].url;
  urlInfo.cityName = url.match(/^.*tenant\/([^/]*)\/.*$/)[1];

  if(url.match(/^.*\/SpTop.html.*/)){
    urlInfo.pageMode = PAGE_MODE_TOP;
  } else if(url.match(/#schedule-dialog/)) {
    urlInfo.pageMode = PAGE_MODE_SCHEDULE_DIALOG;
  } else if(url.match(/schedule_id\=/)) {
    urlInfo.pageMode = PAGE_MODE_SINGLE;
  } else if(url.match(/view_years\=/)) {
    urlInfo.pageMode = PAGE_MODE_YEARLY;
  }
 
  updateFontSettingSampleText();

  //toggler
  $('[data-role=toggler]').each((idx, elm) => {
    $(elm).on( 'click', () => {
      const options = $(elm).attr('data-options').split(',');
      const actions = $(elm).attr('data-actions').split(',');
      let current = options.indexOf($(elm).text());
      current = (current + 1) % options.length;
      $(elm).text(options[current]);
      switch(actions[current]) {
        case "show":
          $(elm).next().show('slow');
          break;
        case "hide":
          $(elm).next().hide('slow');
          break;
      }
    })
  });

  $('[data-role=loadCityRegex').on( 'click', async () => {
    if(window.confirm("現在設定されている正規表現とCSSが上書きされます。よろしいですか？")) {
      const cityName = $("#cityRegexSelect").val();
      let module = await import("./regexes/" + cityName + "-regex.js");
      if (module.regexes && module.regexes.length > 0) {
        $("#replaceRegex").val(module.regexes);
        saveOptions();
      }
      module = await import("./regexes/" + cityName + "-css.js");
      if (module.css && module.css.length > 0) {
        $("#customCss").val(module.css);
        saveOptions();
      }
    }
  });

  $("[name=htmlSave], [id=removeSpacesFromFilename], [id=hankakuNumber]").change(() => {
    hankakuNumber();
    saveOptions();
    if(urlInfo.pageMode === PAGE_MODE_SINGLE) awaitParseSingleMinute(MODE_SINGLE_MINUTE_PARSE);
  });

  //regex tab
  $("[name=addMenu], [name=debugMode]").change(() => {
    saveOptions();
  });


  //tab changed
  $("[name=tabs]").change(() => {
    if($("#tab3").is(":checked")){
      $("body").addClass("wide").show('slow');
    } else {
      $("body").removeClass("wide");      
    }
  });

  //font settings changed
  $("#fontSettings select, #fontSettings input").change(() => {
    updateFontSettingSampleText();
    saveOptions();
  });


  $("textarea").on( 'keyup', () => {
    saveOptions();
  });

  $('#filename').on( 'keyup', () => {
    $("#filename").val( $("#filename").val().replace(/\\|\/|\:|\*|\?|a|<|>/gi, '') );
  });

  $('#download').click((e) => {
    e.preventDefault();
    switch(urlInfo.pageMode) {
      case PAGE_MODE_TOP:
      case PAGE_MODE_YEARLY:
        if($("#debugMode").is(":checked")) {
          alert("正規表現設定タブで「デバッグモード」にチェックが入っているときは、一括ダウンロードは行えません。個別の会議録を開いた状態でダウンロードしてください。");
          return;
        }
        downloadFromSchedules();
        break;
      case PAGE_MODE_SINGLE:
        downloadSingleMinuteHTML(content.parsedContent);
      break;
      default:
    }
    //window.close();
  });

  switch(urlInfo.pageMode) {
    case PAGE_MODE_TOP:
    case PAGE_MODE_YEARLY:
        $("#councils").show();
      awaitParseCouncils();
      break;
    case PAGE_MODE_SINGLE:
      $("#councils").hide();
      awaitParseSingleMinute(MODE_SINGLE_MINUTE_PARSE);
      break;
    default:
  }
  
};

main();

