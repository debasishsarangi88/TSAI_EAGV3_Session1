async function ensureContentScript(tabId, frameIds) {
  const target = { tabId };
  if (Array.isArray(frameIds) && frameIds.length > 0) {
    target.frameIds = frameIds;
  } else {
    target.allFrames = true;
  }

  try {
    await chrome.scripting.executeScript({
      target,
      files: ["content.js"]
    });
  } catch (error) {
    // Ignore restricted pages where scripts cannot be injected.
  }
}

async function sendOpenMessage(tabId, selectedText, frameId) {
  const message = { type: "GRAMMER_LITE_OPEN", selectedText: selectedText || "" };
  const options = {};
  if (typeof frameId === "number" && frameId >= 0) {
    options.frameId = frameId;
  }

  try {
    await chrome.tabs.sendMessage(tabId, message, options);
    return true;
  } catch (error) {
    const frameIds = typeof frameId === "number" && frameId >= 0 ? [frameId] : undefined;
    await ensureContentScript(tabId, frameIds);
    try {
      await chrome.tabs.sendMessage(tabId, message, options);
      return true;
    } catch (retryError) {
      return false;
    }
  }
}

async function openInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await sendOpenMessage(tab.id);
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "grammer-lite-open",
      title: "Apply Grammer Lite",
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "grammer-lite-open") return;
  if (!tab?.id) return;

  await sendOpenMessage(tab.id, info.selectionText, info.frameId);
});

chrome.action.onClicked.addListener(() => {
  openInActiveTab();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GRAMMER_LITE_OPEN_FROM_POPUP") return;

  openInActiveTab()
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));

  return true;
});

createContextMenu();
