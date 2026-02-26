(function workdayOnCallHelper() {
  if (window.__workdayOnCallHelperLoaded) return;
  window.__workdayOnCallHelperLoaded = true;
  // ========== 1. BOOT GUARD + IIFE ==========

  // ========== 2. CONFIG / CONSTANTS ==========
  const TIME_TYPE_REGEX = /on call standby hours/i;
  const PANEL_ID = "wd-oncall-helper-panel";
  const NEVER_CLICK_REGEX = /\b(submit|save|approve|done|confirm|ok)\b/i;

  const DELAY_SHORT = 200;
  const DELAY_CLICK = 350;
  const DELAY_SELECT = 350;
  const DELAY_NAV = 500;
  const DELAY_AFTER_BTN = 180;
  const DELAY_REMOVE = 300;
  const POLL_INTERVAL = 120;
  const TIMEOUT_SHORT = 2000;
  const TIMEOUT_MEDIUM = 2500;
  const TIMEOUT_LONG = 3600;
  const TIMEOUT_ADD = 2000;
  const DEBOUNCE_SYNC = 250;

  // ========== 3. CORE UTILITIES ==========
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function walkDeep(root, visit) {
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      if (current instanceof Element) {
        visit(current);
        if (current.shadowRoot) stack.push(current.shadowRoot);
      }

      const children = current.children || [];
      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push(children[i]);
      }
    }
  }

  function deepElements(root = document) {
    const items = [];
    walkDeep(root, (el) => items.push(el));
    return items;
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizedText(el) {
    return ((el.innerText || el.textContent || "").replace(/\s+/g, " ")).trim();
  }

  function isClickable(el) {
    if (!(el instanceof Element)) return false;
    if (el.matches("button,a,[role='button'],[role='menuitem'],[role='option'],[tabindex]")) return true;
    if (typeof el.onclick === "function") return true;
    const style = getComputedStyle(el);
    return style.cursor === "pointer";
  }

  function actionableTarget(el) {
    if (!(el instanceof Element)) return null;
    const direct = el.closest(
      "button,a,[role='button'],[role='menuitem'],[role='menuitemradio'],[role='option'],[aria-haspopup],[tabindex]"
    );
    if (direct && isVisible(direct)) return direct;
    if (isClickable(el) && isVisible(el)) return el;
    return null;
  }

  async function waitFor(getter, timeoutMs = 5000, intervalMs = 150) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const value = getter();
      if (value) return value;
      await sleep(intervalMs);
    }
    return null;
  }

  // ========== 4. DOM HELPERS ==========
  function findByText(regex, { root = document, clickableOnly = false } = {}) {
    const candidates = [];
    const seen = new Set();
    walkDeep(root, (el) => {
      if (!isVisible(el)) return;
      const text = normalizedText(el);
      if (!text) return;
      if (!regex.test(text)) return;

      if (clickableOnly) {
        const target = actionableTarget(el);
        if (!target || seen.has(target)) return;
        seen.add(target);
        candidates.push(target);
      } else {
        if (seen.has(el)) return;
        seen.add(el);
        candidates.push(el);
      }
    });
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return candidates[0] || null;
  }

  function clickElement(el) {
    const target = actionableTarget(el) || el;
    if (!target) return false;
    const label = normalizedText(target);
    if (label && NEVER_CLICK_REGEX.test(label)) {
      return false;
    }
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (typeof target.click === "function") {
      target.click();
    }
    return true;
  }

  const STYLE = `
    @keyframes wd-slide-in {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes wd-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: 320px;
      background: #111827;
      color: #e5e7eb;
      border-radius: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      animation: wd-slide-in 0.25s ease-out;
      transition: width 0.2s ease, min-height 0.2s ease;
    }
    #${PANEL_ID}.wd-collapsed {
      width: 44px;
      min-height: 44px;
      border-radius: 22px;
    }
    #${PANEL_ID}.wd-collapsed .wd-body { display: none; }
    #${PANEL_ID}.wd-collapsed .wd-header span { display: none; }
    #${PANEL_ID}.wd-collapsed .wd-header {
      padding: 10px;
      justify-content: center;
      cursor: pointer;
      border-bottom: none;
    }
    #${PANEL_ID} .wd-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(135deg, #1e3a5f 0%, #162544 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    #${PANEL_ID} .wd-header span {
      font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
      color: #c5ddf0;
    }
    #${PANEL_ID} .wd-toggle {
      color: #7b9ab5; background: none; border: 0; font-size: 18px;
      cursor: pointer; padding: 2px 4px; line-height: 1; transition: color 0.15s;
      border-radius: 4px; flex-shrink: 0;
    }
    #${PANEL_ID} .wd-toggle:hover { color: #fff; background: rgba(255,255,255,0.1); }
    #${PANEL_ID}.wd-collapsed .wd-toggle { font-size: 20px; }
    #${PANEL_ID} .wd-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    #${PANEL_ID} .wd-action {
      display: flex; align-items: center; gap: 12px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 12px 14px; cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    #${PANEL_ID} .wd-action:hover {
      background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.18);
      transform: translateX(2px);
    }
    #${PANEL_ID} .wd-action:active { transform: scale(0.98); }
    #${PANEL_ID} .wd-action-icon {
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 15px; flex-shrink: 0;
    }
    #${PANEL_ID} .wd-action-icon.wd-weekday { background: #065f46; color: #6ee7b7; }
    #${PANEL_ID} .wd-action-icon.wd-weekend { background: #1e3a5f; color: #7dd3fc; }
    #${PANEL_ID} .wd-action-info { flex: 1; min-width: 0; }
    #${PANEL_ID} .wd-action-title {
      font-weight: 600; font-size: 14px; color: #f9fafb; line-height: 1.3;
    }
    #${PANEL_ID} .wd-action-desc {
      font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.4;
    }
    #${PANEL_ID} .wd-action-arrow { color: #6b7280; font-size: 18px; flex-shrink: 0; }
    #${PANEL_ID} .wd-util-row {
      display: flex; align-items: center; justify-content: center; gap: 0; padding: 2px 0;
    }
    #${PANEL_ID} .wd-util-row button {
      background: none; border: none; color: #6b7280; font: inherit;
      font-size: 12px; cursor: pointer; padding: 5px 10px; border-radius: 6px;
      transition: color 0.15s, background 0.15s;
    }
    #${PANEL_ID} .wd-util-row button:hover { color: #d1d5db; background: rgba(255,255,255,0.06); }
    #${PANEL_ID} .wd-util-sep {
      width: 1px; height: 12px; background: rgba(255,255,255,0.12); flex-shrink: 0;
    }
    #${PANEL_ID} .wd-status {
      margin: 2px 2px 4px; padding: 10px 12px; border-radius: 8px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
      white-space: pre-wrap; min-height: 22px;
      font-size: 13px; color: #d1d5db; line-height: 1.5;
    }
    #${PANEL_ID} .wd-status.wd-busy { color: #fbbf24; }
    #${PANEL_ID} .wd-status.wd-busy::before {
      content: "⏳ "; animation: wd-pulse 1.2s ease-in-out infinite;
    }
    #${PANEL_ID} .wd-status.wd-ok { color: #6ee7b7; }
    #${PANEL_ID} .wd-status.wd-err { color: #fca5a5; }
  `;

  function findDialog() {
    const dialogs = deepElements().filter((el) => el.getAttribute("role") === "dialog" && isVisible(el));
    return dialogs[0] || null;
  }

  // ========== 5. WORKDAY CONTEXT & SCOPES ==========
  function quickAddScope() {
    return findDialog() || document;
  }

  function hasQuickAddHeading(scope) {
    const byAutomation = deepElements(scope).find(
      (el) =>
        el.getAttribute("data-automation-id") === "pageHeaderTitleText" &&
        /^Quick Add$/i.test(normalizedText(el))
    );
    if (byAutomation) return true;
    return !!findByText(/^Quick Add$/i, { root: scope });
  }

  function hasTimeTypeField(scope) {
    return !!findByText(/^Time Type\b/i, { root: scope });
  }

  function hasInOutStep(scope) {
    const hasIn = !!findByText(/^In$/i, { root: scope });
    const hasOut = !!findByText(/^Out$/i, { root: scope });
    return hasIn && hasOut;
  }

  function isQuickAddContext() {
    const scope = quickAddScope();
    if (!hasQuickAddHeading(scope)) return false;
    return hasTimeTypeField(scope) || hasInOutStep(scope);
  }

  function isEnterTimePage() {
    return deepElements(document).some(
      (el) =>
        el.getAttribute("data-automation-id") === "pageHeaderTitleText" &&
        /^Enter (My )?Time$/i.test(normalizedText(el))
    );
  }

  function isTimeLandingPage() {
    if (isEnterTimePage() || isQuickAddContext()) return false;
    return !!findByText(/^Enter (My )?Time$/i, { root: document }) &&
           !!findByText(/This Week/i, { root: document, clickableOnly: true });
  }

  function findThisWeekElement() {
    return findByText(/This Week/i, { root: document, clickableOnly: true });
  }

  function findEnterTimeUrl() {
    const el = findThisWeekElement();
    if (!el) return null;
    const link = el.tagName === "A" ? el : el.closest("a");
    if (link && link.href) return link.href;
    const child = el.querySelector && el.querySelector("a[href]");
    if (child) return child.href;
    return null;
  }

  function shouldShowPanel() {
    return isQuickAddContext() || isEnterTimePage() || isTimeLandingPage();
  }

  function isStandbySelected(root) {
    return deepElements(root).some((el) => {
      if (!(el instanceof Element)) return false;
      const aid = el.getAttribute("data-automation-id");
      if (aid === "selectedItem") {
        return TIME_TYPE_REGEX.test(normalizedText(el));
      }
      if (aid === "promptOption" && el.closest("[data-automation-id='selectedItem']")) {
        return TIME_TYPE_REGEX.test(normalizedText(el));
      }
      return false;
    });
  }

  function findTimeTypeContainer(root) {
    const timeTypeLabel = findByText(/^Time Type\b/i, { root });
    if (!timeTypeLabel) return null;
    const row = timeTypeLabel.closest("div,li,tr,section,form") || root;
    return (
      deepElements(row).find(
        (el) => isVisible(el) && el.getAttribute("data-automation-id") === "multiSelectContainer"
      ) ||
      deepElements(root).find(
        (el) => isVisible(el) && el.getAttribute("data-automation-id") === "multiSelectContainer"
      ) ||
      null
    );
  }

  function findSelectInput(root) {
    return (
      deepElements(root).find(
        (el) =>
          el instanceof HTMLInputElement &&
          isVisible(el) &&
          (el.getAttribute("data-uxi-widget-type") === "selectinput" ||
            (el.getAttribute("placeholder") || "").toLowerCase() === "search")
      ) || null
    );
  }

  function findStandbyOption(root) {
    return (
      deepElements(root).find((el) => {
        if (!isVisible(el)) return false;
        const text = normalizedText(el);
        if (!TIME_TYPE_REGEX.test(text)) return false;
        if (el.closest("[data-automation-id='selectedItem']")) return false;
        const aid = el.getAttribute("data-automation-id");
        if (aid === "promptOption" || aid === "menuItem" || aid === "selectedItem") {
          return true;
        }
        return !!actionableTarget(el);
      }) || null
    );
  }

  // ========== 7. QUICK ADD FLOW ==========
  async function ensureTimeTypeInQuickAdd(scope, statusEl) {
    const root = scope || (await waitFor(() => quickAddScope(), TIMEOUT_MEDIUM, POLL_INTERVAL));
    if (!root) return false;

    if (isStandbySelected(root)) return true;

    const container = findTimeTypeContainer(root);
    const clearBtn = deepElements(container || root).find(
      (el) => isVisible(el) && el.getAttribute("data-automation-id") === "DELETE_charm"
    );
    if (clearBtn) {
      clickElement(clearBtn);
      await sleep(DELAY_CLICK);
    }

    const opener =
      deepElements(container || root).find(
        (el) => isVisible(el) && el.getAttribute("data-automation-id") === "promptIcon"
      ) ||
      deepElements(container || root).find(
        (el) => isVisible(el) && el.getAttribute("data-automation-id") === "multiselectInputContainer"
      ) ||
      container;
    if (opener) {
      clickElement(opener);
      await sleep(DELAY_CLICK);
    }

    const input = await waitFor(() => findSelectInput(container || root), TIMEOUT_SHORT, POLL_INTERVAL);
    if (input) {
      setFieldValue(input, "On Call Standby Hours");
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    }

    await sleep(DELAY_SELECT);
    const option = await waitFor(() => findStandbyOption(root), TIMEOUT_LONG, POLL_INTERVAL);
    if (option) {
      clickElement(option);
      await sleep(DELAY_CLICK);
    }

    if (isStandbySelected(root)) return true;
    if (statusEl) {
      statusEl.textContent = "Please choose On Call Standby Hours manually.";
    }
    return false;
  }

  async function ensureInOutStep(scope) {
    let root = scope || quickAddScope();
    const fields = findInOutFields(root);
    if (fields.inField && fields.outField) return root;

    const nextBtn = findByText(/^Next$/i, { root, clickableOnly: true });
    if (nextBtn) {
      clickElement(nextBtn);
      await sleep(DELAY_AFTER_BTN);
      await sleep(DELAY_NAV);
      root = quickAddScope();
      await waitFor(() => {
        const current = findInOutFields(root);
        return current.inField && current.outField;
      }, TIMEOUT_MEDIUM, POLL_INTERVAL);
    }

    return root;
  }

  // ========== 6. TIME/FIELD DETECTION ==========
  function textInputs(root) {
    return deepElements(root).filter((el) => {
      if (!isVisible(el)) return false;
      if (!(el instanceof HTMLInputElement)) return false;
      if (el.type === "hidden" || el.type === "checkbox" || el.readOnly) return false;
      return true;
    });
  }

  function inputMeta(el) {
    return [
      el.getAttribute("aria-label"),
      el.getAttribute("name"),
      el.getAttribute("placeholder"),
      el.id,
      el.className
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function sortByScreenPosition(elements) {
    return [...elements].sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      if (Math.abs(ar.top - br.top) > 4) return ar.top - br.top;
      return ar.left - br.left;
    });
  }

  function findInputByExactLabel(root, labelText) {
    const wanted = labelText.trim().toLowerCase();
    const labels = deepElements(root).filter((el) => isVisible(el) && normalizedText(el).toLowerCase() === wanted);
    for (const labelEl of labels) {
      const row = labelEl.closest("div,tr,li,section") || labelEl.parentElement;
      if (!row) continue;
      const field = textInputs(row)[0];
      if (field) return field;
    }
    return null;
  }

  function findInputsByExactLabel(root, labelText) {
    const wanted = labelText.trim().toLowerCase();
    const labels = deepElements(root)
      .filter((el) => isVisible(el) && normalizedText(el).toLowerCase() === wanted)
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        if (Math.abs(ar.top - br.top) > 4) return ar.top - br.top;
        return ar.left - br.left;
      });
    if (!labels.length) return [];

    const candidateInputs = textInputs(root).filter((el) => !/reason|search/.test(inputMeta(el)));
    const used = new Set();
    const result = [];
    for (const labelEl of labels) {
      const lr = labelEl.getBoundingClientRect();
      const ly = lr.top + lr.height / 2;
      let best = null;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const input of candidateInputs) {
        if (used.has(input)) continue;
        const ir = input.getBoundingClientRect();
        const iy = ir.top + ir.height / 2;
        const isToRight = ir.left >= lr.left;
        const score = Math.abs(iy - ly) + (isToRight ? 0 : 400) + Math.abs(ir.left - lr.right) * 0.15;
        if (score < bestScore) {
          best = input;
          bestScore = score;
        }
      }
      if (best) {
        used.add(best);
        result.push(best);
      }
    }
    return result;
  }

  function findTimeWidgetInputs(root, labelText) {
    const wanted = labelText.toLowerCase();
    const results = [];
    const labels = deepElements(root)
      .filter(
        (el) =>
          el.getAttribute("data-automation-id") === "formLabel" &&
          normalizedText(el).toLowerCase() === wanted
      )
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        if (Math.abs(ar.top - br.top) > 4) return ar.top - br.top;
        return ar.left - br.left;
      });
    for (const label of labels) {
      const metadataId = (label.id || "").replace(/-formLabel$/, "");
      if (metadataId) {
        const widget = deepElements(root).find(
          (el) => el.getAttribute("data-automation-id") === "standaloneTimeWidget" && el.id === metadataId
        );
        if (widget) {
          const input = widget.querySelector("input[type='text']");
          if (input) results.push(input);
        }
      }
    }
    return results;
  }

  function findInOutFieldPairs(root) {
    let inFields = findTimeWidgetInputs(root, "In");
    let outFields = findTimeWidgetInputs(root, "Out");

    if (!inFields.length) inFields = findInputsByExactLabel(root, "In");
    if (!outFields.length) outFields = findInputsByExactLabel(root, "Out");

    const len = Math.max(inFields.length, outFields.length);
    const pairs = [];
    for (let i = 0; i < len; i += 1) {
      const inField = inFields[i] || null;
      const outField = outFields[i] || null;
      if (inField && outField) pairs.push({ inField, outField });
    }
    return pairs;
  }

  function findInputByNearestLabel(root, labelRegex) {
    const labels = deepElements(root).filter((el) => {
      if (!isVisible(el)) return false;
      const text = normalizedText(el);
      return !!text && labelRegex.test(text);
    });
    if (!labels.length) return null;

    const inputs = textInputs(root).filter((el) => !/reason|search/.test(inputMeta(el)));
    if (!inputs.length) return null;

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const label of labels) {
      const lr = label.getBoundingClientRect();
      const ly = lr.top + lr.height / 2;
      for (const input of inputs) {
        const ir = input.getBoundingClientRect();
        const iy = ir.top + ir.height / 2;
        const isToRight = ir.left >= lr.left;
        const score = Math.abs(iy - ly) + (isToRight ? 0 : 400) + Math.abs(ir.left - lr.right) * 0.15;
        if (score < bestScore) {
          best = input;
          bestScore = score;
        }
      }
    }
    return best;
  }

  function findInOutFields(root) {
    const scope = root || document;

    const inByWidget = findTimeWidgetInputs(scope, "In")[0] || null;
    const outByWidget = findTimeWidgetInputs(scope, "Out")[0] || null;
    if (inByWidget && outByWidget) return { inField: inByWidget, outField: outByWidget };

    const pairs = findInOutFieldPairs(scope);
    if (pairs.length) return pairs[0];

    let inField = inByWidget || findInputByExactLabel(scope, "In") || findInputByNearestLabel(scope, /^in$/i);
    let outField = outByWidget || findInputByExactLabel(scope, "Out") || findInputByNearestLabel(scope, /^out$/i);

    const candidates = sortByScreenPosition(
      textInputs(scope).filter((el) => !/reason|search/.test(inputMeta(el)))
    );
    if (!inField) {
      inField = candidates[0] || null;
    }
    if (!outField) {
      outField = candidates.find((el) => el !== inField) || null;
    }

    return { inField, outField };
  }

  function isEmptyTimeField(field) {
    if (!field || !(field instanceof Element)) return true;
    let value = "";
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      value = (field.value || "").trim();
    } else if (field.isContentEditable) {
      value = (field.textContent || "").trim();
    } else {
      const input = field.querySelector && field.querySelector("input[type='text']");
      if (input && input instanceof HTMLInputElement) value = (input.value || "").trim();
    }
    return !value;
  }

  function findTargetInOutFields(root) {
    const scope = root || document;
    const pairs = findInOutFieldPairs(scope);
    if (!pairs.length) return findInOutFields(scope);

    const emptyPair = pairs.find((pair) => isEmptyTimeField(pair.inField) && isEmptyTimeField(pair.outField));
    return emptyPair || pairs[pairs.length - 1];
  }

  function countEmptyInOutPairs(root) {
    return findInOutFieldPairs(root).filter(
      (pair) => isEmptyTimeField(pair.inField) && isEmptyTimeField(pair.outField)
    ).length;
  }

  function findAddButtonInDialog(dialog) {
    const byAutomation = deepElements(dialog).find(
      (el) => el.getAttribute("data-automation-id") === "panelSetAddButton" && isVisible(el)
    );
    if (byAutomation) return byAutomation;
    return (
      findByText(/^Add$/i, { root: dialog, clickableOnly: true }) ||
      findByText(/^\+?\s*Add\b/i, { root: dialog, clickableOnly: true })
    );
  }

  function dayPatterns() {
    return {
      mon: /(pondelok|monday)/i,
      tue: /(utorok|tuesday)/i,
      wed: /(streda|wednesday)/i,
      thu: /(stvrtok|štvrtok|thursday)/i,
      fri: /(piatok|friday)/i,
      sat: /(sobota|saturday)/i,
      sun: /(nedela|nedeľa|sunday)/i
    };
  }

  function checkboxContextText(checkbox) {
    const node = checkbox.closest("label,div,tr,li,td") || checkbox.parentElement || checkbox;
    return normalizedText(node).toLowerCase();
  }

  function checkboxCheckedState(el) {
    if (!el) return false;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      return Boolean(el.checked);
    }
    const aria = (el.getAttribute("aria-checked") || "").toLowerCase();
    return aria === "true";
  }

  function dayLabelElements(dialog, pattern) {
    return deepElements(dialog)
      .filter((el) => {
        if (!isVisible(el)) return false;
        const text = normalizedText(el);
        if (!text || text.length > 40) return false;
        return pattern.test(text);
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      });
  }

  function findDayCheckbox(dialog, pattern) {
    const formLabels = deepElements(dialog).filter(
      (el) => el.getAttribute("data-automation-id") === "formLabel" && pattern.test(normalizedText(el))
    );
    for (const label of formLabels) {
      const forId = label.getAttribute("for");
      if (forId) {
        const input = document.getElementById(forId);
        if (input) return input;
      }
    }

    const checkboxes = deepElements(dialog).filter((el) => {
      if (el instanceof HTMLInputElement && el.type === "checkbox") return true;
      if ((el.getAttribute("role") || "").toLowerCase() === "checkbox") return true;
      return false;
    });
    if (!checkboxes.length) return null;

    const contextual = checkboxes.find((cb) => pattern.test(checkboxContextText(cb)));
    if (contextual) return contextual;

    const labels = dayLabelElements(dialog, pattern);
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const label of labels) {
      const lr = label.getBoundingClientRect();
      const ly = lr.top + lr.height / 2;
      for (const cb of checkboxes) {
        const cr = cb.getBoundingClientRect();
        const cy = cr.top + cr.height / 2;
        const cx = cr.left + cr.width / 2;
        const score = Math.abs(cy - ly) + (cx < lr.right ? 300 : 0) + Math.abs(cx - lr.right) * 0.15;
        if (score < bestScore) {
          best = cb;
          bestScore = score;
        }
      }
    }
    return best;
  }

  async function setCheckboxState(checkbox, checked) {
    if (!checkbox) return;
    if (checkbox.disabled) return;
    if (checkboxCheckedState(checkbox) === Boolean(checked)) return;

    const panel =
      checkbox.closest("[data-automation-id='checkboxPanel']") ||
      checkbox.closest("[data-automation-id='checkbox']")?.querySelector("[data-automation-id='checkboxPanel']");
    if (panel) {
      panel.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      panel.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      panel.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await sleep(DELAY_SHORT);
      if (checkboxCheckedState(checkbox) === Boolean(checked)) return;
    }

    clickElement(checkbox);
    await sleep(DELAY_SHORT);
    if (checkboxCheckedState(checkbox) === Boolean(checked)) return;

    const row = checkbox.closest("label,div,tr,li,td,section") || checkbox.parentElement;
    if (row) {
      clickElement(row);
      await sleep(DELAY_SHORT);
    }
  }

  async function setDays(dialog, selectedKeys) {
    const patterns = dayPatterns();
    const allKeys = Object.keys(patterns);
    for (const key of allKeys) {
      const cb = findDayCheckbox(dialog, patterns[key]);
      await setCheckboxState(cb, selectedKeys.includes(key));
    }
  }

  function findEmptyPair(dialog) {
    const pairs = findInOutFieldPairs(dialog);
    return pairs.find((p) => !p.inField.value && !p.outField.value) || null;
  }

  function findPairByInValue(dialog, inValue) {
    const pairs = findInOutFieldPairs(dialog);
    return pairs.find((p) => p.inField.value === inValue) || null;
  }

  async function fillRows(dialog, blocks, dayKeys) {
    await waitFor(
      () => findInOutFieldPairs(dialog).length > 0,
      TIMEOUT_MEDIUM, POLL_INTERVAL
    );
    let pairCount = findInOutFieldPairs(dialog).length;
    while (pairCount < blocks.length) {
      const btn = findAddButtonInDialog(dialog);
      if (!btn) return false;
      const before = pairCount;
      clickElement(btn);
      await sleep(DELAY_AFTER_BTN);
      const added = await waitFor(
        () => findInOutFieldPairs(dialog).length > before,
        TIMEOUT_ADD, POLL_INTERVAL
      );
      if (!added) return false;
      await sleep(DELAY_NAV);
      pairCount = findInOutFieldPairs(dialog).length;
    }

    let pairs = findInOutFieldPairs(dialog);
    while (pairs.length > blocks.length) {
      const emptyIndex = pairs.findIndex(
        (p) => isEmptyTimeField(p.inField) && isEmptyTimeField(p.outField)
      );
      if (emptyIndex < 0) break;
      const pair = pairs[emptyIndex];
      const removeBtn =
        findRemoveButtonForField(dialog, pair.inField) || findRemoveButtonForField(dialog, pair.outField);
      if (!removeBtn) break;
      clickElement(removeBtn);
      await sleep(DELAY_AFTER_BTN);
      await sleep(DELAY_REMOVE);
      pairs = findInOutFieldPairs(dialog);
    }
    for (let i = 0; i < blocks.length; i += 1) {
      const pair = pairs[i];
      if (!pair) return false;

      setFieldValue(pair.inField, blocks[i].inTime);
      await sleep(DELAY_NAV);

      const fresh = findPairByInValue(dialog, blocks[i].inTime);
      const outField = (fresh && fresh.outField) ? fresh.outField : pair.outField;
      setFieldValue(outField, blocks[i].outTime);
      await sleep(DELAY_NAV);
    }

    await setDays(dialog, dayKeys);
    return true;
  }

  function setFieldValue(el, value) {
    if (!el) return false;
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(el.__proto__, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(el, value);
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
      return true;
    }
    if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
      return true;
    }
    return false;
  }

  // ========== 10. PANEL UI ==========
  // (STYLE is in §4 above.)
  function setStatus(text, type) {
    const statusEl = document.querySelector(`#${PANEL_ID} .wd-status`);
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "wd-status" + (type ? ` wd-${type}` : "");
  }

  function formatError(error) {
    return error && error.message ? error.message : "Unknown error";
  }

  function findActionsButton() {
    const dropDown = deepElements(document).find(
      (el) => el.getAttribute("data-automation-id") === "dropDownCommandButton" && isVisible(el)
    );
    if (dropDown) {
      const btn = dropDown.querySelector("button");
      if (btn && isVisible(btn)) return btn;
    }
    return findByText(/^Actions$/i, { root: document, clickableOnly: true });
  }

  function findQuickAddMenuItem() {
    return deepElements(document).find(
      (el) =>
        isVisible(el) &&
        el.getAttribute("data-automation-id") === "dropdown-option" &&
        /^Quick Add$/i.test(normalizedText(el))
    ) || findByText(/^Quick Add$/i, { root: document, clickableOnly: true });
  }

  async function openQuickAddFromWeekPage() {
    const actionsBtn = findActionsButton();
    if (!actionsBtn) throw new Error("Could not find Actions button.");
    clickElement(actionsBtn);
    await sleep(DELAY_AFTER_BTN);
    await sleep(DELAY_NAV);

    let quickAddItem = await waitFor(findQuickAddMenuItem, TIMEOUT_LONG, POLL_INTERVAL);
    if (!quickAddItem) {
      clickElement(actionsBtn);
      await sleep(DELAY_AFTER_BTN);
      await sleep(DELAY_NAV);
      quickAddItem = await waitFor(findQuickAddMenuItem, TIMEOUT_MEDIUM, POLL_INTERVAL);
    }
    if (!quickAddItem) throw new Error("Could not find Quick Add in Actions menu.");
    clickElement(quickAddItem);
    await sleep(DELAY_AFTER_BTN);

    const dialog = await waitFor(() => findDialog(), TIMEOUT_LONG, POLL_INTERVAL);
    if (!dialog) throw new Error("Quick Add dialog did not open.");
    await sleep(DELAY_NAV);
    return dialog;
  }

  // ========== 9. STORAGE & DEFAULTS ==========
  const DEFAULT_TIMES = {
    wdBlock1In: "00:00", wdBlock1Out: "08:59",
    wdBlock2In: "17:00", wdBlock2Out: "23:59",
    weekendIn: "00:00", weekendOut: "23:59"
  };

  function loadTimes() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(Object.keys(DEFAULT_TIMES), (data) => {
        const merged = {};
        for (const [key, fallback] of Object.entries(DEFAULT_TIMES)) {
          merged[key] = (data[key] || "").trim() || fallback;
        }
        resolve(merged);
      });
    });
  }

  // ========== 11. FLOW RUNNERS ==========
  let isRunning = false;

  async function runSelectStandbyTypeFlow() {
    if (isRunning) return;
    isRunning = true;
    try {
      if (!isQuickAddContext() && isEnterTimePage()) {
        setStatus("Opening Quick Add…", "busy");
        await openQuickAddFromWeekPage();
        await waitFor(isQuickAddContext, TIMEOUT_LONG, POLL_INTERVAL);
      }
      if (!isQuickAddContext()) {
        setStatus("Could not open Quick Add.", "err");
        return;
      }
      const ok = await ensureTimeTypeInQuickAdd(quickAddScope());
      setStatus(ok ? "Time Type set to On Call Standby Hours." : "Could not set Time Type.");
    } catch (error) {
      setStatus(`Failed: ${formatError(error)}`);
    } finally {
      isRunning = false;
    }
  }

  async function runBlockFlow(addBlocksFn) {
    if (isRunning) return;
    isRunning = true;
    try {
      if (!isQuickAddContext() && isEnterTimePage()) {
        setStatus("Opening Quick Add…", "busy");
        await openQuickAddFromWeekPage();
        await waitFor(isQuickAddContext, TIMEOUT_LONG, POLL_INTERVAL);
      }
      if (!isQuickAddContext()) {
        setStatus("Could not open Quick Add.", "err");
        return;
      }
      setStatus("Selecting time type…", "busy");
      let scope = quickAddScope();
      await ensureTimeTypeInQuickAdd(scope);
      setStatus("Filling time blocks…", "busy");
      scope = await ensureInOutStep(scope);
      await sleep(DELAY_NAV);
      scope = quickAddScope();
      const { inField, outField } = findInOutFields(scope);
      if (!inField || !outField) {
        setStatus("Could not find In/Out fields.", "err");
        return;
      }
      await addBlocksFn(scope);
    } catch (error) {
      setStatus(`${formatError(error)}`, "err");
    } finally {
      isRunning = false;
    }
  }

  async function runWorkdaysFlow() {
    await runBlockFlow(async (scope) => {
      const t = await loadTimes();
      const blocks = [
        { inTime: t.wdBlock1In, outTime: t.wdBlock1Out },
        { inTime: t.wdBlock2In, outTime: t.wdBlock2Out }
      ];
      const ok = await fillRows(scope, blocks, ["mon", "tue", "wed", "thu", "fri"]);
      setStatus(ok
        ? "Workdays done — click OK to submit."
        : "Failed to add workday blocks.", ok ? "ok" : "err");
    });
  }

  async function runWeekendFlow() {
    await runBlockFlow(async (scope) => {
      const t = await loadTimes();
      const blocks = [{ inTime: t.weekendIn, outTime: t.weekendOut }];
      const ok = await fillRows(scope, blocks, ["sat", "sun"]);
      if (ok) {
        const sunCb = findDayCheckbox(scope, dayPatterns().sun);
        const sunSkipped = sunCb && sunCb.disabled;
        setStatus(sunSkipped
          ? "Weekend done (Sat only — Sun disabled). Click OK."
          : "Weekend done — click OK to submit.", "ok");
      } else {
        setStatus("Failed to add weekend block.", "err");
      }
    });
  }

  // ========== 8. CLEAR EMPTY ROWS ==========
  function findRowForField(field) {
    if (!field || !field.closest) return null;
    return (
      field.closest("[data-automation-id*='panelSetRow']") ||
      field.closest("[data-automation-id*='Row']") ||
      field.closest("tr") ||
      field.closest("[role='row']")
    );
  }

  function findRemoveButtonInRow(row) {
    if (!row) return null;
    const byAutomation = deepElements(row).find(
      (el) => el.getAttribute("data-automation-id") === "panelSetRowDeleteButton" && isVisible(el)
    );
    if (byAutomation) return byAutomation;
    const byText = findByText(/\b(Remove|Delete)\b/i, { root: row, clickableOnly: true });
    if (byText) return byText;
    const byAria = deepElements(row).find((el) => {
      if (!isVisible(el)) return false;
      const label = (el.getAttribute("aria-label") || "").toLowerCase();
      return (label.includes("remove") || label.includes("delete")) && (el.tagName === "BUTTON" || el.getAttribute("role") === "button");
    });
    return byAria || null;
  }

  function findRemoveButtonForField(scope, field) {
    const row = findRowForField(field);
    if (row) {
      const inRow = findRemoveButtonInRow(row);
      if (inRow) return inRow;
    }
    const removeButtons = deepElements(scope).filter((el) => {
      if (!isVisible(el)) return false;
      if (el.getAttribute("data-automation-id") === "panelSetRowDeleteButton") return true;
      const label = normalizedText(el);
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return (label && /\b(Remove|Delete)\b/i.test(label)) || aria.includes("remove") || aria.includes("delete");
    });
    if (!removeButtons.length) return null;
    const fr = field.getBoundingClientRect();
    const fy = fr.top + fr.height / 2;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const btn of removeButtons) {
      const br = btn.getBoundingClientRect();
      const by = br.top + br.height / 2;
      const dist = Math.abs(by - fy) + Math.abs(br.left - fr.left) * 0.3;
      if (dist < bestDist) {
        best = btn;
        bestDist = dist;
      }
    }
    return best;
  }

  async function clearEmptyRows(scope) {
    await sleep(DELAY_NAV);
    let totalRemoved = 0;
    const MAX_PASSES = 20;

    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const pairs = findInOutFieldPairs(scope);
      const emptyIndex = pairs.findIndex(
        (p) => isEmptyTimeField(p.inField) && isEmptyTimeField(p.outField)
      );
      if (emptyIndex < 0) break;

      const pair = pairs[emptyIndex];
      let removeBtn =
        findRemoveButtonForField(scope, pair.inField) || findRemoveButtonForField(scope, pair.outField);
      if (!removeBtn) {
        const allRemoveBtns = deepElements(scope).filter(
          (el) => isVisible(el) && (el.getAttribute("data-automation-id") === "panelSetRowDeleteButton" || /\b(Remove|Delete)\b/i.test(normalizedText(el)))
        );
        if (allRemoveBtns.length > emptyIndex) removeBtn = allRemoveBtns[emptyIndex];
      }
      if (!removeBtn) break;

      clickElement(removeBtn);
      await sleep(DELAY_AFTER_BTN);
      totalRemoved += 1;
      await sleep(DELAY_REMOVE);
      await sleep(DELAY_SELECT);
    }

    return totalRemoved;
  }

  async function runClearEmptyRows() {
    if (isRunning) return;
    isRunning = true;
    try {
      setStatus("Cleaning…", "busy");
      const removed = await clearEmptyRows(quickAddScope());
      setStatus(removed > 0 ? `Removed ${removed} empty row(s).` : "No empty rows.", removed > 0 ? "ok" : undefined);
    } catch (error) {
      setStatus(formatError(error), "err");
    } finally {
      isRunning = false;
    }
  }

  async function runEnterThisWeek() {
    if (isRunning) return;
    isRunning = true;
    try {
      setStatus("Opening This Week\u2026", "busy");
      const el = findThisWeekElement();
      if (!el) {
        setStatus("Could not find This Week button.", "err");
        return;
      }
      clickElement(el);
      setStatus("Navigating\u2026", "busy");
    } catch (error) {
      setStatus("Failed: " + formatError(error), "err");
    } finally {
      isRunning = false;
    }
  }

  async function runSaveEnterTimeUrl() {
    if (isRunning) return;
    isRunning = true;
    try {
      setStatus("Saving Enter Time URL\u2026", "busy");
      const url = isEnterTimePage() ? window.location.href : findEnterTimeUrl();
      if (!url) {
        setStatus("Could not find time entry URL.", "err");
        return;
      }
      await new Promise((resolve) => {
        chrome.storage.sync.set({ timePageUrl: url }, () => {
          setStatus("Saved! Extension icon now opens this page.", "ok");
          resolve();
        });
      });
    } catch (error) {
      setStatus("Failed: " + formatError(error), "err");
    } finally {
      isRunning = false;
    }
  }

  function buildTimeDesc(keys) {
    const d = DEFAULT_TIMES;
    if (keys.length === 4) {
      return `${d[keys[0]]} – ${d[keys[1]]}  &  ${d[keys[2]]} – ${d[keys[3]]}`;
    }
    return `${d[keys[0]]} – ${d[keys[1]]}`;
  }

  function injectPanel() {
    if (!document.body) return;
    if (!shouldShowPanel()) return;
    if (document.getElementById(PANEL_ID)) return;

    const style = document.createElement("style");
    style.id = `${PANEL_ID}-style`;
    style.textContent = STYLE;
    document.documentElement.appendChild(style);

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="wd-header">
        <span>Workday Helper</span>
        <button type="button" class="wd-toggle" aria-label="Collapse panel" title="Collapse">−</button>
      </div>
      <div class="wd-body">
        <div class="wd-action wd-landing-action" data-flow="this-week" tabindex="0" role="button">
          <div class="wd-action-icon wd-weekday">T</div>
          <div class="wd-action-info">
            <div class="wd-action-title">Enter This Week</div>
            <div class="wd-action-desc">Open weekly time entry view</div>
          </div>
          <div class="wd-action-arrow">›</div>
        </div>
        <div class="wd-action wd-quickadd-action" data-flow="workdays" tabindex="0" role="button">
          <div class="wd-action-icon wd-weekday">W</div>
          <div class="wd-action-info">
            <div class="wd-action-title">Workdays</div>
            <div class="wd-action-desc">Mon–Fri · ${buildTimeDesc(["wdBlock1In","wdBlock1Out","wdBlock2In","wdBlock2Out"])}</div>
          </div>
          <div class="wd-action-arrow">›</div>
        </div>
        <div class="wd-action wd-quickadd-action" data-flow="weekend" tabindex="0" role="button">
          <div class="wd-action-icon wd-weekend">S</div>
          <div class="wd-action-info">
            <div class="wd-action-title">Weekend</div>
            <div class="wd-action-desc">Sat–Sun · ${buildTimeDesc(["weekendIn","weekendOut"])}</div>
          </div>
          <div class="wd-action-arrow">›</div>
        </div>
        <div class="wd-util-row">
          <button type="button" class="wd-quickadd-action" data-flow="clear">Clear empty rows</button>
          <div class="wd-util-sep wd-quickadd-action"></div>
          <button type="button" data-flow="save-url">Set as Quick Link</button>
        </div>
        <div class="wd-status" role="status" aria-live="polite">Ready</div>
      </div>
    `;

    const header = panel.querySelector(".wd-header");
    const toggleBtn = panel.querySelector(".wd-toggle");
    function setCollapsed(collapsed) {
      panel.classList.toggle("wd-collapsed", collapsed);
      if (toggleBtn) {
        toggleBtn.textContent = collapsed ? "▶" : "−";
        toggleBtn.setAttribute("aria-label", collapsed ? "Expand panel" : "Collapse panel");
        toggleBtn.title = collapsed ? "Expand" : "Collapse";
      }
    }
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setCollapsed(!panel.classList.contains("wd-collapsed"));
    });
    header.addEventListener("click", (e) => {
      if (panel.classList.contains("wd-collapsed") && !e.target.closest(".wd-toggle")) setCollapsed(false);
    });
    panel.querySelector("[data-flow='this-week']").addEventListener("click", runEnterThisWeek);
    panel.querySelector("[data-flow='save-url']").addEventListener("click", runSaveEnterTimeUrl);
    panel.querySelector("[data-flow='workdays']").addEventListener("click", runWorkdaysFlow);
    panel.querySelector("[data-flow='weekend']").addEventListener("click", runWeekendFlow);
    panel.querySelector("[data-flow='clear']").addEventListener("click", runClearEmptyRows);

    document.body.appendChild(panel);

    loadTimes().then((t) => {
      const wdDesc = panel.querySelector("[data-flow='workdays'] .wd-action-desc");
      const weDesc = panel.querySelector("[data-flow='weekend'] .wd-action-desc");
      if (wdDesc) wdDesc.textContent = `Mon–Fri · ${t.wdBlock1In} – ${t.wdBlock1Out}  &  ${t.wdBlock2In} – ${t.wdBlock2Out}`;
      if (weDesc) weDesc.textContent = `Sat–Sun · ${t.weekendIn} – ${t.weekendOut}`;
    });

  }

  function removePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
  }

  function updatePanelActions() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const landing = isTimeLandingPage();
    panel.querySelectorAll(".wd-landing-action").forEach((el) => {
      el.style.display = landing ? "" : "none";
    });
    panel.querySelectorAll(".wd-quickadd-action").forEach((el) => {
      el.style.display = landing ? "none" : "";
    });
  }

  function syncPanel() {
    if (shouldShowPanel()) {
      injectPanel();
      updatePanelActions();
    } else {
      removePanel();
    }
  }

  function isLikelyWorkdayPage() {
    return /\.myworkday\.com$/i.test(location.hostname);
  }

  // ========== 12. ENTRY POINT ==========
  function boot() {
    try {
      if (!isLikelyWorkdayPage()) return;
      syncPanel();

      let syncDebounce;
      const observer = new MutationObserver(() => {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(syncPanel, DEBOUNCE_SYNC);
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (err) {
      // Silently degrade — extension must not break the host page.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
