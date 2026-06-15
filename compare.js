(function () {
  const els = {
    left: document.querySelector("#leftInput"),
    right: document.querySelector("#rightInput"),
    summary: document.querySelector("#compareSummary"),
    result: document.querySelector("#compareResult"),
  };

  const sampleLeft = `2026-06-12 INFO env=prod traceId=cmp-a body=${JSON.stringify({
    code: 0,
    message: "success",
    data: {
      user: {
        id: 1001,
        name: "张三",
        level: "gold",
        profile: {
          city: "上海",
          phone: "13800138000",
          email: "zhangsan@example.com",
        },
        roles: ["reader", "editor"],
        permissions: {
          dashboard: { read: true, write: false },
          billing: { read: false, write: false },
        },
      },
      orders: [
        { id: "A001", amount: 128.5, status: "paid", items: [{ sku: "sku-1", count: 2 }] },
        { id: "A002", amount: 64, status: "pending", items: [{ sku: "sku-2", count: 1 }] },
      ],
      flags: {
        beta: false,
        risk: "low",
      },
      embedded: JSON.stringify({ source: "left", retry: 1, note: "\\u5de6\\u4fa7" }),
    },
    meta: {
      version: "1.2.0",
      region: "cn-east",
      costMs: 42,
    },
  })} cost=42ms`;

  const sampleRight = `2026-06-12 INFO env=prod traceId=cmp-b body=${JSON.stringify({
    code: 0,
    message: "success",
    data: {
      user: {
        id: 1001,
        name: "张三丰",
        level: "platinum",
        profile: {
          city: "杭州",
          email: "zhangsan@example.com",
          address: "西湖区 1 号",
        },
        roles: ["reader", "admin"],
        permissions: {
          dashboard: { read: true, write: true },
          billing: { read: true, write: false },
          audit: { read: true, write: false },
        },
      },
      orders: [
        { id: "A001", amount: 128.5, status: "refunded", items: [{ sku: "sku-1", count: 1 }] },
        { id: "A003", amount: 256, status: "paid", items: [{ sku: "sku-3", count: 4 }] },
      ],
      flags: {
        beta: true,
        risk: "medium",
        featureGate: "new-checkout",
      },
      embedded: JSON.stringify({ source: "right", retry: 3, note: "\\u53f3\\u4fa7" }),
    },
    meta: {
      version: "1.3.0",
      region: "cn-east",
      costMs: 57,
      server: "api-02",
    },
    warnings: ["profile-phone-removed", "order-list-changed"],
  })} cost=57ms`;

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

  function tryParse(value) {
    try {
      return { ok: true, value: JSON.parse(value) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function findCandidateStarts(text) {
    const starts = [];
    let inString = false;
    let escaping = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
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
      if (classifyChar(ch)) starts.push(i);
    }
    return starts;
  }

  function scanFrom(text, start) {
    const stack = [classifyChar(text[start])];
    let inString = false;
    let escaping = false;
    for (let i = start + 1; i < text.length; i += 1) {
      const ch = text[i];
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
        if (stack.length === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  function parseBest(text) {
    const direct = tryParse(text);
    if (direct.ok) return { ok: true, value: direct.value };

    for (const start of findCandidateStarts(text)) {
      const raw = scanFrom(text, start);
      if (!raw) continue;
      const parsed = tryParse(raw);
      if (parsed.ok) return { ok: true, value: parsed.value };
    }
    return { ok: false, error: direct.error?.message || "没有找到 JSON" };
  }

  function nextPath(path, key) {
    if (/^\d+$/.test(key)) return `${path}[${key}]`;
    if (/^[A-Za-z_$][\w$]*$/.test(key)) return `${path}.${key}`;
    return `${path}[${JSON.stringify(key)}]`;
  }

  function diffValues(left, right, path = "$", changes = []) {
    if (Object.is(left, right)) return changes;
    const leftObj = left && typeof left === "object";
    const rightObj = right && typeof right === "object";
    if (!leftObj || !rightObj || Array.isArray(left) !== Array.isArray(right)) {
      changes.push({ type: "changed", path, left, right });
      return changes;
    }
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      const childPath = nextPath(path, key);
      if (!(key in left)) changes.push({ type: "added", path: childPath, left: undefined, right: right[key] });
      else if (!(key in right)) changes.push({ type: "removed", path: childPath, left: left[key], right: undefined });
      else diffValues(left[key], right[key], childPath, changes);
    }
    return changes;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function label(type) {
    if (type === "added") return "新增";
    if (type === "removed") return "删除";
    return "变更";
  }

  function valueLabel(value) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value && typeof value === "object") return `Object(${Object.keys(value).length})`;
    if (typeof value === "string") return JSON.stringify(value);
    if (value === undefined) return "";
    return String(value);
  }

  function isObjectLike(value) {
    return Boolean(value && typeof value === "object");
  }

  function rowType(left, right) {
    if (left === undefined) return "added";
    if (right === undefined) return "removed";
    if (Object.is(left, right)) return "same";
    if (isObjectLike(left) && isObjectLike(right) && Array.isArray(left) === Array.isArray(right)) {
      return "same";
    }
    return "changed";
  }

  function renderBodyRows(left, right, path = "$", key = "root", depth = 0, rows = []) {
    const type = rowType(left, right);
    rows.push({
      depth,
      key,
      path,
      type,
      left: left === undefined ? "" : valueLabel(left),
      right: right === undefined ? "" : valueLabel(right),
    });

    if (
      left !== undefined &&
      right !== undefined &&
      isObjectLike(left) &&
      isObjectLike(right) &&
      Array.isArray(left) === Array.isArray(right)
    ) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const childKey of keys) {
        renderBodyRows(
          left[childKey],
          right[childKey],
          nextPath(path, childKey),
          childKey,
          depth + 1,
          rows,
        );
      }
    }

    return rows;
  }

  function renderJsonBodyDiff(left, right) {
    const rows = renderBodyRows(left, right);
    return `
      <div class="json-body-diff">
        <div class="json-body-head">左侧 JSON</div>
        <div class="json-body-head">右侧 JSON</div>
        ${rows
          .map((row) => {
            const indent = row.depth * 18;
            const leftPrefix = row.type === "removed" || row.type === "changed" ? "-" : " ";
            const rightPrefix = row.type === "added" || row.type === "changed" ? "+" : " ";
            return `
              <div class="json-body-cell left ${row.type}" title="${escapeHtml(row.path)}">
                <span class="json-prefix">${leftPrefix}</span>
                <code style="padding-left:${indent}px"><span class="json-key">${escapeHtml(row.key)}</span>${row.left ? `: ${escapeHtml(row.left)}` : ""}</code>
              </div>
              <div class="json-body-cell right ${row.type}" title="${escapeHtml(row.path)}">
                <span class="json-prefix">${rightPrefix}</span>
                <code style="padding-left:${indent}px"><span class="json-key">${escapeHtml(row.key)}</span>${row.right ? `: ${escapeHtml(row.right)}` : ""}</code>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function render() {
    els.result.innerHTML = "";
    if (!els.left.value.trim() || !els.right.value.trim()) {
      els.summary.textContent = "等待输入";
      return;
    }
    const left = parseBest(els.left.value.trim());
    const right = parseBest(els.right.value.trim());
    if (!left.ok || !right.ok) {
      els.summary.textContent = `解析失败：左侧 ${left.ok ? "OK" : left.error} · 右侧 ${right.ok ? "OK" : right.error}`;
      return;
    }
    const changes = diffValues(left.value, right.value);
    if (!changes.length) {
      els.summary.textContent = "两份 JSON 没有差异";
      return;
    }
    const counts = changes.reduce((acc, item) => {
      acc[item.type] += 1;
      return acc;
    }, { added: 0, removed: 0, changed: 0 });
    els.summary.textContent = `新增 ${counts.added} · 删除 ${counts.removed} · 变更 ${counts.changed}`;
    els.result.innerHTML = renderJsonBodyDiff(left.value, right.value);
  }

  document.querySelector("#compareSampleBtn").addEventListener("click", () => {
    els.left.value = sampleLeft;
    els.right.value = sampleRight;
    render();
  });

  document.querySelector("#compareClearBtn").addEventListener("click", () => {
    els.left.value = "";
    els.right.value = "";
    render();
  });

  els.left.addEventListener("input", debounce(render, 120));
  els.right.addEventListener("input", debounce(render, 120));
  render();
})();
