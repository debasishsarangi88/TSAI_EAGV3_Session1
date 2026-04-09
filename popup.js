document.getElementById("apply-btn")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GRAMMER_LITE_OPEN_FROM_POPUP" }, () => {
    window.close();
  });
});
