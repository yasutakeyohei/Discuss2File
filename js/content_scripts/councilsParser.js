//method parse already declared等のエラーを避けるためにconstではなくvar宣言しているが、
//const宣言できるもっと良い方法があるかも

var content = {
  result: "",
  councils: [],
  councilId: 0,
};
/*
  content = {
    result: "singleParsed" / "councilesParsed" / "schedulesParsed",
    councils: [{
      group: string,
      id: int,
      title: string,
      schedules: [{
        id: int,
        title: string,
        material: bool
      }]
    }],
    councilId: int,
  }
  */

var parseCouncils = () => {
  content.result = "councilsParsed";
  $('ul.parent_bar>li:not(".add")').filter(function() { return $(this).css("display") !== "none"; }).each((idx, elm) => {
    // https://stackoverflow.com/questions/3442394/using-text-to-retrieve-only-text-not-nested-in-child-tags/#3442757
    let title = $(elm).contents().not($(elm).children()).text().replace(/\s+|\n/g, "");
    let id = -1;
    let group = "";
    switch(config.pageMode) {
      case PAGE_MODE_TOP:
        id = $(elm).attr('data-council_id');
        group = $(elm).parents('div.table_area').prev('h2').text();
        break;
      case PAGE_MODE_YEARLY:
        id = $(elm).children('ul').attr('id');
        group = $(elm).parents('div.table_area').prev('h2').text();
        break;
      case PAGE_MODE_SCHEDULE_DIALOG:
        break;
    }
    content.councils.push({group: group, id: id, title: title});
  });
};

//schedule id を取得する
var parseScheduleIds = () => {
  content.result = "scheduleParsed";
  for(const council of config.councils) {
    let councilId = council.id;
    let councilTitle = council.title;
    let schedules = [];
    switch(config.pageMode) {
      case PAGE_MODE_TOP:
        $(`[data-council_id=${councilId}] > ul > li`).each((idx,elm) => {
          let id = $(elm).attr('schedule_id');
          let title = $(elm).text().replace(/\s+/g, "");
          let material = $(elm).hasClass('material_true');
          schedules.push({id: id, title: title, material: material});
        });
        break;
      case PAGE_MODE_YEARLY:
        $(`#${councilId} > li`).each((idx,elm) => {
          let id = $(elm).attr('schedule_id');
          let title = $(elm).text().replace(/\s+/g, "");
          let material = $(elm).hasClass('material_true');
          schedules.push({id: id, title: title, material: material});
        });
        break;
    }
    content.councils.push({id: councilId, title: councilTitle, schedules: schedules});
  }
  chrome.runtime.sendMessage({ content: content });
}

var awaitSchedulesShown = (councilId) => {
  return new Promise(resolve => {
    let target = null;
    switch(config.pageMode) {
      case PAGE_MODE_TOP:
        target = $(`[data-council_id=${councilId}]`)[0];
        break;
      case PAGE_MODE_YEARLY:
        target = document.getElementById(councilId);
        break;
      case PAGE_MODE_SCHEDULE_DIALOG:
        break;
    }
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
    })
    switch(config.pageMode) {
      case PAGE_MODE_TOP:
        $(target).click();
        break;
      case PAGE_MODE_YEARLY:
        $("#" + councilId).parent("li").click();
        break;
      case PAGE_MODE_SCHEDULE_DIALOG:
        break;
    }
  });
}

var main = async () => {
  switch(config.mode) {
    case MODE_COUNCILS_PARSE:
      await parseCouncils();
      chrome.runtime.sendMessage({ content: content });
      break;
    case MODE_SCHEDULES_SHOW_AND_PARSE_IDS: // クリックしてcouncilリストを開き、schedule_idを得る
      // 一度も展開表示されていないcouncilを得る
      let councilId = 0;

      switch(config.pageMode) {
        case PAGE_MODE_TOP:
          for(const council of config.councils) {
            let topCouncilElm = $(`[data-council_id=${council.id}]`);
            if(topCouncilElm.length && !topCouncilElm.has("ul").length) {
              councilId = council.id;
              break;
            }
          }
          break;
        case PAGE_MODE_YEARLY:
          for(const council of config.councils) {
            if(!$('#' + council.id).has("li").length) {
              councilId = council.id;
              break;
            }
          }
          break;
      }
      if(councilId == 0) {
        parseScheduleIds();
        break;
      }
      await awaitSchedulesShown(councilId);
      parseScheduleIds();
      break;
  }
}

main();
