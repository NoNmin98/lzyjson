(function () {
  const els = {
    source: document.querySelector("#sourceInput"),
    workspace: document.querySelector(".workspace"),
    splitHandle: document.querySelector("#splitHandle"),
    diffInput: document.querySelector("#diffInput"),
    inputMeta: document.querySelector("#inputMeta"),
    resultMeta: document.querySelector("#resultMeta"),
    status: document.querySelector("#statusPanel"),
    candidates: document.querySelector("#candidateBar"),
    context: document.querySelector("#contextPanel"),
    contextToggle: document.querySelector("#contextToggle"),
    contextClose: document.querySelector("#contextCloseBtn"),
    prefix: document.querySelector("#prefixView"),
    suffix: document.querySelector("#suffixView"),
    copyPrefix: document.querySelector("#copyPrefixBtn"),
    copySuffix: document.querySelector("#copySuffixBtn"),
    tree: document.querySelector("#treeView"),
    raw: document.querySelector("#rawView"),
    table: document.querySelector("#tableView"),
    diff: document.querySelector("#diffView"),
    diffSummary: document.querySelector("#diffSummary"),
    diffResult: document.querySelector("#diffResult"),
    search: document.querySelector("#searchInput"),
    toast: document.querySelector("#toast"),
    caseMenuBtn: document.querySelector("#caseMenuBtn"),
    caseMenu: document.querySelector("#caseMenu"),
    fontDown: document.querySelector("#fontDownBtn"),
    fontUp: document.querySelector("#fontUpBtn"),
    fontSizeLabel: document.querySelector("#fontSizeLabel"),
    options: {
      decodeUnicode: document.querySelector("#decodeUnicodeOption"),
      expandStringJsonSingle: document.querySelector("#expandStringJsonSingleOption"),
      expandStringJsonDeep: document.querySelector("#expandStringJsonDeepOption"),
    },
    tabs: {
      tree: document.querySelector("#treeTab"),
      raw: document.querySelector("#rawTab"),
      table: document.querySelector("#tableTab"),
    },
  };

  const state = {
    candidates: [],
    selected: 0,
    parsed: null,
    rawParsed: null,
    formatted: "",
    activeView: readStorageValue("lzyjson-active-view", "tree"),
    maskedBefore: null,
    contextOpen: false,
    codeFontSize: Number(localStorage.getItem("lzyjson-code-font-size")) || 13,
  };

  const sample = `2026-06-12 17:20:18 INFO traceId=ab8c request finished body={"code":0,"msg":"\\\\u7528\\\\u6237\\\\u4e0d\\\\u5b58\\\\u5728","data":"{\\\"user\\\":{\\\"id\\\":123,\\\"name\\\":\\\"\\\\u5f20\\\\u4e09\\\"},\\\"roles\\\":[\\\"admin\\\",\\\"ops\\\"]}","token":"Bearer abc.def.ghi","items":[{"id":1,"name":"alpha"},{"id":2,"name":"beta"}]} cost=42ms

下一行是被截断的 JSON:
{"ok":true,"data":{"list":[{"id":1},{"id":2}]`;

  const multiSample = `2026-06-12 17:20:18 INFO traceId=ab8c request finished body={"code":0,"msg":"\\\\u7528\\\\u6237\\\\u4e0d\\\\u5b58\\\\u5728","data":"{\\\"user\\\":{\\\"id\\\":123,\\\"name\\\":\\\"\\\\u5f20\\\\u4e09\\\"},\\\"roles\\\":[\\\"admin\\\",\\\"ops\\\"]}","token":"Bearer abc.def.ghi","items":[{"id":1,"name":"alpha"},{"id":2,"name":"beta"}]} cost=42ms

下一行是被截断的 JSON:
{"ok":true,"data":{"list":[{"id":1},{"id":211}]

下一行是完整 JSON11:
{"ok":true,"data":{"list":[{"id":1},{"id":222}]}}

下一行是完整 JSON222:
{"ok":true,"data":{"list":[{"id":1},{"id":2333}]}}

req={"method":"GET","path":"/api/user","query":{"id":123}} resp={"status":200,"body":{"ok":true,"name":"demo"}}`;

  const escapedSingleSample = JSON.stringify(
    {
      code: 0,
      body: JSON.stringify({
        name: "张三",
        msg: "你好",
        tags: ["admin", "ops"],
      }),
      note: "开启单层转义 JSON 后，body 会展开为对象",
    },
    null,
    2,
  );

  const escapedMultiSample = JSON.stringify(
    {
      code: 0,
      data: JSON.stringify({
        payload: JSON.stringify({
          title: "测试",
          user: {
            id: 123,
            name: "张三",
          },
          extra: JSON.stringify({
            city: "杭州",
            enabled: true,
          }),
        }),
      }),
      note: "开启多层转义 JSON 后，data.payload.extra 会继续展开",
    },
    null,
    2,
  );

  const longSample = buildLongSample();

  function buildLongSample() {
    const users = Array.from({ length: 80 }, (_, index) => ({
      id: 10000 + index,
      name: `用户-${index + 1}`,
      active: index % 3 !== 0,
      tags: [`team-${index % 6}`, `region-${index % 4}`, index % 2 ? "beta" : "stable"],
      profile: {
        city: ["上海", "北京", "深圳", "杭州"][index % 4],
        score: Number((((index * 37) % 100) + 0.42).toFixed(2)),
        permissions: {
          read: true,
          write: index % 4 === 0,
          admin: index % 17 === 0,
        },
      },
      events: Array.from({ length: 4 }, (_, eventIndex) => ({
        type: ["login", "query", "export", "logout"][eventIndex],
        at: `2026-06-12T${String((index + eventIndex) % 24).padStart(2, "0")}:30:00+08:00`,
        costMs: 20 + index * 3 + eventIndex,
      })),
    }));

    return `2026-06-12 INFO large payload traceId=long-demo body=${JSON.stringify({
      code: 0,
      message: "\\u8d85\\u957f JSON \\u793a\\u4f8b",
      page: { current: 1, size: 80, total: 8000 },
      users,
      embedded: JSON.stringify({
        source: "string-json",
        note: "\\u8fd9\\u662f\\u5d4c\\u5957\\u5b57\\u7b26\\u4e32 JSON",
        deep: { ok: true, list: [1, 2, 3, 4, 5] },
      }),
    })} cost=128ms`;
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1400);
  }

  function setStatus(kind, message) {
    els.status.className = `status-panel ${kind}`;
    els.status.textContent = message;
    els.status.hidden = false;
  }

  function hideStatus() {
    els.status.hidden = true;
    els.status.textContent = "";
  }

  function classifyChar(ch) {
    if (ch === "{") return "}";
    if (ch === "[") return "]";
    return null;
  }

  function findJsonCandidates(text) {
    const found = [];
    const starts = findCandidateStarts(text);

    for (const start of starts) {
      const result = scanFrom(text, start);
      if (!result || result.raw.trim().length < 2) continue;
      const candidate = buildCandidate(text, result);
      if (candidate) found.push(candidate);
    }

    const deduped = [];
    const seen = new Set();
    for (const item of found) {
      const comparable = item.repairedText || item.raw;
      const key = item.repaired
        ? `${item.valid}:${item.repaired}:${comparable.trim()}`
        : `${item.valid}:${item.repaired}:${item.start}:${item.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    return deduped.sort((a, b) => a.start - b.start || b.raw.length - a.raw.length);
  }

  function findCandidateStarts(text) {
    const starts = [];
    let inString = false;
    let escaping = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];

      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      const closer = classifyChar(ch);
      if (closer && shouldStartCandidate(text, i)) {
        starts.push(i);
      }
    }

    return starts;
  }

  function shouldStartCandidate(text, index) {
    const ch = text[index];
    if (ch === "{") return true;
    if (ch !== "[") return false;

    const previous = text[index - 1] || "";
    if (!previous || /\s/.test(previous)) return true;
    return ["=", ":", ",", "(", "{", "["].includes(previous);
  }

  function scanFrom(text, start) {
    const stack = [classifyChar(text[start])];
    let inString = false;
    let escaping = false;

    for (let i = start + 1; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
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
        if (stack.length === 0) {
          return {
            start,
            end: i + 1,
            raw: text.slice(start, i + 1),
            missingClosers: "",
          };
        }
      }
    }

    if (stack.length > 0) {
      return {
        start,
        end: text.length,
        raw: text.slice(start),
        missingClosers: stack.reverse().join(""),
      };
    }

    return null;
  }

  function buildCandidate(text, scan) {
    const direct = tryParse(scan.raw);
    if (direct.ok) {
      return {
        ...scan,
        parsed: direct.value,
        valid: true,
        repaired: false,
        label: labelFor(text, scan, "JSON"),
      };
    }

    if (scan.missingClosers) {
      const repairedScan = findRepairablePrefix(scan);
      const repairedText = repairedScan.raw + repairedScan.missingClosers;
      const repaired = tryParse(repairedText);
      if (repaired.ok) {
        return {
          ...repairedScan,
          parsed: repaired.value,
          valid: true,
          repaired: true,
          repairedText,
          label: labelFor(text, repairedScan, "截断 JSON"),
          note: `内容像是被截断了，已临时补上 ${repairedScan.missingClosers} 用于预览。`,
        };
      }
    }

    return null;
  }

  function findRepairablePrefix(scan) {
    const attempts = [scan.raw.length];
    for (let i = scan.raw.length - 1; i >= 0; i -= 1) {
      if (scan.raw[i] === "\n") attempts.push(i);
    }

    for (const end of attempts) {
      const raw = scan.raw.slice(0, end).trimEnd();
      if (raw.length < 2) continue;
      const missingClosers = missingClosersFor(raw);
      if (!missingClosers) continue;
      if (tryParse(raw + missingClosers).ok) {
        return {
          ...scan,
          end: scan.start + raw.length,
          raw,
          missingClosers,
        };
      }
    }

    return scan;
  }

  function missingClosersFor(fragment) {
    const stack = [classifyChar(fragment[0])];
    let inString = false;
    let escaping = false;

    for (let i = 1; i < fragment.length; i += 1) {
      const ch = fragment[i];
      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
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
        if (stack[stack.length - 1] !== ch) return "";
        stack.pop();
      }
    }

    if (inString) return "";
    return stack.reverse().join("");
  }

  function parseJsonLines(text) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return null;

    const values = [];
    for (const line of lines) {
      const parsed = tryParse(line);
      if (!parsed.ok) return null;
      values.push(parsed.value);
    }
    return {
      start: 0,
      end: text.length,
      raw: text,
      parsed: values,
      valid: true,
      repaired: false,
      label: `JSON Lines · ${values.length} 行`,
      note: "已按 JSON Lines 解析为数组预览。",
    };
  }

  function labelFor(text, scan, fallback) {
    const before = text.slice(0, scan.start).split(/\r?\n/).length;
    const size = scan.raw.length;
    return `${fallback} · 第 ${before} 行 · ${size} 字符`;
  }

  function tryParse(value) {
    try {
      return { ok: true, value: JSON.parse(value) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function normalizeValue(value, options, depth = 0, seen = new WeakSet(), stringJsonDepth = 0) {
    if (depth > options.maxDepth) return value;

    if (Array.isArray(value)) {
      if (seen.has(value)) return value;
      seen.add(value);
      return value.map((item) => normalizeValue(item, options, depth + 1, seen, stringJsonDepth));
    }

    if (value && typeof value === "object") {
      if (seen.has(value)) return value;
      seen.add(value);
      const output = {};
      for (const [key, child] of Object.entries(value)) {
        output[key] = normalizeValue(child, options, depth + 1, seen, stringJsonDepth);
      }
      return output;
    }

    if (typeof value !== "string") return value;

    const decoded = options.decodeUnicode ? decodeLooseUnicode(value) : value;
    const trimmed = decoded.trim();
    if (
      shouldExpandStringJson(options, stringJsonDepth) &&
      ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]")))
    ) {
      const parsed = tryParse(trimmed);
      if (parsed.ok) {
        const nested = normalizeValue(parsed.value, options, depth + 1, seen, stringJsonDepth + 1);
        if (nested && typeof nested === "object") {
          Object.defineProperty(nested, "__lzyNestedJson", {
            value: true,
            enumerable: false,
          });
        }
        return nested;
      }
    }

    return decoded;
  }

  function shouldExpandStringJson(options, stringJsonDepth) {
    if (options.expandStringJsonDeep) return stringJsonDepth < options.maxStringJsonDepth;
    if (options.expandStringJsonSingle) return stringJsonDepth < 1;
    return false;
  }

  function decodeLooseUnicode(value) {
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  }

  function stringifyPretty(value) {
    return JSON.stringify(value, null, 2);
  }

  function parseBestValue(text, options = getOptions()) {
    const candidates = collectCandidates(text);
    const candidate = candidates.find((item) => item.valid);
    if (!candidate) {
      return {
        ok: false,
        error: candidates[0]?.error || "没有找到可解析的 JSON",
      };
    }

    return {
      ok: true,
      candidate,
      value: normalizeValue(candidate.parsed, options),
    };
  }

  function collectCandidates(text) {
    const whole = tryParse(text);
    let candidates = [];
    if (whole.ok) {
      candidates.push({
        start: 0,
        end: text.length,
        raw: text,
        parsed: whole.value,
        valid: true,
        repaired: false,
        label: "完整 JSON",
      });
    }

    const jsonLines = parseJsonLines(text);
    if (jsonLines) candidates.push(jsonLines);
    return uniqueCandidates(filterContainedCandidates(candidates.concat(findJsonCandidates(text))));
  }

  function analyze() {
    const text = els.source.value;
    els.inputMeta.textContent = `${text.length} 字符`;
    els.candidates.hidden = true;
    els.candidates.innerHTML = "";

    if (!text.trim()) {
      state.candidates = [];
      state.parsed = null;
      state.rawParsed = null;
      state.formatted = "";
      els.context.hidden = true;
      els.resultMeta.textContent = "等待输入";
      setStatus("idle", "粘贴内容后自动解析。所有处理都在本地浏览器完成。");
      renderAll();
      return;
    }

    const whole = tryParse(text);
    const candidates = collectCandidates(text);

    state.candidates = candidates;
    state.selected = 0;

    if (!candidates.length) {
      state.parsed = null;
      state.rawParsed = null;
      state.formatted = "";
      els.context.hidden = true;
      const err = whole.error ? `解析失败：${whole.error.message}` : "没有找到 JSON 片段";
      setStatus("error", `${err}。可以检查是否少了开头的 { 或 [。`);
      els.resultMeta.textContent = "未解析";
      renderAll();
      return;
    }

    chooseCandidate(0, false);
    renderCandidateBar();
  }

  function filterContainedCandidates(candidates) {
    return candidates.filter((candidate, index) => {
      return !candidates.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        if (!other.valid) return false;
        const otherSize = other.end - other.start;
        const candidateSize = candidate.end - candidate.start;
        return (
          otherSize > candidateSize &&
          candidate.start >= other.start &&
          candidate.end <= other.end
        );
      });
    });
  }

  function uniqueCandidates(candidates) {
    const output = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const comparable = candidate.repairedText || candidate.raw;
      const key = candidate.repaired
        ? `${candidate.valid}:${candidate.repaired}:${comparable.trim()}`
        : `${candidate.valid}:${candidate.repaired}:${candidate.start}:${candidate.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push(candidate);
      }
    }
    return output;
  }

  function chooseCandidate(index, rerenderBar = true) {
    state.selected = index;
    const candidate = state.candidates[index];

    if (!candidate || !candidate.valid) {
      state.parsed = null;
      state.rawParsed = null;
      state.formatted = candidate ? candidate.raw : "";
      renderContext(candidate);
      setStatus("error", candidate?.error || "这个片段不是有效 JSON。");
      els.resultMeta.textContent = "未解析";
      renderAll();
      return;
    }

    state.rawParsed = candidate.parsed;
    state.parsed = normalizeValue(candidate.parsed, getOptions());
    state.formatted = stringifyPretty(state.parsed);
    els.resultMeta.textContent = `${measureValue(state.parsed)} · ${state.formatted.length} 字符`;

    if (candidate.repaired) {
      setStatus("warn", candidate.note);
    } else if (candidate.note) {
      setStatus("warn", candidate.note);
    } else if (candidate.start > 0 || candidate.end < els.source.value.length) {
      hideStatus();
    } else {
      hideStatus();
    }

    renderAll();
    renderContext(candidate);
    if (rerenderBar) renderCandidateBar();
  }

  function getOptions() {
    return {
      decodeUnicode: els.options.decodeUnicode.checked,
      expandStringJsonSingle: els.options.expandStringJsonSingle.checked,
      expandStringJsonDeep: els.options.expandStringJsonDeep.checked,
      maxDepth: 8,
      maxStringJsonDepth: 8,
    };
  }

  function refreshSelectedCandidate() {
    if (!state.candidates.length) return;
    chooseCandidate(state.selected);
  }

  function renderContext(candidate) {
    if (!candidate) {
      closeContextPopover();
      els.contextToggle.hidden = true;
      return;
    }

    const text = els.source.value;
    const prefix = text.slice(0, candidate.start).trim();
    const suffix = text.slice(candidate.end).trim();
    const hasPrefix = hasContextContent(prefix);
    const hasSuffix = hasContextContent(suffix);

    if (!text.trim() || (!hasPrefix && !hasSuffix)) {
      closeContextPopover();
      els.contextToggle.hidden = true;
      els.prefix.closest(".context-item").hidden = true;
      els.suffix.closest(".context-item").hidden = true;
      renderContextTokens(els.prefix, "");
      renderContextTokens(els.suffix, "");
      return;
    }

    closeContextPopover();
    els.contextToggle.hidden = false;
    els.contextToggle.textContent = contextToggleText(hasPrefix, hasSuffix);
    els.prefix.closest(".context-item").hidden = !hasPrefix;
    els.suffix.closest(".context-item").hidden = !hasSuffix;
    renderContextTokens(els.prefix, hasPrefix ? prefix : "");
    renderContextTokens(els.suffix, hasSuffix ? suffix : "");
  }

  function contextToggleText(hasPrefix, hasSuffix) {
    return "检测到前后缀，点击查看";
  }

  function hasContextContent(value) {
    return value.split(/\s+/).some((part) => part.trim().length > 0);
  }

  function renderContextTokens(target, value) {
    target.dataset.raw = value;
    target.innerHTML = "";
    if (!value) {
      target.innerHTML = '<span class="context-empty">(空)</span>';
      return;
    }

    const frag = document.createDocumentFragment();
    value
      .split(/\s+/)
      .filter(Boolean)
      .forEach((part) => {
        const item = document.createElement("span");
        item.className = "context-token";
        item.textContent = part;
        frag.append(item);
      });
    target.append(frag);
  }

  function measureValue(value) {
    if (Array.isArray(value)) return `数组 ${value.length} 项`;
    if (value && typeof value === "object") return `对象 ${Object.keys(value).length} 个字段`;
    return typeof value;
  }

  function renderCandidateBar() {
    if (state.candidates.length <= 1) {
      els.candidates.hidden = true;
      return;
    }

    els.candidates.hidden = false;
    els.candidates.innerHTML = "";
    state.candidates.slice(0, 12).forEach((candidate, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1}. ${candidate.label}`;
      button.className = index === state.selected ? "active" : "";
      button.addEventListener("click", () => chooseCandidate(index));
      els.candidates.append(button);
    });
  }

  function renderAll() {
    renderRaw();
    renderTree();
    renderTable();
    renderDiff();
    applySearch();
    switchView(state.activeView);
  }

  function renderRaw() {
    renderJsonText(els.raw, state.parsed);
  }

  function renderJsonText(target, value) {
    target.innerHTML = "";
    if (value === null || value === undefined) {
      target.textContent = state.formatted || "";
      return;
    }
    renderJsonTextNode(target, null, value, 0, true, true, false);
  }

  function renderJsonTextNode(parent, key, value, depth, isLast, isRoot, parentIsArray) {
    const isContainer = isContainerValue(value);
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
      renderJsonTextScalarLine(code, key, value, isLast, isRoot, parentIsArray);
      parent.append(node);
      return;
    }

    const isArray = Array.isArray(value);
    const opener = isArray ? "[" : "{";
    const closer = isArray ? "]" : "}";
    renderJsonTextContainerLine(code, key, opener, closer, isLast, isRoot, parentIsArray, false);
    node.__setTextCollapsed = (collapsed) => {
      node.classList.toggle("collapsed", collapsed);
      toggle.textContent = collapsed ? "▸" : "▾";
      renderJsonTextContainerLine(code, key, opener, closer, isLast, isRoot, parentIsArray, collapsed);
    };

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
    appendJsonTextPunctuation(closingCode, `${closer}${isLast ? "" : ","}`);
    closing.append(closingSpacer, closingCode);
    node.append(closing);

    attachPressActions(toggle, {
      click: () => node.__setTextCollapsed(!node.classList.contains("collapsed")),
      longPress: () => collapseTextToNextLevel(node),
    });
    parent.append(node);
  }

  function collapseTextToNextLevel(node) {
    node.__setTextCollapsed?.(false);
    const directChildren = Array.from(node.children).find((child) =>
      child.classList.contains("json-text-children"),
    );
    if (!directChildren) return;
    const childNodes = Array.from(directChildren.children).filter((child) => child.__setTextCollapsed);
    const shouldExpand = childNodes.length > 0 && childNodes.every((child) => child.classList.contains("collapsed"));
    for (const child of childNodes) {
      setTextSubtreeCollapsed(child, !shouldExpand);
    }
  }

  function setTextSubtreeCollapsed(node, collapsed) {
    node.__setTextCollapsed?.(collapsed);
    const directChildren = Array.from(node.children).find((child) =>
      child.classList.contains("json-text-children"),
    );
    if (!directChildren) return;
    for (const child of directChildren.children) {
      if (child.__setTextCollapsed) setTextSubtreeCollapsed(child, collapsed);
    }
  }

  function renderJsonTextScalarLine(target, key, value, isLast, isRoot, parentIsArray) {
    target.replaceChildren();
    appendJsonTextKeyPrefix(target, key, isRoot, parentIsArray);
    appendJsonTextScalar(target, value);
    if (!isLast) appendJsonTextPunctuation(target, ",");
  }

  function renderJsonTextContainerLine(target, key, opener, closer, isLast, isRoot, parentIsArray, collapsed) {
    target.replaceChildren();
    appendJsonTextKeyPrefix(target, key, isRoot, parentIsArray);
    appendJsonTextPunctuation(target, opener);
    if (collapsed) {
      appendJsonTextPunctuation(target, "...");
      appendJsonTextPunctuation(target, closer);
      if (!isLast) appendJsonTextPunctuation(target, ",");
    }
  }

  function appendJsonTextKeyPrefix(target, key, isRoot, parentIsArray) {
    if (isRoot || parentIsArray) return;
    const keyToken = document.createElement("span");
    keyToken.className = "json-text-key";
    keyToken.textContent = JSON.stringify(String(key));
    const separator = document.createElement("span");
    separator.className = "json-text-punctuation";
    separator.textContent = ": ";
    target.append(keyToken, separator);
  }

  function appendJsonTextScalar(target, value) {
    const token = document.createElement("span");
    if (typeof value === "string") {
      token.className = "json-text-string";
      token.textContent = JSON.stringify(value);
    } else if (typeof value === "number") {
      token.className = "json-text-number";
      token.textContent = JSON.stringify(value);
    } else if (typeof value === "boolean") {
      token.className = "json-text-boolean";
      token.textContent = JSON.stringify(value);
    } else if (value === null) {
      token.className = "json-text-null";
      token.textContent = "null";
    } else {
      token.className = "json-text-value";
      token.textContent = JSON.stringify(value);
    }
    target.append(token);
  }

  function appendJsonTextPunctuation(target, value) {
    const token = document.createElement("span");
    token.className = "json-text-punctuation";
    token.textContent = value;
    target.append(token);
  }

  function renderTree() {
    els.tree.innerHTML = "";
    if (state.parsed === null || state.parsed === undefined) {
      els.tree.innerHTML = '<div class="empty-state">没有可展示的结构</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    renderNode(frag, rootTreeLabel(state.parsed), state.parsed, "$", 0, null, null);
    els.tree.append(frag);
  }

  function rootTreeLabel(value) {
    if (Array.isArray(value)) return "[";
    if (value && typeof value === "object") return "{";
    return "root";
  }

  function renderNode(parent, key, value, path, depth, parentValue, parentRow) {
    const row = document.createElement("div");
    row.className = "node";
    row.classList.add(isContainerValue(value) ? "container-node" : "scalar-node");
    row.style.setProperty("--depth", depth);
    row.dataset.path = path;
    row.dataset.search = `${path} ${key} ${searchText(value)}`.toLowerCase();
    row.__parentRow = parentRow || null;

    const isObject = value && typeof value === "object";
    const childCount = isObject ? Object.keys(value).length : 0;

    const twisty = document.createElement("button");
    twisty.type = "button";
    twisty.className = childCount ? "twisty" : "twisty empty";
    twisty.textContent = childCount ? "▾" : "·";
    row.append(twisty);

    const main = document.createElement("div");
    main.className = "node-main";
    main.innerHTML = renderNodeLabel(key, value, childCount);
    attachNodeEditing(main, key, value, parentValue, path);
    row.append(main);

    const actions = document.createElement("div");
    actions.className = "node-actions";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-action";
    copy.textContent = "路径";
    copy.title = path;
    copy.addEventListener("click", () => copyText(path));
    actions.append(copy);

    const copyValue = document.createElement("button");
    copyValue.type = "button";
    copyValue.className = "copy-action";
    copyValue.textContent = "值";
    copyValue.title = `复制 ${path} 的值`;
    copyValue.addEventListener("click", () => copyText(formatCompactValue(value)));
    actions.append(copyValue);

    const copyNode = document.createElement("button");
    copyNode.type = "button";
    copyNode.className = "copy-action";
    copyNode.textContent = "复制";
    copyNode.title = `复制 ${path} 内的所有数据`;
    copyNode.addEventListener("click", () => copyText(formatCopyValue(value)));
    actions.append(copyNode);
    row.append(actions);

    parent.append(row);

    if (childCount) {
      const directChildRows = [];
      for (const [childKey, childValue] of Object.entries(value)) {
        const before = parent.childNodes.length;
        renderNode(parent, childKey, childValue, nextPath(path, childKey), depth + 1, value, row);
        directChildRows.push(parent.childNodes[before]);
      }
      const closingRow = renderTreeClosingRow(parent, value, depth, row);
      row.__directChildRows = directChildRows;
      row.__closingRow = closingRow;
      row.__setTreeCollapsedState = (collapsed) => {
        twisty.textContent = collapsed ? "▸" : "▾";
        row.dataset.collapsed = String(collapsed);
      };
      row.__setTreeCollapsed = (collapsed) => {
        row.__setTreeCollapsedState(collapsed);
        syncTreeChildrenVisibility(row, !isNodeHiddenByAncestor(row));
      };
      attachPressActions(twisty, {
        click: () => row.__setTreeCollapsed(twisty.textContent === "▾"),
        longPress: () => collapseTreeToNextLevel(row),
      });
    }
  }

  function renderTreeClosingRow(parent, value, depth, parentRow) {
    const row = document.createElement("div");
    row.className = "node tree-closing-node";
    row.style.setProperty("--depth", depth);
    row.dataset.search = "";
    row.__parentRow = parentRow || null;

    const spacer = document.createElement("span");
    spacer.className = "twisty empty";
    const main = document.createElement("div");
    main.className = "node-main";
    const mark = document.createElement("span");
    mark.className = "tree-bracket";
    mark.textContent = Array.isArray(value) ? "]" : "}";
    main.append(mark);
    const actions = document.createElement("div");
    actions.className = "node-actions";

    row.append(spacer, main, actions);
    parent.append(row);
    return row;
  }

  function collapseTreeToNextLevel(row) {
    row.__setTreeCollapsedState?.(false);
    const directChildren = (row.__directChildRows || []).filter((child) => child.__setTreeCollapsed);
    const shouldExpand =
      directChildren.length > 0 && directChildren.every((child) => child.dataset.collapsed === "true");
    for (const child of directChildren) {
      setTreeSubtreeCollapsed(child, !shouldExpand);
    }
    syncTreeChildrenVisibility(row, !isNodeHiddenByAncestor(row));
  }

  function setTreeSubtreeCollapsed(row, collapsed) {
    row.__setTreeCollapsedState?.(collapsed);
    for (const child of row.__directChildRows || []) {
      if (child.__setTreeCollapsed) setTreeSubtreeCollapsed(child, collapsed);
    }
  }

  function syncTreeChildrenVisibility(row, parentVisible) {
    const directChildren = row.__directChildRows || [];
    const collapsed = row.dataset.collapsed === "true";
    if (row.__closingRow) {
      row.__closingRow.classList.toggle("hidden", !(parentVisible && !collapsed));
    }
    for (const child of directChildren) {
      const childVisible = parentVisible && !collapsed;
      child.classList.toggle("hidden", !childVisible);
      syncTreeChildrenVisibility(child, childVisible);
    }
  }

  function isNodeHiddenByAncestor(row) {
    let current = row.__parentRow || null;
    while (current) {
      if (current.dataset.collapsed === "true" || current.classList.contains("hidden")) return true;
      current = current.__parentRow || null;
    }
    return false;
  }

  function attachPressActions(target, handlers) {
    let timer = null;
    let longPressed = false;

    const clear = () => {
      clearTimeout(timer);
      timer = null;
    };

    target.addEventListener("pointerdown", () => {
      longPressed = false;
      clear();
      timer = setTimeout(() => {
        longPressed = true;
        handlers.longPress();
      }, 520);
    });

    target.addEventListener("pointerup", clear);
    target.addEventListener("pointerleave", clear);
    target.addEventListener("pointercancel", clear);
    target.addEventListener("click", (event) => {
      if (longPressed) {
        event.preventDefault();
        event.stopPropagation();
        longPressed = false;
        return;
      }
      handlers.click();
    });
  }

  function attachNodeEditing(main, key, value, parentValue, path) {
    const keyEl = main.querySelector(".key");
    const valueEl = main.querySelector(".value-preview");
    const keyEditable = parentValue && !Array.isArray(parentValue) && key !== "root";
    const valueEditable = !isContainerValue(value);

    if (keyEl && keyEditable) {
      keyEl.classList.add("editable-token");
      keyEl.title = "双击编辑 key";
      keyEl.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        startInlineEdit(keyEl, String(key), (nextKey) => commitKeyEdit(parentValue, key, nextKey));
      });
    }

    if (valueEl && valueEditable) {
      valueEl.classList.add("editable-token");
      valueEl.title = "双击编辑 value";
      valueEl.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        startInlineEdit(
          valueEl,
          editableValueText(value),
          (nextValue) => commitValueEdit(parentValue, key, value, nextValue, path),
          "value",
        );
      });
    }
  }

  function startInlineEdit(target, initialValue, onCommit, kind = "key") {
    if (target.querySelector("input")) return;
    const input = document.createElement("input");
    input.className = `inline-edit-input ${kind === "value" ? "value-edit-input" : "key-edit-input"}`;
    input.value = initialValue;
    target.classList.add("editing");
    target.replaceChildren(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      target.classList.remove("editing");
      if (commit) onCommit(input.value);
      else renderAll();
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  function commitKeyEdit(parentValue, oldKey, newKey) {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed === String(oldKey)) {
      renderAll();
      return;
    }
    if (Object.prototype.hasOwnProperty.call(parentValue, trimmed)) {
      showToast("同级已经存在这个 key");
      renderAll();
      return;
    }
    renameObjectKey(parentValue, oldKey, trimmed);
    syncParsedToSource();
  }

  function commitValueEdit(parentValue, key, oldValue, inputValue, path) {
    const parsed = parseEditedValue(inputValue, oldValue);
    if (!parsed.ok) {
      showToast(`值格式不正确：${parsed.error}`);
      renderAll();
      return;
    }
    if (parentValue === null) {
      state.parsed = parsed.value;
    } else {
      parentValue[key] = parsed.value;
    }
    syncParsedToSource(path);
  }

  function editableValueText(value) {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  function parseEditedValue(inputValue, oldValue) {
    if (typeof oldValue === "string") return { ok: true, value: inputValue };
    try {
      return { ok: true, value: JSON.parse(inputValue) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function renameObjectKey(target, oldKey, newKey) {
    const entries = Object.entries(target);
    for (const key of Object.keys(target)) delete target[key];
    for (const [entryKey, entryValue] of entries) {
      target[entryKey === String(oldKey) ? newKey : entryKey] = entryValue;
    }
  }

  function syncParsedToSource() {
    state.formatted = stringifyPretty(state.parsed);
    els.source.value = state.formatted;
    resetMaskState();
    analyze();
    showToast("已同步到左侧输入");
  }

  function renderNodeLabel(key, value, childCount) {
    const keyPart = `<span class="key">${escapeHtml(key)}</span>`;
    if (value && typeof value === "object") {
      const isArray = Array.isArray(value);
      const type = isArray ? "Array" : "Object";
      const bracket = isArray ? "[" : "{";
      const nested = value.__lzyNestedJson ? '<span class="badge">字符串内 JSON</span>' : "";
      return `
        <span class="node-title">${keyPart}</span>
        <span class="tree-bracket">${bracket}</span>
        <span class="type-pill">${type}</span>
        <span class="meta">${childCount} 项</span>
        ${nested}
      `;
    }
    return `
      <span class="node-title">${keyPart}</span>
      <span class="node-separator">=</span>
      <span class="value-preview">${formatScalar(value)}</span>
    `;
  }

  function isContainerValue(value) {
    return Boolean(value && typeof value === "object");
  }

  function formatScalar(value) {
    if (typeof value === "string") {
      return `<span class="string">"${escapeHtml(value)}"</span>`;
    }
    if (typeof value === "number") return `<span class="number">${value}</span>`;
    if (typeof value === "boolean") return `<span class="boolean">${value}</span>`;
    if (value === null) return '<span class="null">null</span>';
    return `<span>${escapeHtml(String(value))}</span>`;
  }

  function formatCopyValue(value) {
    if (value && typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value ?? "");
  }

  function formatCompactValue(value) {
    if (value && typeof value === "object") return JSON.stringify(value);
    return String(value ?? "");
  }

  function nextPath(path, key) {
    if (/^\d+$/.test(key)) return `${path}[${key}]`;
    if (/^[A-Za-z_$][\w$]*$/.test(key)) return `${path}.${key}`;
    return `${path}[${JSON.stringify(key)}]`;
  }

  function searchText(value) {
    if (value && typeof value === "object") return Array.isArray(value) ? "array" : "object";
    return String(value);
  }

  function renderTable() {
    els.table.innerHTML = "";
    const rows = tableRowsFor(state.parsed);
    if (!rows) {
      els.table.innerHTML = '<div class="empty-state">当前结果没有适合表格展示的对象数组</div>';
      return;
    }

    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set()),
    ).slice(0, 24);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      header.append(th);
    });
    thead.append(header);
    table.append(thead);

    const tbody = document.createElement("tbody");
    rows.slice(0, 300).forEach((row) => {
      const tr = document.createElement("tr");
      columns.forEach((column) => {
        const td = document.createElement("td");
        const value = row[column];
        td.textContent = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    els.table.append(table);
  }

  function renderDiff() {
    els.diffResult.innerHTML = "";
    const rightText = els.diffInput.value.trim();
    if (!rightText) {
      els.diffSummary.textContent = "等待右侧输入";
      els.diffResult.innerHTML = '<div class="empty-state">粘贴另一份 JSON 后开始对比</div>';
      return;
    }

    if (state.parsed === null || state.parsed === undefined) {
      els.diffSummary.textContent = "左侧没有可对比的解析结果";
      els.diffResult.innerHTML = '<div class="empty-state">先在左侧输入并解析 JSON</div>';
      return;
    }

    const parsedRight = parseBestValue(rightText);
    if (!parsedRight.ok) {
      els.diffSummary.textContent = `右侧解析失败：${parsedRight.error}`;
      els.diffResult.innerHTML = '<div class="empty-state">右侧不是可解析的 JSON</div>';
      return;
    }

    const changes = diffValues(state.parsed, parsedRight.value);
    if (!changes.length) {
      els.diffSummary.textContent = "两份 JSON 没有差异";
      els.diffResult.innerHTML = '<div class="empty-state">结构和值一致</div>';
      return;
    }

    const counts = changes.reduce(
      (acc, change) => {
        acc[change.type] += 1;
        return acc;
      },
      { added: 0, removed: 0, changed: 0 },
    );
    els.diffSummary.textContent = `新增 ${counts.added} · 删除 ${counts.removed} · 变更 ${counts.changed}`;

    const frag = document.createDocumentFragment();
    changes.slice(0, 500).forEach((change) => {
      const row = document.createElement("div");
      row.className = `diff-row ${change.type}`;
      row.innerHTML = `
        <div class="diff-kind">${diffLabel(change.type)}</div>
        <div class="diff-path">${escapeHtml(change.path)}</div>
        <div class="diff-value">${escapeHtml(shortJson(change.left))}</div>
        <div class="diff-value">${escapeHtml(shortJson(change.right))}</div>
      `;
      frag.append(row);
    });
    els.diffResult.append(frag);
  }

  function diffValues(left, right, path = "$", changes = []) {
    if (Object.is(left, right)) return changes;

    const leftIsObject = left && typeof left === "object";
    const rightIsObject = right && typeof right === "object";
    if (!leftIsObject || !rightIsObject || Array.isArray(left) !== Array.isArray(right)) {
      changes.push({ type: "changed", path, left, right });
      return changes;
    }

    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      const childPath = nextPath(path, key);
      if (!(key in left)) {
        changes.push({ type: "added", path: childPath, left: undefined, right: right[key] });
      } else if (!(key in right)) {
        changes.push({ type: "removed", path: childPath, left: left[key], right: undefined });
      } else {
        diffValues(left[key], right[key], childPath, changes);
      }
    }
    return changes;
  }

  function diffLabel(type) {
    if (type === "added") return "新增";
    if (type === "removed") return "删除";
    return "变更";
  }

  function shortJson(value) {
    if (value === undefined) return "";
    const text = value && typeof value === "object" ? JSON.stringify(value) : String(value);
    return text.length > 240 ? `${text.slice(0, 240)}...` : text;
  }

  function tableRowsFor(value) {
    if (Array.isArray(value) && value.every(isPlainObject)) return value;
    if (value && typeof value === "object") {
      const arrays = Object.values(value).filter(
        (child) => Array.isArray(child) && child.length && child.every(isPlainObject),
      );
      return arrays[0] || null;
    }
    return null;
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function applySearch() {
    const query = els.search.value.trim().toLowerCase();
    const nodes = els.tree.querySelectorAll(".node");
    nodes.forEach((node) => node.classList.remove("match"));
    if (!query) return;

    let count = 0;
    nodes.forEach((node) => {
      if (node.dataset.search.includes(query)) {
        node.classList.add("match");
        node.classList.remove("hidden");
        count += 1;
      }
    });
    if (count) els.resultMeta.textContent = `${count} 个匹配 · ${measureValue(state.parsed)}`;
  }

  function switchView(view) {
    state.activeView = view;
    localStorage.setItem("lzyjson-active-view", view);
    els.tree.hidden = view !== "tree";
    els.raw.hidden = view !== "raw";
    els.table.hidden = view !== "table";
    els.diff.hidden = view !== "diff";
    Object.entries(els.tabs).forEach(([name, tab]) => {
      tab.classList.toggle("active", name === view);
    });
  }

  function maskSensitive(text) {
    return text
      .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1***")
      .replace(/("?(?:token|accessToken|refreshToken|authorization|password|secret|cookie)"?\s*[:=]\s*")([^"]+)(")/gi, "$1***$3")
      .replace(/\b1[3-9]\d{9}\b/g, "1**********")
      .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "***@***")
      .replace(/\b\d{17}[\dXx]\b/g, "******************");
  }

  function copyText(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("已复制"))
      .catch(() => showToast("复制失败"));
  }

  function openContextPopover() {
    const rect = els.contextToggle.getBoundingClientRect();
    const width = Math.min(720, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 120);
    els.context.style.left = `${left}px`;
    els.context.style.top = `${top}px`;
    els.context.style.width = `${width}px`;
    els.context.hidden = false;
    state.contextOpen = true;
  }

  function closeContextPopover() {
    els.context.hidden = true;
    state.contextOpen = false;
  }

  function resetMaskState() {
    state.maskedBefore = null;
    document.querySelector("#maskToggleBtn").textContent = "脱敏";
    document.querySelector("#maskToggleBtn").title = "脱敏当前输入";
  }

  function setupSplitResize() {
    let dragging = false;
    const savedWidth = Number(localStorage.getItem("lzyjson-input-width"));
    if (savedWidth >= 28 && savedWidth <= 70) {
      els.workspace.style.setProperty("--input-width", `${savedWidth}%`);
    }

    els.splitHandle.addEventListener("pointerdown", (event) => {
      dragging = true;
      els.splitHandle.classList.add("dragging");
      els.splitHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    els.splitHandle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const rect = els.workspace.getBoundingClientRect();
      const percent = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(70, Math.max(28, percent));
      els.workspace.style.setProperty("--input-width", `${clamped}%`);
      localStorage.setItem("lzyjson-input-width", String(Math.round(clamped * 10) / 10));
    });

    function stopDrag() {
      dragging = false;
      els.splitHandle.classList.remove("dragging");
    }

    els.splitHandle.addEventListener("pointerup", stopDrag);
    els.splitHandle.addEventListener("pointercancel", stopDrag);
  }

  function applyCodeFontSize() {
    const size = Math.min(18, Math.max(11, state.codeFontSize));
    state.codeFontSize = size;
    document.documentElement.style.setProperty("--code-font-size", `${size}px`);
    els.fontSizeLabel.textContent = `${size}px`;
    localStorage.setItem("lzyjson-code-font-size", String(size));
  }

  function changeCodeFontSize(delta) {
    state.codeFontSize += delta;
    applyCodeFontSize();
  }

  function readStorageValue(key, fallback) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  }

  function readStorageBool(key, fallback = false) {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "true";
  }

  function applyStoredParseSettings() {
    const view = readStorageValue("lzyjson-active-view", "tree");
    state.activeView = ["tree", "raw", "table"].includes(view) ? view : "tree";
    els.options.decodeUnicode.checked = readStorageBool("lzyjson-decode-unicode");
    els.options.expandStringJsonSingle.checked = readStorageBool("lzyjson-expand-string-json-single");
    els.options.expandStringJsonDeep.checked = readStorageBool("lzyjson-expand-string-json-deep");
    if (els.options.expandStringJsonDeep.checked) {
      els.options.expandStringJsonSingle.checked = false;
    }
  }

  function saveParseSettings() {
    localStorage.setItem("lzyjson-decode-unicode", String(els.options.decodeUnicode.checked));
    localStorage.setItem(
      "lzyjson-expand-string-json-single",
      String(els.options.expandStringJsonSingle.checked),
    );
    localStorage.setItem(
      "lzyjson-expand-string-json-deep",
      String(els.options.expandStringJsonDeep.checked),
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  els.caseMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = els.caseMenu.hidden;
    els.caseMenu.hidden = !nextOpen;
    els.caseMenuBtn.setAttribute("aria-expanded", String(nextOpen));
  });

  els.caseMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sample]");
    if (!button) return;
    const samples = {
      normal: { text: sample },
      multi: { text: multiSample },
      escapedSingle: {
        text: escapedSingleSample,
        options: { expandStringJsonSingle: true, expandStringJsonDeep: false },
      },
      escapedMulti: {
        text: escapedMultiSample,
        options: { expandStringJsonSingle: false, expandStringJsonDeep: true },
      },
      long: { text: longSample },
    };
    const selected = samples[button.dataset.sample] || samples.normal;
    els.source.value = selected.text;
    if (selected.options) {
      els.options.expandStringJsonSingle.checked = selected.options.expandStringJsonSingle;
      els.options.expandStringJsonDeep.checked = selected.options.expandStringJsonDeep;
      saveParseSettings();
    }
    els.caseMenu.hidden = true;
    els.caseMenuBtn.setAttribute("aria-expanded", "false");
    resetMaskState();
    analyze();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".case-menu")) {
      els.caseMenu.hidden = true;
      els.caseMenuBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelector("#clearBtn").addEventListener("click", () => {
    els.source.value = "";
    els.search.value = "";
    resetMaskState();
    analyze();
  });

  document.querySelector("#maskToggleBtn").addEventListener("click", () => {
    const button = document.querySelector("#maskToggleBtn");
    if (state.maskedBefore === null) {
      state.maskedBefore = els.source.value;
      els.source.value = maskSensitive(els.source.value);
      button.textContent = "回滚";
      button.title = "回滚到脱敏前";
      analyze();
      showToast("已脱敏");
      return;
    }

    els.source.value = state.maskedBefore;
    resetMaskState();
    analyze();
    showToast("已回滚到脱敏前");
  });

  document.querySelector("#formatInputBtn").addEventListener("click", () => {
    if (state.formatted) {
      els.source.value = state.formatted;
      analyze();
    }
  });

  document.querySelector("#copyBtn").addEventListener("click", () => {
    const selected = state.candidates[state.selected];
    if (!els.options.decodeUnicode.checked && selected) {
      copyText(selected.repairedText || selected.raw || "");
      return;
    }
    copyText(state.formatted || "");
  });

  document.querySelector("#minifyBtn").addEventListener("click", () => {
    if (state.parsed !== null) copyText(JSON.stringify(state.parsed));
  });

  els.fontDown.addEventListener("click", () => changeCodeFontSize(-1));
  els.fontUp.addEventListener("click", () => changeCodeFontSize(1));

  els.copyPrefix.addEventListener("click", () => copyText(els.prefix.dataset.raw || ""));
  els.copySuffix.addEventListener("click", () => copyText(els.suffix.dataset.raw || ""));
  els.contextToggle.addEventListener("click", () => {
    if (!state.contextOpen) {
      openContextPopover();
    } else {
      closeContextPopover();
    }
  });
  els.contextClose.addEventListener("click", closeContextPopover);
  window.addEventListener("resize", closeContextPopover);

  els.tabs.tree.addEventListener("click", () => switchView("tree"));
  els.tabs.raw.addEventListener("click", () => switchView("raw"));
  els.tabs.table.addEventListener("click", () => switchView("table"));

  els.source.addEventListener("input", debounce(analyze, 120));
  els.diffInput.addEventListener("input", debounce(renderDiff, 120));
  els.search.addEventListener("input", applySearch);
  els.options.decodeUnicode.addEventListener("change", () => {
    saveParseSettings();
    refreshSelectedCandidate();
  });
  els.options.expandStringJsonSingle.addEventListener("change", () => {
    if (els.options.expandStringJsonSingle.checked) els.options.expandStringJsonDeep.checked = false;
    saveParseSettings();
    refreshSelectedCandidate();
  });
  els.options.expandStringJsonDeep.addEventListener("change", () => {
    if (els.options.expandStringJsonDeep.checked) els.options.expandStringJsonSingle.checked = false;
    saveParseSettings();
    refreshSelectedCandidate();
  });
  applyStoredParseSettings();
  setupSplitResize();
  applyCodeFontSize();

  analyze();
})();
