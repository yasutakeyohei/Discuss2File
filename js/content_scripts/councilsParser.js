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
        title: string
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
    let id = $(elm).children('ul').attr('id');
    let group = $(elm).parents('div.table_area').prev('h2').text();
    content.councils.push({group: group, id: id, title: title});
  });
};

var parseScheduleIds = () => {
  content.result = "scheduleParsed";
  for(const council of config.councils) {
    let councilId = council.id;
    let councilTitle = council.title;
    let schedules = [];
    $("#" + councilId + " > li").each((idx,elm) => {
      let id = $(elm).attr('schedule_id');
      let title = $(elm).text().replace(/\s+/g, "");
      schedules.push({id: id, title: title});
    });
    content.councils.push({id: councilId, title: councilTitle, schedules: schedules});
  }
  console.log(content.councils);
  chrome.runtime.sendMessage({ content: content });
}

var awaitSchedulesShown = (councilId) => {
  return new Promise(resolve => {
    var target = document.getElementById(councilId);
    var observer = new MutationObserver(mutations => {
      for(const record of mutations) {
        if(record.target.style.display === "block" && record.target.style.overflow !== "hidden") {
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
    $("#" + councilId).parent("li").click();
  });
}

var main = async () => {
  switch(config.mode) {
    case MODE_COUNCILS_PARSE:
      await parseCouncils();
      chrome.runtime.sendMessage({ content: content });
      break;
    case MODE_SCHEDULES_SHOW_AND_PARSE:
      // クリックしてcouncilリストを開き、schedule_idを得る
      let councilId = 0;
      for(const council of config.councils) {
        let id = council.id
        if($('#' + id).css("display") !== "block") {
          councilId = id;
          break;
        }
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
