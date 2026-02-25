const urlInput = document.getElementById("workday-url");
const timePageInput = document.getElementById("time-page-url");
const wdBlock1In = document.getElementById("wd-block1-in");
const wdBlock1Out = document.getElementById("wd-block1-out");
const wdBlock2In = document.getElementById("wd-block2-in");
const wdBlock2Out = document.getElementById("wd-block2-out");
const weIn = document.getElementById("we-in");
const weOut = document.getElementById("we-out");
const saveBtn = document.getElementById("save");
const toast = document.getElementById("toast");
const versionEl = document.getElementById("version");

const FIELDS = {
  workdayBaseUrl: urlInput,
  timePageUrl: timePageInput,
  wdBlock1In: wdBlock1In,
  wdBlock1Out: wdBlock1Out,
  wdBlock2In: wdBlock2In,
  wdBlock2Out: wdBlock2Out,
  weekendIn: weIn,
  weekendOut: weOut
};

versionEl.textContent = chrome.runtime.getManifest().version;

chrome.storage.sync.get(Object.keys(FIELDS), (data) => {
  for (const [key, el] of Object.entries(FIELDS)) {
    if (data[key]) el.value = data[key];
  }
});

saveBtn.addEventListener("click", () => {
  const raw = (urlInput.value || "").trim().replace(/\/+$/, "");
  if (raw && !/^https:\/\/.+\.myworkday\.com/i.test(raw)) {
    urlInput.setCustomValidity("Must be a https://*.myworkday.com URL");
    urlInput.reportValidity();
    return;
  }
  urlInput.setCustomValidity("");

  const timePage = (timePageInput.value || "").trim().replace(/\/+$/, "");
  if (timePage && !/^https:\/\/.+\.myworkday\.com/i.test(timePage)) {
    timePageInput.setCustomValidity("Must be a https://*.myworkday.com URL");
    timePageInput.reportValidity();
    return;
  }
  timePageInput.setCustomValidity("");

  const payload = {};
  for (const [key, el] of Object.entries(FIELDS)) {
    payload[key] = (el.value || "").trim().replace(/\/+$/, "");
  }

  chrome.storage.sync.set(payload, () => {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  });
});
