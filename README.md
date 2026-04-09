# Grammer Lite Chrome Extension (MV3)

Grammer Lite is a Chrome extension that improves selected email text using free AI.  
You can open it by:

- selecting text and pressing `Shift + >`
- right-clicking selected text and clicking **Apply Grammer Lite**
- clicking the extension icon and pressing **Apply Grammer Lite** in the popup

The selected text is replaced in-place with grammar fixes or tone rewrites.

## Features

- Free AI rewrite (no API key) using `text.pollinations.ai`
- Grammar fallback via `api.languagetool.org` if AI is unavailable
- Seven actions:
  - Check grammar
  - Make this more professional tone
  - Make this casual
  - Make this sound like rhyme
  - Make this shorter
  - Make this longer
  - Make it more direct

## Project structure

- `manifest.json` - Extension manifest (MV3), permissions, content scripts, popup
- `background.js` - Context menu, message routing, content script injection fallback
- `content.js` - Selection capture, floating action panel, rewrite/replace behavior
- `popup.html` - Toolbar popup UI
- `popup.js` - Popup button click handler

## Exact steps to create this extension from scratch

### 1) Create a project folder

```bash
mkdir Grammer_Lite
cd Grammer_Lite
```

### 2) Create these files

```bash
touch manifest.json background.js content.js popup.html popup.js README.md
```

### 3) Add manifest (MV3)

Use `manifest_version: 3` and include:

- permissions: `activeTab`, `scripting`, `contextMenus`
- host_permissions:
  - `https://text.pollinations.ai/*`
  - `https://api.languagetool.org/*`
- background service worker: `background.js`
- action popup: `popup.html`
- content script: `content.js` on `<all_urls>` with `all_frames: true`

### 4) Implement background worker (`background.js`)

Add logic for:

- creating right-click context menu: **Apply Grammer Lite**
- handling context menu click on selected text
- routing message to correct frame (`frameId`)
- retrying message after script injection fallback using `chrome.scripting.executeScript`
- handling popup trigger messages

### 5) Implement content logic (`content.js`)

Add logic for:

- capturing highlighted text in:
  - `textarea`
  - `input[type=text|email|search|url]`
  - `contenteditable` / DOM selections
- opening floating panel UI with 7 actions
- keyboard trigger: selected text + `Shift + >`
- AI rewrite call:
  - endpoint: `https://text.pollinations.ai/<encoded prompt>?model=openai&private=true`
- grammar fallback:
  - endpoint: `https://api.languagetool.org/v2/check`
- replacing selected text in the same editor
- fallback replacement if selection collapses after right-click

### 6) Implement popup (`popup.html` + `popup.js`)

- Popup contains button: **Apply Grammer Lite**
- On click, send message to background to open the in-page panel on current tab

### 7) Load extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select your `Grammer_Lite` folder

### 8) Test workflow

1. Open Gmail/Outlook web compose window
2. Highlight sentence(s)
3. Trigger one of:
   - `Shift + >`
   - right-click -> **Apply Grammer Lite**
   - extension icon -> **Apply Grammer Lite**
4. Choose action (for example: **Check grammar**)
5. Verify selected text is replaced

## Troubleshooting

- If nothing happens:
  - reload extension in `chrome://extensions`
  - refresh the email tab
  - reselect text and try again
- Some browser-protected pages do not allow content scripts.
- Free AI endpoint can rate-limit. Grammar fallback still works when available.

## License

Use freely for personal learning and experimentation.
