# Workday Helper (Chrome Extension)

Manifest V3 Chrome extension that automates repetitive Workday tasks — starting with time entry Quick Add.

## Features

### On-Call Standby Time Entry
- Floating panel appears on **Quick Add** screens.
- **Select Standby Type** — sets Time Type to "On Call Standby Hours".
- **Add Workdays** — fills `00:00–08:59` and `17:00–23:59` for Mon–Fri.
- **Add Weekend** — fills `00:00–23:59` for Sat–Sun.
- **Clear Empty Rows** — removes blank In/Out rows left behind.

### Quick Access
- Click the extension icon to open your Workday Quick Add page.
- Right-click the icon → **Open Workday Quick Add**.
- Configure your company URL in **Options**.

## Install

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the cloned/downloaded project folder.

## Setup

1. Right-click the extension icon → **Options**.
2. Enter your company Workday URL (e.g. `https://wd5.myworkday.com/yourcompany`).
3. Click **Save**.

## Use

1. Click the extension icon to open Workday.
2. Navigate to **Enter Time** → **Actions → Quick Add**.
3. Use the floating panel to automate time entries.
4. Review entries and click **OK** manually to submit.

## Notes

- The extension never clicks Submit/Save/OK — you always review and confirm.
- Workday DOM changes often; selectors in `content.js` may need occasional tuning.
- Everything runs locally in the page context — no external requests.
