document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save-btn").addEventListener("click", saveOptions);

function restoreOptions() {
  chrome.storage.local.get({
    apiProvider: "openai",
    openaiApiKey: "",
    geminiApiKey: "",
    claudeApiKey: ""
  }, function(items) {
    document.getElementById("api-select").value = items.apiProvider;
    document.getElementById("openai-api-key").value = items.openaiApiKey;
    document.getElementById("gemini-api-key").value = items.geminiApiKey;
    document.getElementById("claude-api-key").value = items.claudeApiKey;
    
    // ステータス更新
    updateApiStatus("openai", items.openaiApiKey);
    updateApiStatus("gemini", items.geminiApiKey);
    updateApiStatus("claude", items.claudeApiKey);
  });
}

function updateApiStatus(provider, apiKey) {
  const statusEl = document.getElementById(provider + "-status");
  if (!statusEl) return;
  
  const dot = statusEl.querySelector(".dot");
  const text = statusEl.querySelector("span:last-child");
  
  if (apiKey && apiKey.length > 0) {
    dot.classList.add("active");
    text.textContent = "設定済み";
  } else {
    dot.classList.remove("active");
    text.textContent = "未設定";
  }
}

function saveOptions() {
  const selectedApi = document.getElementById("api-select").value;
  const openaiKey = document.getElementById("openai-api-key").value.trim();
  const geminiKey = document.getElementById("gemini-api-key").value.trim();
  const claudeKey = document.getElementById("claude-api-key").value.trim();
  
  // 選択中のAPIのキーが設定されているか確認
  let selectedKeySet = false;
  switch(selectedApi) {
    case "openai": selectedKeySet = openaiKey.length > 0; break;
    case "gemini": selectedKeySet = geminiKey.length > 0; break;
    case "claude": selectedKeySet = claudeKey.length > 0; break;
  }
  
  if (!selectedKeySet) {
    showToast("選択中のAPIのキーを入力してください", true);
    return;
  }
  
  chrome.storage.local.set({
    apiProvider: selectedApi,
    openaiApiKey: openaiKey,
    geminiApiKey: geminiKey,
    claudeApiKey: claudeKey
  }, function() {
    // ステータス更新
    updateApiStatus("openai", openaiKey);
    updateApiStatus("gemini", geminiKey);
    updateApiStatus("claude", claudeKey);
    
    showToast("設定を保存しました");
  });
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast" + (isError ? " error" : "");
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
