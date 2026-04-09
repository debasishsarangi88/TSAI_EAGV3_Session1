# Grammar Lite Chrome Extension (MV3)

Grammar Lite is a Chrome extension that improves selected email text using free AI.  
You can open it by:

- selecting text and pressing `Shift + >`
- right-clicking selected text and clicking **Apply Grammar Lite**
- clicking the extension icon and pressing **Apply Grammar Lite** in the popup

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

## How grammar and rewriting works

### LLM used

- Provider endpoint: `https://text.pollinations.ai`
- Query style used by the extension:
  - `https://text.pollinations.ai/<encoded prompt>?model=openai&private=true`
- Model parameter sent: `model=openai`
- API key required: **No**

### Grammar correction flow

When you click **Check grammar**:

1. Extension reads currently selected text in the email editor.
2. It sends a grammar-focused prompt to the free LLM endpoint.
3. If LLM returns text successfully, that corrected text is used.
4. If LLM fails (network/rate-limit/error), extension falls back to LanguageTool:
   - Endpoint: `https://api.languagetool.org/v2/check`
   - Language: `en-US`
   - Applies suggested replacements to produce corrected text.
5. Corrected text replaces the selected content in the compose box.

### Rewrite task flow (other actions)

For each action below, the extension sends selected text + a specific instruction prompt:

- **Make this more professional tone**: business/professional wording
- **Make this casual**: friendly, informal wording
- **Make this sound like rhyme**: playful rhyme-style output
- **Make this shorter**: concise version preserving key points
- **Make this longer**: expanded version with extra detail
- **Make it more direct**: clear and action-oriented phrasing

Flow:

1. Send rewrite instruction to free LLM endpoint.
2. If LLM succeeds, use rewritten output.
3. If LLM fails, fallback runs grammar correction only via LanguageTool (style rewrite may not be preserved in fallback mode).
4. Replace selected text in editor.

### Fallback and reliability logic

- If message delivery to a tab/frame fails, `background.js` injects `content.js` using `chrome.scripting.executeScript` and retries.
- Right-click action passes `selectionText` and `frameId` from Chrome context menu to target the correct compose frame.
- If live selection is lost after right-click/panel click, extension uses cached selection text and stored editable element to apply replacement.
- Content script has duplicate-injection guard to avoid multiple handler registration.

## Project structure

- `manifest.json` - Extension manifest (MV3), permissions, content scripts, popup
- `background.js` - Context menu, message routing, content script injection fallback
- `content.js` - Selection capture, floating action panel, rewrite/replace behavior
- `popup.html` - Toolbar popup UI
- `popup.js` - Popup button click handler

## Exact steps to create this extension from scratch

### 1) Create a project folder

```bash
mkdir Grammar_Lite
cd Grammar_Lite
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

- creating right-click context menu: **Apply Grammar Lite**
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

- Popup contains button: **Apply Grammar Lite**
- On click, send message to background to open the in-page panel on current tab

### 7) Load extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select your `Grammar_Lite` folder

### 8) Test workflow

1. Open Gmail/Outlook web compose window
2. Highlight sentence(s)
3. Trigger one of:
   - `Shift + >`
   - right-click -> **Apply Grammar Lite**
   - extension icon -> **Apply Grammar Lite**
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
