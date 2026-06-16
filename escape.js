(function () {
  const els = {
    input: document.querySelector("#escapeInput"),
    output: document.querySelector("#escapeOutput"),
    summary: document.querySelector("#escapeSummary"),
    mode: document.querySelector("#escapeMode"),
    escapeBtn: document.querySelector("#escapeBtn"),
    unescapeBtn: document.querySelector("#unescapeBtn"),
    copyBtn: document.querySelector("#escapeCopyBtn"),
    clearBtn: document.querySelector("#escapeClearBtn"),
    caseBtn: document.querySelector("#escapeCaseBtn"),
    caseMenu: document.querySelector("#escapeCaseMenu"),
    toast: document.querySelector("#toast"),
  };

  const samples = {
    json: JSON.stringify(
      {
        body: {
          name: "张三",
          msg: "你好",
          roles: ["admin", "ops"],
        },
      },
      null,
      2,
    ),
    string:
      '"{\\\"body\\\":{\\\"name\\\":\\\"张三\\\",\\\"msg\\\":\\\"你好\\\",\\\"roles\\\":[\\\"admin\\\",\\\"ops\\\"]}}"',
    unicode: "用户不存在：张三，消息：你好 / Hello",
    url:
      "https://yourdomain.com/api/parse?source=http%3A%2F%2Fexample.com%2Fdata%3Fid%3D123%26type%3Djson&callback=handleResponse&data=%7B%22name%22%3A%22John%20%26%20Doe%22%2C%22msg%22%3A%22Hello%20%2F%20World%22%7D&empty=&special=%21%40%23%24%25%5E%26%2A%28%29_%2B-%3D%5B%5D%7B%7D%3B%3A%27%22%2C.%2F%3F&encoded_twice=%252Fpath%252Fto%252Ffile",
  };

  function tryParse(value) {
    try {
      return { ok: true, value: JSON.parse(value) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function normalizeInputForEscaping(text) {
    const parsed = tryParse(text);
    if (parsed.ok) return JSON.stringify(parsed.value);
    return text;
  }

  function escapeJsonText() {
    const text = els.input.value;
    if (!text.trim()) {
      clearResult();
      return;
    }
    const normalized = normalizeInputForEscaping(text);
    els.output.value = JSON.stringify(normalized);
    els.summary.textContent = `JSON 字符串已转义 · ${els.output.value.length} 字符`;
  }

  function unescapeJsonText() {
    const text = els.input.value.trim();
    if (!text) {
      clearResult();
      return;
    }
    const parsed = tryParse(text);
    if (!parsed.ok) {
      els.summary.textContent = `JSON 字符串还原失败：${parsed.error.message}`;
      return;
    }
    if (typeof parsed.value === "string") {
      const nested = tryParse(parsed.value);
      els.output.value = nested.ok ? JSON.stringify(nested.value, null, 2) : parsed.value;
    } else {
      els.output.value = JSON.stringify(parsed.value, null, 2);
    }
    els.summary.textContent = `JSON 字符串已还原 · ${els.output.value.length} 字符`;
  }

  function escapeUnicodeText() {
    const text = els.input.value;
    if (!text.trim()) {
      clearResult();
      return;
    }
    els.output.value = text.replace(/[^\x00-\x7F]/g, (char) =>
      `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
    els.summary.textContent = `中文已转 Unicode · ${els.output.value.length} 字符`;
  }

  function unescapeUnicodeText() {
    const text = els.input.value;
    if (!text.trim()) {
      clearResult();
      return;
    }
    els.output.value = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    els.summary.textContent = `Unicode 已还原 · ${els.output.value.length} 字符`;
  }

  function escapeUrlText() {
    const text = els.input.value;
    if (!text.trim()) {
      clearResult();
      return;
    }
    els.output.value = encodeURI(text);
    els.summary.textContent = `URL 已编码 · ${els.output.value.length} 字符`;
  }

  function unescapeUrlText() {
    const text = els.input.value;
    if (!text.trim()) {
      clearResult();
      return;
    }
    els.output.value = decodeUrlForDisplay(text);
    els.summary.textContent = `URL 已解码 · ${els.output.value.length} 字符`;
  }

  function decodeUrlForDisplay(text) {
    const [withoutHash, hash = ""] = text.split("#", 2);
    const queryIndex = withoutHash.indexOf("?");
    if (queryIndex === -1) return decodeRepeatedUrlComponent(text, 2);

    const base = decodeRepeatedUrlComponent(withoutHash.slice(0, queryIndex), 2);
    const query = withoutHash.slice(queryIndex + 1);
    const lines = [base];
    if (query) {
      for (const part of query.split("&")) {
        const equalIndex = part.indexOf("=");
        const rawKey = equalIndex === -1 ? part : part.slice(0, equalIndex);
        const rawValue = equalIndex === -1 ? "" : part.slice(equalIndex + 1);
        const key = decodeRepeatedUrlComponent(rawKey, 2);
        const value = decodeRepeatedUrlComponent(rawValue, 2);
        lines.push(`${key}=${value}`);
      }
    }
    if (hash) lines.push(`#${decodeRepeatedUrlComponent(hash, 2)}`);
    return lines.join("\n");
  }

  function decodeRepeatedUrlComponent(text, maxRounds) {
    let current = text;
    for (let round = 0; round < maxRounds; round += 1) {
      const decoded = safeDecodeUrlComponentOnce(current);
      if (decoded === current) return decoded;
      current = decoded;
    }
    return current;
  }

  function safeDecodeUrlComponentOnce(text) {
    try {
      return decodeURIComponent(text);
    } catch {
      return text.replace(/%[0-9a-fA-F]{2}/g, (token) => {
        try {
          return decodeURIComponent(token);
        } catch {
          return token;
        }
      });
    }
  }

  function runEscape() {
    saveEscapeSettings();
    if (els.mode.value === "unicode") escapeUnicodeText();
    else if (els.mode.value === "url") escapeUrlText();
    else escapeJsonText();
  }

  function runUnescape() {
    saveEscapeSettings();
    if (els.mode.value === "unicode") unescapeUnicodeText();
    else if (els.mode.value === "url") unescapeUrlText();
    else unescapeJsonText();
  }

  function clearResult() {
    els.output.value = "";
    els.summary.textContent = "等待输入";
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1600);
  }

  function applyStoredEscapeSettings() {
    const savedMode = localStorage.getItem("lzyjson-escape-mode");
    if (["json", "unicode", "url"].includes(savedMode)) els.mode.value = savedMode;
  }

  function saveEscapeSettings() {
    localStorage.setItem("lzyjson-escape-mode", els.mode.value);
  }

  els.caseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = els.caseMenu.hidden;
    els.caseMenu.hidden = !nextOpen;
    els.caseBtn.setAttribute("aria-expanded", String(nextOpen));
  });

  els.caseMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-escape-sample]");
    if (!button) return;
    els.input.value = samples[button.dataset.escapeSample] || samples.json;
    els.caseMenu.hidden = true;
    els.caseBtn.setAttribute("aria-expanded", "false");
    if (button.dataset.escapeSample === "string") {
      els.mode.value = "json";
      saveEscapeSettings();
      runUnescape();
    } else if (button.dataset.escapeSample === "unicode") {
      els.mode.value = "unicode";
      saveEscapeSettings();
      runEscape();
    } else if (button.dataset.escapeSample === "url") {
      els.mode.value = "url";
      saveEscapeSettings();
      runUnescape();
    } else {
      els.mode.value = "json";
      saveEscapeSettings();
      runEscape();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".case-menu")) {
      els.caseMenu.hidden = true;
      els.caseBtn.setAttribute("aria-expanded", "false");
    }
  });

  els.escapeBtn.addEventListener("click", runEscape);
  els.unescapeBtn.addEventListener("click", runUnescape);
  els.mode.addEventListener("change", saveEscapeSettings);
  els.copyBtn.addEventListener("click", async () => {
    if (!els.output.value) return;
    await navigator.clipboard.writeText(els.output.value);
    showToast("已复制");
  });
  els.clearBtn.addEventListener("click", () => {
    els.input.value = "";
    clearResult();
  });
  applyStoredEscapeSettings();
})();
