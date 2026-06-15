(function () {
  const els = {
    left: document.querySelector("#leftInput"),
    right: document.querySelector("#rightInput"),
    mode: document.querySelector("#mergeMode"),
    summary: document.querySelector("#mergeSummary"),
    result: document.querySelector("#mergeResult"),
    copy: document.querySelector("#mergeCopyBtn"),
    clear: document.querySelector("#mergeClearBtn"),
    toast: document.querySelector("#toast"),
    caseBtn: document.querySelector("#mergeCaseBtn"),
    caseMenu: document.querySelector("#mergeCaseMenu"),
  };

  const samples = {
    basic: [
      JSON.stringify(
        {
          app: "lzyjson",
          config: {
            theme: "light",
            retry: 1,
          },
          features: ["parse", "compare"],
        },
        null,
        2,
      ),
      JSON.stringify(
        {
          config: {
            retry: 3,
            timeoutMs: 5000,
          },
          features: ["merge"],
          enabled: true,
        },
        null,
        2,
      ),
    ],
    nested: [
      `2026-06-15 INFO body=${JSON.stringify({
        user: {
          id: 1001,
          name: "张三",
          profile: {
            city: "上海",
            phone: "13800138000",
          },
          roles: ["reader"],
        },
        meta: {
          version: "1.0.0",
        },
      })} cost=18ms`,
      `2026-06-15 INFO patch=${JSON.stringify({
        user: {
          profile: {
            city: "杭州",
            email: "zhangsan@example.com",
          },
          roles: ["admin"],
        },
        meta: {
          version: "1.1.0",
          source: "manual",
        },
      })}`,
    ],
    array: [
      JSON.stringify(
        {
          data: {
            list: [
              { id: 1, name: "alpha" },
              { id: 2, name: "beta" },
            ],
          },
        },
        null,
        2,
      ),
      JSON.stringify(
        {
          data: {
            list: [
              { id: 3, name: "gamma" },
              { id: 4, name: "delta" },
            ],
          },
        },
        null,
        2,
      ),
    ],
  };

  let currentResultText = "";

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function classifyChar(ch) {
    if (ch === "{") return "}";
    if (ch === "[") return "]";
    return null;
  }

  function shouldStartCandidate(text, index) {
    const ch = text[index];
    if (ch === "{") return true;
    if (ch !== "[") return false;
    const previous = text[index - 1] || "";
    if (!previous || /\s/.test(previous)) return true;
    return ["=", ":", ",", "(", "{", "["].includes(previous);
  }

  function findCandidateStarts(text) {
    const starts = [];
    let inString = false;
    let escaping = false;
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (inString) {
        if (escaping) escaping = false;
        else if (ch === "\\") escaping = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (classifyChar(ch) && shouldStartCandidate(text, index)) starts.push(index);
    }
    return starts;
  }

  function scanFrom(text, start) {
    const stack = [classifyChar(text[start])];
    let inString = false;
    let escaping = false;
    for (let index = start + 1; index < text.length; index += 1) {
      const ch = text[index];
      if (inString) {
        if (escaping) escaping = false;
        else if (ch === "\\") escaping = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      const closer = classifyChar(ch);
      if (closer) {
        stack.push(closer);
        continue;
      }
      if (ch === "}" || ch === "]") {
        if (stack[stack.length - 1] !== ch) return null;
        stack.pop();
        if (!stack.length) return text.slice(start, index + 1);
      }
    }
    return null;
  }

  function tryParse(raw) {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function parseBest(text) {
    const trimmed = text.trim();
    const direct = tryParse(trimmed);
    if (direct.ok) return direct;

    for (const start of findCandidateStarts(trimmed)) {
      const raw = scanFrom(trimmed, start);
      if (!raw) continue;
      const parsed = tryParse(raw);
      if (parsed.ok) return parsed;
    }
    return { ok: false, error: direct.error?.message || "没有找到 JSON" };
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function deepMerge(left, right, mode) {
    if (Array.isArray(left) && Array.isArray(right)) {
      return mode === "concat" ? [...clone(left), ...clone(right)] : clone(right);
    }
    if (!isPlainObject(left) || !isPlainObject(right)) return clone(right);

    const output = clone(left);
    for (const [key, value] of Object.entries(right)) {
      output[key] = key in output ? deepMerge(output[key], value, mode) : clone(value);
    }
    return output;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function valueSummary(value) {
    if (Array.isArray(value)) return `数组 ${value.length} 项`;
    if (isPlainObject(value)) return `对象 ${Object.keys(value).length} 个字段`;
    return typeof value;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1600);
  }

  function renderJsonText(target, value) {
    target.innerHTML = "";
    if (value === null || value === undefined) return;
    renderJsonTextNode(target, null, value, 0, true, true, false);
  }

  function renderJsonTextNode(parent, key, value, depth, isLast, isRoot, parentIsArray) {
    const isContainer = value && typeof value === "object";
    const node = document.createElement("div");
    node.className = "json-text-node";

    const line = document.createElement("div");
    line.className = "json-text-line";
    line.style.setProperty("--text-depth", depth);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = isContainer ? "json-text-toggle" : "json-text-toggle empty";
    toggle.textContent = isContainer ? "▾" : "";
    line.append(toggle);

    const code = document.createElement("code");
    line.append(code);
    node.append(line);

    if (!isContainer) {
      code.textContent = `${jsonTextPrefix(key, isRoot, parentIsArray)}${JSON.stringify(value)}${isLast ? "" : ","}`;
      parent.append(node);
      return;
    }

    const isArray = Array.isArray(value);
    const opener = isArray ? "[" : "{";
    const closer = isArray ? "]" : "}";
    const expandedText = `${jsonTextPrefix(key, isRoot, parentIsArray)}${opener}`;
    const collapsedText = `${jsonTextPrefix(key, isRoot, parentIsArray)}${opener}...${closer}${isLast ? "" : ","}`;
    code.textContent = expandedText;

    const children = document.createElement("div");
    children.className = "json-text-children";
    const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value);
    entries.forEach(([childKey, childValue], index) => {
      renderJsonTextNode(children, childKey, childValue, depth + 1, index === entries.length - 1, false, isArray);
    });
    node.append(children);

    const closing = document.createElement("div");
    closing.className = "json-text-line json-text-closing";
    closing.style.setProperty("--text-depth", depth);
    const closingSpacer = document.createElement("span");
    closingSpacer.className = "json-text-toggle empty";
    const closingCode = document.createElement("code");
    closingCode.textContent = `${closer}${isLast ? "" : ","}`;
    closing.append(closingSpacer, closingCode);
    node.append(closing);

    toggle.addEventListener("click", () => {
      const collapsed = node.classList.toggle("collapsed");
      toggle.textContent = collapsed ? "▸" : "▾";
      code.textContent = collapsed ? collapsedText : expandedText;
    });

    parent.append(node);
  }

  function jsonTextPrefix(key, isRoot, parentIsArray) {
    if (isRoot || parentIsArray) return "";
    return `${JSON.stringify(String(key))}: `;
  }

  function render() {
    currentResultText = "";
    els.result.innerHTML = "";
    const leftText = els.left.value.trim();
    const rightText = els.right.value.trim();
    if (!leftText || !rightText) {
      els.summary.textContent = "等待输入";
      return;
    }

    const left = parseBest(leftText);
    const right = parseBest(rightText);
    if (!left.ok || !right.ok) {
      els.summary.textContent = `解析失败：左侧 ${left.ok ? "OK" : left.error} · 右侧 ${right.ok ? "OK" : right.error}`;
      return;
    }

    const merged = deepMerge(left.value, right.value, els.mode.value);
    currentResultText = JSON.stringify(merged, null, 2);
    renderJsonText(els.result, merged);
    els.summary.textContent = `合并完成：左侧 ${valueSummary(left.value)} · 右侧 ${valueSummary(right.value)} · 结果 ${valueSummary(merged)}`;
  }

  els.caseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = els.caseMenu.hidden;
    els.caseMenu.hidden = !nextOpen;
    els.caseBtn.setAttribute("aria-expanded", String(nextOpen));
  });

  els.caseMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-merge-sample]");
    if (!button) return;
    const [left, right] = samples[button.dataset.mergeSample] || samples.basic;
    els.left.value = left;
    els.right.value = right;
    if (button.dataset.mergeSample === "array") els.mode.value = "concat";
    els.caseMenu.hidden = true;
    els.caseBtn.setAttribute("aria-expanded", "false");
    render();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".case-menu")) {
      els.caseMenu.hidden = true;
      els.caseBtn.setAttribute("aria-expanded", "false");
    }
  });

  els.copy.addEventListener("click", async () => {
    if (!currentResultText) return;
    await navigator.clipboard.writeText(currentResultText);
    showToast("已复制");
  });

  els.clear.addEventListener("click", () => {
    els.left.value = "";
    els.right.value = "";
    render();
  });

  els.left.addEventListener("input", debounce(render, 120));
  els.right.addEventListener("input", debounce(render, 120));
  els.mode.addEventListener("change", render);
  render();
})();
