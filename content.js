(function grammerLiteInit() {
  if (globalThis.__grammerLiteInjected) return;
  globalThis.__grammerLiteInjected = true;
  const PANEL_ID = "grammer-lite-panel";
  const STATUS_ID = "grammer-lite-status";
  const FREE_AI_ENDPOINT = "https://text.pollinations.ai";

  let cachedSelection = null;
  let lastKnownSelection = null;
  let lastKnownSelectedText = "";
  let lastEditableElement = null;

  const rewriteModes = [
    { key: "grammar", label: "Check grammar" },
    { key: "professional", label: "Make this more professional tone" },
    { key: "casual", label: "Make this casual" },
    { key: "rhyme", label: "Make this sound like rhyme" },
    { key: "shorter", label: "Make this shorter" },
    { key: "longer", label: "Make this longer" },
    { key: "direct", label: "Make it more direct" }
  ];

  function isEditableElement(node) {
    if (!node || !(node instanceof HTMLElement)) return false;
    if (node.tagName === "TEXTAREA") return true;
    if (node.tagName === "INPUT") {
      const inputType = node.type?.toLowerCase();
      return !inputType || ["text", "search", "email", "url"].includes(inputType);
    }
    return node.isContentEditable;
  }

  function getActiveEditableSelection() {
    const active = document.activeElement;
    if (isEditableElement(active) && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) {
        return {
          type: "input",
          element: active,
          editableElement: active,
          start,
          end,
          text: active.value.slice(start, end)
        };
      }
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) return null;
    if (domSelection.isCollapsed) return null;

    const range = domSelection.getRangeAt(0);
    const text = domSelection.toString();
    if (!text.trim()) return null;

    const common = range.commonAncestorContainer;
    const commonElement = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
    const editable = commonElement?.closest?.("[contenteditable]:not([contenteditable='false'])");
    return {
      type: editable ? "contenteditable" : "dom",
      editableElement: editable || commonElement || null,
      range: range.cloneRange(),
      text
    };
  }

  function refreshSelectionCache() {
    const latest = getActiveEditableSelection();
    if (latest?.text) {
      lastKnownSelection = latest;
      lastKnownSelectedText = latest.text;
      if (latest.editableElement instanceof HTMLElement) {
        lastEditableElement = latest.editableElement;
      }
    }
    return latest;
  }

  function replaceBySearchingActiveElement(originalText, newText, preferredElement) {
    const preferred = preferredElement instanceof HTMLElement ? preferredElement : null;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = preferred || active;
    if (!target || !originalText) return false;

    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      const input = target;
      const idx = input.value.indexOf(originalText);
      if (idx < 0) return false;
      input.value = input.value.slice(0, idx) + newText + input.value.slice(idx + originalText.length);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    if (target.isContentEditable) {
      const textNow = target.innerText || "";
      const idx = textNow.indexOf(originalText);
      if (idx < 0) return false;
      // Fallback replacement for editors that lose selection on context-menu click.
      target.innerText = textNow.slice(0, idx) + newText + textNow.slice(idx + originalText.length);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    return false;
  }

  function replaceSelection(selectionInfo, newText) {
    if (!selectionInfo) return false;

    if (selectionInfo.type === "input") {
      const { element, start, end } = selectionInfo;
      const original = element.value;
      element.value = original.slice(0, start) + newText + original.slice(end);
      const newCursor = start + newText.length;
      element.selectionStart = newCursor;
      element.selectionEnd = newCursor;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    if (selectionInfo.type === "contenteditable") {
      const range = selectionInfo.range.cloneRange();
      range.deleteContents();
      const textNode = document.createTextNode(newText);
      range.insertNode(textNode);

      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const afterRange = document.createRange();
        afterRange.setStart(textNode, textNode.length);
        afterRange.collapse(true);
        sel.addRange(afterRange);
      }
      return true;
    }

    if (selectionInfo.type === "dom") {
      const range = selectionInfo.range.cloneRange();
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      return true;
    }

    return false;
  }

  async function checkGrammarWithLanguageTool(text) {
    const body = new URLSearchParams();
    body.set("text", text);
    body.set("language", "en-US");

    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error("Grammar API request failed");
    }

    const data = await response.json();
    const matches = (data.matches || []).slice().sort((a, b) => b.offset - a.offset);
    let output = text;

    for (const match of matches) {
      const replacement = match.replacements?.[0]?.value;
      if (!replacement) continue;
      output = output.slice(0, match.offset) + replacement + output.slice(match.offset + match.length);
    }

    return output;
  }

  function buildInstruction(mode) {
    if (mode === "grammar") {
      return "Correct grammar, spelling, punctuation, and clarity. Keep the original meaning and tone. Return only corrected text.";
    }
    if (mode === "professional") {
      return "Rewrite this email text in a professional business tone. Keep meaning accurate and concise. Return only rewritten text.";
    }
    if (mode === "casual") {
      return "Rewrite this email text in a casual, friendly tone while preserving meaning. Return only rewritten text.";
    }
    if (mode === "rhyme") {
      return "Rewrite this email text as a playful rhyme while keeping the core meaning understandable. Return only rewritten text.";
    }
    if (mode === "shorter") {
      return "Rewrite this email text to be shorter and clearer, preserving key points. Return only rewritten text.";
    }
    if (mode === "longer") {
      return "Rewrite this email text to be longer and more detailed while preserving meaning. Return only rewritten text.";
    }
    if (mode === "direct") {
      return "Rewrite this email text to be more direct, confident, and action-oriented. Return only rewritten text.";
    }
    return "Improve this email text. Return only rewritten text.";
  }

  function normalizeAiText(text, fallback) {
    const cleaned = (text || "").trim().replace(/^["'`]+|["'`]+$/g, "");
    return cleaned || fallback;
  }

  async function rewriteWithFreeAI(mode, text) {
    const prompt = [
      "You are an expert email writing assistant.",
      buildInstruction(mode),
      "",
      "Text:",
      text
    ].join("\n");

    const url = `${FREE_AI_ENDPOINT}/${encodeURIComponent(prompt)}?model=openai&private=true`;
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      throw new Error("Free AI endpoint failed");
    }

    const output = await response.text();
    return normalizeAiText(output, text);
  }

  function ensureStyles() {
    if (document.getElementById("grammer-lite-style")) return;
    const style = document.createElement("style");
    style.id = "grammer-lite-style";
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        z-index: 2147483647;
        width: 320px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
        padding: 12px;
        font-family: Arial, sans-serif;
      }
      #${PANEL_ID} .gl-title {
        font-size: 14px;
        font-weight: 700;
        margin-bottom: 8px;
        color: #111827;
      }
      #${PANEL_ID} .gl-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
      }
      #${PANEL_ID} button {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #f9fafb;
        color: #111827;
        font-size: 13px;
        text-align: left;
        padding: 8px 10px;
        cursor: pointer;
      }
      #${PANEL_ID} button:hover {
        background: #f3f4f6;
      }
      #${PANEL_ID} .gl-footer {
        margin-top: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      #${PANEL_ID} #${STATUS_ID} {
        color: #374151;
        font-size: 12px;
        min-height: 14px;
      }
      #${PANEL_ID} .gl-close {
        background: #ffffff;
        padding: 6px 8px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removePanel() {
    const oldPanel = document.getElementById(PANEL_ID);
    if (oldPanel) oldPanel.remove();
  }

  function setStatus(text) {
    const status = document.getElementById(STATUS_ID);
    if (status) status.textContent = text;
  }

  async function applyAction(mode) {
    cachedSelection = getActiveEditableSelection() || cachedSelection || lastKnownSelection;
    const sourceText = cachedSelection?.text || lastKnownSelectedText;

    if (!sourceText) {
      setStatus("No text selected.");
      return;
    }

    try {
      setStatus("Working...");
      let output = sourceText;

      if (mode === "grammar") {
        try {
          output = await rewriteWithFreeAI(mode, output);
        } catch (error) {
          output = await checkGrammarWithLanguageTool(output);
          setStatus("Used fallback grammar engine.");
        }
      } else {
        try {
          output = await rewriteWithFreeAI(mode, output);
        } catch (error) {
          output = await checkGrammarWithLanguageTool(output);
          setStatus("AI unavailable. Applied grammar only.");
        }
      }

      let replaced = replaceSelection(cachedSelection, output);
      if (!replaced && sourceText) {
        replaced = replaceBySearchingActiveElement(
          sourceText,
          output,
          cachedSelection?.editableElement || lastEditableElement
        );
      }
      if (replaced) {
        lastKnownSelection = null;
        lastKnownSelectedText = "";
        lastEditableElement = null;
      }
      setStatus(replaced ? "Updated selection." : "Could not update selection.");
    } catch (error) {
      setStatus("Failed. Try again.");
    }
  }

  function createPanel(anchorX, anchorY) {
    removePanel();
    ensureStyles();

    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    const title = document.createElement("div");
    title.className = "gl-title";
    title.textContent = "Grammar Lite";
    panel.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "gl-grid";
    panel.appendChild(grid);

    for (const mode of rewriteModes) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = mode.label;
      button.addEventListener("click", () => applyAction(mode.key));
      grid.appendChild(button);
    }

    const footer = document.createElement("div");
    footer.className = "gl-footer";
    panel.appendChild(footer);

    const status = document.createElement("span");
    status.id = STATUS_ID;
    status.textContent = "Select an option.";
    footer.appendChild(status);

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.className = "gl-close";
    close.addEventListener("click", removePanel);
    footer.appendChild(close);

    panel.style.left = `${Math.min(anchorX, window.innerWidth - 340)}px`;
    panel.style.top = `${Math.min(anchorY + 12, window.innerHeight - 360)}px`;

    document.documentElement.appendChild(panel);
  }

  function openGrammarLite(preferredText) {
    cachedSelection = refreshSelectionCache() || lastKnownSelection;
    if (preferredText?.trim()) {
      lastKnownSelectedText = preferredText.trim();
      if (!cachedSelection) {
        cachedSelection = {
          type: "detached",
          text: lastKnownSelectedText
        };
      }
    }

    if (!cachedSelection) {
      removePanel();
      ensureStyles();
      createPanel(24, 24);
      setStatus("Highlight text in an email box first.");
      return;
    }

    let x = 24;
    let y = 24;
    if (cachedSelection.type === "contenteditable") {
      const rect = cachedSelection.range.getBoundingClientRect();
      x = rect.left + window.scrollX;
      y = rect.bottom + window.scrollY;
    } else if (cachedSelection.type === "input") {
      const rect = cachedSelection.element.getBoundingClientRect();
      x = rect.left + window.scrollX;
      y = rect.bottom + window.scrollY;
    }

    createPanel(x, y);
  }

  function shouldHandleShortcut(event) {
    const primaryModifierPressed = event.shiftKey;
    const disallowOtherModifiers = !event.altKey && !event.ctrlKey && !event.metaKey;
    const key = event.key || "";
    const isGreaterThan = key === ">" || (key === "." && event.shiftKey);
    return primaryModifierPressed && disallowOtherModifiers && isGreaterThan;
  }

  // Capture Shift + > only when there is highlighted text.
  document.addEventListener(
    "keydown",
    (event) => {
      if (!shouldHandleShortcut(event)) return;
      const selectedNow = refreshSelectionCache() || lastKnownSelection;
      if (!selectedNow?.text) return;

      event.preventDefault();
      event.stopPropagation();
      openGrammarLite();
    },
    true
  );

  document.addEventListener("selectionchange", () => {
    refreshSelectionCache();
  });

  document.addEventListener("mouseup", () => {
    refreshSelectionCache();
  });

  document.addEventListener("keyup", () => {
    refreshSelectionCache();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "GRAMMER_LITE_OPEN") {
      openGrammarLite(message.selectedText);
    }
  });
})();
