const HOME_PATH = "/d/home.htmld";
const MENU_OPEN_TIME = "open-time-page";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_OPEN_TIME,
    title: "Open Workday Time",
    contexts: ["action"]
  });
});

function openWorkday() {
  chrome.storage.sync.get(["timePageUrl", "workdayBaseUrl"], (data) => {
    if (data.timePageUrl) {
      chrome.tabs.create({ url: data.timePageUrl });
      return;
    }
    if (data.workdayBaseUrl) {
      const url = data.workdayBaseUrl.replace(/\/+$/, "") + HOME_PATH;
      chrome.tabs.create({ url });
      return;
    }
    chrome.runtime.openOptionsPage();
  });
}

chrome.action?.onClicked?.addListener(openWorkday);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_OPEN_TIME) openWorkday();
});
