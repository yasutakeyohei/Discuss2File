let content = {}; // see singleMinuteParase or councilsParser
let fontModule = null;
let urlInfo = { cityName: "" }

const awaitParseSingleMinute = (mode) => {
  return new Promise(async (resolve) => {
    var config = {
      mode: mode,
      fileType: $("input[name=fileType]:checked").val(),
      txtCrlf: $("input[name=txtCrlf]:checked").val(),
      filename: {
        removeSpaces: $("#removeSpacesFromFilename").is(':checked')
      },
    };
    await browser.tabs.executeScript(null, { code: 'var config = ' + JSON.stringify(config) });
    const listener = (message, sender) => {
      content = message.content;
      if(content.result === "singleParsed") {
        browser.runtime.onMessage.removeListener(listener);
        $("#filename").val(content.filename);
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
      mode: MODE_COUNCILS_PARSE
    }
    await browser.tabs.executeScript(null, { code: 'var config = ' + JSON.stringify(config) });
    const listener = (message, sender) => {
      content = message.content;
      if(content.result === "councilsParsed") {
        browser.runtime.onMessage.removeListener(listener);

        let currentGroup = "";
        for (const council of content.councils) {
          if(currentGroup !== council.group) {
            $('#councils').append('<div class="group-title">' + council.group + '</div>');
            currentGroup = council.group;
          }
          $('#councils').append('<label><input type="checkbox" name="councils" data-id="' + council.id + '" data-title="'+ council.title + '" />' + council.title + '</label><br />');
        }
        $("[name=councils]").change( async () => {
          //saveCouncilOptions();
          let selectedCouncils = [];
          $('[name="councils"]:checked').each((idx, elm) => {
            selectedCouncils.push({id: $(elm).attr("data-id"), title: $(elm).attr("data-title")});
          });
          await awaitParseSchedulesFromCouncils(selectedCouncils);
        });

        resolve();
      }
    }
    browser.runtime.onMessage.addListener(listener);
    browser.tabs.executeScript(null, { file: "js/content_scripts/councilsParser.js" });  
  });
}

const awaitParseSchedulesFromCouncils = (councils) => {
  return new Promise(async (resolve) => {
    var config = {
      mode: MODE_SCHEDULES_SHOW_AND_PARSE,
      councils: councils
    }
    await browser.tabs.executeScript(null, { code: 'var config = ' + JSON.stringify(config) });
    const listener = (message, sender) => {
      content = message.content;
      if(content.result === "scheduleParsed") {
        browser.runtime.onMessage.removeListener(listener);

        const councilId = content.councilId;
        $('#schedules').html("");
        for (const council of content.councils) {
          $('#schedules').append('<div class="council-title">' + council.title + '</div>');
          for (const schedule of council.schedules) {
            $('#schedules').append('<label><input type="checkbox" name="schedules" data-council-id="' + council.id + '" data-schedule-id="' + schedule.id + '" checked="checked" />' + schedule.title + '</label><br />');
          }
          if($('#schedules').text().length > 0) {
            $("#schedules").show();
          } else {
            $("#schedules").hide();
          }
        }
      }
    }
    browser.runtime.onMessage.addListener(listener);
    browser.tabs.executeScript(null, { file: "js/content_scripts/councilsParser.js" });
  });
}

const downloadFromSchedules = async () => {
  const baseUrl = "https://ssp.kaigiroku.net/tenant/" + urlInfo.cityName + "/SpMinuteView.html?";
  let idpairs = [];
  $('input[name=schedules]:checked').each((idx, elm) => {
    idpairs.push({councilId: $(elm).attr("data-council-id"), scheduleId: $(elm).attr("data-schedule-id")});
  });

  let multipleParsedContent = "";
  for (const idpair of idpairs) {
    let url = baseUrl + "council_id=" +  idpair.councilId + "&schedule_id=" + idpair.scheduleId;
    // executescript前にupdate（ページ遷移）がcompleteするのを待つ必要がある
    // でないと、ページ遷移前のページでscriptをexecuteすることになってしまう
    // https://stackoverflow.com/questions/4584517/chrome-tabs-problems-with-chrome-tabs-update-and-chrome-tabs-executescript
    console.log("await");
    await awaitBrowserTabUpdate(url);
    await awaitParseSingleMinute(MODE_SINGLE_MINUTE_WAITLOAD_AND_PARSE);
    multipleParsedContent += content.parsedContent;
  }
  downloadSingleMinuteHTML(multipleParsedContent);
  console.log("dwonload");
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

const downloadSingleMinuteTxt = (parsedContent) => {
  const filename = $("#filename").val() + ".txt";
  var elm = document.createElement('a');
  elm.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(parsedContent));
  elm.setAttribute('download', filename);
  elm.style.display = 'none';
  $("#downloadLink").append(elm);
  elm.click();
  $("#downloadLink").empty();
}

const downloadSingleMinutePDF = async (parsedContent) => {
  /*
  if(fontModule === null) {
    $("#fontLoading").show();
    fontModule = await import('./Koruri-20180915-normal.js');
    $("#fontLoading").hide();
  }

  let doc = new jsPDF('p', 'pt', 'a4');
  doc.addFileToVFS('Koruri.ttf', fontModule.KoruriFont);
  doc.addFont('Koruri.ttf', 'koruri', 'normal')
  doc.setFont('koruri');
  */
  //doc.text(parsedContent, 10, 10);
  //  doc.save("test.pdf");
  /*
  doc.html(parsedContent, {
    enableLinks: true,
    html2canvas: {
      scale: 1
    },
    callback: function (doc) {
      doc.save("test.pdf");
    }
 });
 */

}

const downloadSingleMinuteHTML = async (parsedContent) => {
  $("#replaceRegexErr").hide();
  const filename = $("#filename").val() + ".html";

  //const baseUrl = '<a href="https://ssp.kaigiroku.net/tenant/kodaira/$1">($2)</a>';
  const baseUrl = 'https://ssp.kaigiroku.net/tenant/' + urlInfo.cityName + '/';

  const startTime = performance.now();

  let regexes = $("#replaceRegex").text().split(/\r?\n/g);
  console.log(regexes);

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
    let replace = ""; //置換文字列
    // https://stackoverflow.com/questions/6525556/regular-expression-to-match-escaped-characters-quotes
    regex = regex.replace(/(?<!\\)(?:\\{2})*"(?:(?<!\\)(?:\\{2})*\\"|[^"])*(?<!\\)(?:\\{2})*"/, (match) => {
      // console.log("ma" + match);
      replace = match;
      return "";
    });

    if(replace.length >= 2) { //""の分が二文字
      // ダブルクオーテーションを削除
      replace = replace.slice(1).slice(0, -1);
      //最後のカンマを削除
      regex = regex.replace(/^(.*),[^,]*$/g, "$1");
      let flag = "";
      regex = regex.replace(/^\/(.*)\/([gimsui]*)$/, (match, p1, p2) => {
        flag = p2;
        return p1;
      });

      replace = replace.replace(/\\"/g, '"');
      replace = replace.replace(/\{baseUrl\}/g, baseUrl);

      const r = new RegExp(regex, flag);
      console.log(parsedContent);
      parsedContent = parsedContent.replace(r, replace);
    } else {
      err = { index: i + 1, message: "置換文字列が見つかりません" + replace.length };
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

  const endTime = performance.now(); // 終了時間
  console.log(endTime - startTime);

  const head = '<style type="text/css">\n' + $("#customCss").text() + '</style><div class="a4">\n';
  const foot = '</div>';

  parsedContent = head + parsedContent + foot;

  const mo = await import('./htmlSanitizer.js');
  parsedContent = mo.sanitizeHtml(parsedContent);


  if($("[type='radio'][name='htmlSave'][value='save']").is(":checked")){
    var elm = document.createElement('a');
    elm.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(parsedContent));
    elm.setAttribute('download', filename);
    elm.style.display = 'none';
    $("#downloadLink").append(elm);
    elm.click();
    $("#downloadLink").empty();
  } else {
    let w = window.open("");
    w.document.write(parsedContent);
    w.print();
    w.close();
  }

}

const saveOptions = async () => {
  let options = [];
  $("[type=radio], [type=checkbox]").each((idx, elm) => {
    options.push({type: elm.type, name: elm.name, value: elm.value, checked: elm.checked});
  });

  $("textarea").each((idx, elm) => {
    options.push({type: "textarea", name: elm.name, value: elm.value, checked: null});
  });

  await browser.storage.local.set({ 'options': options });
}

const loadOptions = async () => {
  const data = await browser.storage.local.get('options');
  
  if (data && data.options) {
    $("[type=radio], [type=checkbox]").each((idx, elm) => {
      const obj = data.options.find(item => {
        return (item.type === elm.type && item.name === elm.name && item.value === elm.value);
      });
      if(obj && obj.checked) $(elm).prop("checked", true);
    });
    $("textarea").each((idx, elm) => {
      const obj = data.options.find(item => {
        return (item.type === "textarea" && item.name === elm.name);
      });
      if(obj && obj.value) $(elm).text(obj.value);
    });
  }
}

const main = async () => {
  await loadOptions();
  const tabs = await browser.tabs.query({'active': true, 'lastFocusedWindow': true});
  const url = tabs[0].url;
  urlInfo.cityName = url.match(/^.*tenant\/([^/]*)\/.*$/)[1];
  let pageMode = url.match(/schedule_id/) ? "single" : "council";
  if(url.match(/schedule-dialog/)) pageMode = "schedule";

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
        $("#replaceRegex").text(module.regexes);
        saveOptions();
      }
      module = await import("./regexes/" + cityName + "-css.js");
      if (module.css && module.css.length > 0) {
        $("#customCss").text(module.css);
        saveOptions();
      }
    }
  });

  $("[name=fileType], [name=txtCrlf], [name=htmlSave], [id=removeSpacesFromFilename]").change(() => {
    saveOptions();
    if(pageMode === "single") awaitParseSingleMinute(MODE_SINGLE_MINUTE_PARSE);
  });

  $("textarea").on( 'keyup', () => {
    saveOptions();
  });

  $('#filename').on( 'keyup', () => {
    $("#filename").val( $("#filename").val().replace(/\\|\/|\:|\*|\?|a|<|>/gi, '') );
  });

  $('#download').click((e) => {
    e.preventDefault();
    switch(pageMode) {
      case "council":
        downloadFromSchedules();
        break;
      case "single":
        if($("[type='radio'][name='fileType'][value='html']").is(":checked")){
          downloadSingleMinuteHTML(content.parsedContent);
        } else {
          downloadSingleMinuteTxt(content.parsedContent);
        }  
      break;
      default:
    }
    //window.close();
  });

  switch(pageMode) {
    case "council":
      $("#councils").show();
      awaitParseCouncils();
      break;
    case "single":
      $("#councils").hide();
      awaitParseSingleMinute(MODE_SINGLE_MINUTE_PARSE);
      break;
    default:
  }
  
};

main();

