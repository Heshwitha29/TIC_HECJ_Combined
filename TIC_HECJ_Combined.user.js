// ==UserScript==
// @name Orbit Tool Invoked clippings & Human evaluator cannot judge
// @namespace http://tampermonkey.net/
// @version 1.7.0
// @description Human Evaluator - Cannot Judge widget + Tool Invoked Clippings in one script
// @match https://orbit-gamma.beta.harmony.a2z.com/*
// @match https://orbit-beta.beta.harmony.a2z.com/*
// @match https://abc-mlops.beta.harmony.a2z.com/*
// @run-at document-idle
// @grant GM_addStyle
// ==/UserScript==

// ==============================
// Feature 1: Human Evaluator Widget
// ==============================

(function () {

'use strict';

function isHEValue(text) {
  const t = (text || '').toLowerCase();
  return t.includes('human evaluator') || t.includes('cannot judge');
}

function createButton() {
  const btn = document.createElement('button');
  btn.textContent = '🚫 Human Evaluator - Cannot Judge';
  btn.style.cssText = `
    display: inline-block;
    margin-left: 10px;
    vertical-align: middle;
    background: #1e293b;
    color: #f8fafc;
    border: 1.5px solid #475569;
    border-radius: 6px;
    padding: 3px 10px;
    font: 600 11px/1.4 sans-serif;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  `;
  btn.onmouseenter = () => { btn.style.background = '#0f172a'; btn.style.borderColor = '#94a3b8'; };
  btn.onmouseleave = () => {
    if (!btn.dataset.active) { btn.style.background = '#1e293b'; btn.style.borderColor = '#475569'; }
  };
  return btn;
}

function showFeedback(btn, success) {
  btn.textContent = success ? '✓ Done' : '⚠ Check fields';
  btn.style.background = success ? '#14532d' : '#7f1d1d';
  btn.style.borderColor = success ? '#22c55e' : '#ef4444';
  btn.dataset.active = 'true';
  setTimeout(() => {
    btn.textContent = '🚫 Human Evaluator - Cannot Judge';
    btn.style.background = '#1e293b';
    btn.style.borderColor = '#475569';
    delete btn.dataset.active;
  }, 2500);
}

function getRadioLabel(radio) {
  if (radio.id) {
    try {
      const lbl = document.querySelector('label[for="' + CSS.escape(radio.id) + '"]');
      if (lbl) return lbl.textContent.trim();
    } catch(e) {}
  }
  const parentLabel = radio.closest('label');
  if (parentLabel) return parentLabel.textContent.trim();
  const next = radio.nextSibling;
  if (next && next.nodeType === 3 && next.textContent.trim()) return next.textContent.trim();
  if (radio.nextElementSibling) return radio.nextElementSibling.textContent.trim();
  return radio.value || '';
}

function setRadios() {
  const groups = {};
  [...document.querySelectorAll('input[type="radio"]')].forEach(radio => {
    const name = radio.name
      || radio.closest('fieldset')?.id
      || (radio.id ? radio.id.replace(/\d+$/, '') : '')
      || '';
    if (!groups[name]) groups[name] = [];
    groups[name].push(radio);
  });
  Object.values(groups).forEach(group => {
    for (const radio of group) {
      const text = getRadioLabel(radio);
      if (isHEValue(text) || isHEValue(radio.value)) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  });
}

function setContextSwitchHE() {
  const allRadios = [...document.querySelectorAll('input[type="radio"]')];
  for (const radio of allRadios) {
    const label = getRadioLabel(radio);
    if (!isHEValue(label) && !isHEValue(radio.value)) continue;
    let el = radio.parentElement;
    for (let i = 0; i < 12; i++) {
      if (!el) break;
      const txt = el.textContent.toLowerCase();
      if (txt.includes('context switch') && txt.length < 600) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      el = el.parentElement;
    }
  }
}

function openAndSelectHE(trigger) {
  return new Promise((resolve) => {
    trigger.click();
    // Shared finder — catches li, ARIA roles, and any class-based dropdown items
    const findHE = () => [...document.querySelectorAll(
      'li, [role="option"], [role="menuitem"], [class*="option"], [class*="item"], [class*="dropdown-item"]'
    )].filter(el => el.offsetParent !== null)
      .find(el => isHEValue(el.textContent.trim()));
    // Fast path: React may render the dropdown synchronously
    const immediate = findHE();
    if (immediate) { immediate.click(); resolve(true); return; }
    // Poll every 30ms (max 300ms) — tight loop, gives up fast if no HE option appears
    let tries = 0;
    const poll = setInterval(() => {
      const heOption = findHE();
      if (heOption) { clearInterval(poll); heOption.click(); resolve(true); return; }
      if (++tries > 10) {
        clearInterval(poll);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        resolve(false);
      }
    }, 30);
  });
}

function getDropdownTriggers() {
  // Collect custom dropdown triggers across different placeholder patterns
  const seen = new Set();
  const results = [];
  const candidates = document.querySelectorAll(
    'button, [role="button"], [role="combobox"], [role="listbox"], [role="option"], span, div'
  );
  for (const el of candidates) {
    if (!el.offsetParent || seen.has(el)) continue;
    // Skip native selects — handled by setSelectDropdowns()
    if (el.tagName === 'SELECT') continue;
    const text = el.textContent.trim();
    if (text.length > 100) continue;
    const isCombobox = el.getAttribute('role') === 'combobox';
    const isPlaceholder = /^Select[\s.…]*/i.test(text) ||
                          /^Choose[\s.…]*/i.test(text) ||
                          /^-- ?select ?--$/i.test(text) ||
                          /^none selected$/i.test(text) ||
                          text === '' && isCombobox;
    if (isPlaceholder || (isCombobox && !el.getAttribute('aria-expanded'))) {
      seen.add(el);
      results.push(el);
    }
  }
  return results;
}

function setSelectDropdowns() {
  [...document.querySelectorAll('select')].forEach(sel => {
    for (const opt of sel.options) {
      if (isHEValue(opt.text) || isHEValue(opt.value)) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  });
}

async function fillAllWithHE(btn) {
  btn.textContent = '⏳ Filling...';
  btn.disabled = true;
  setSelectDropdowns();
  const triggers = getDropdownTriggers();
  for (const trigger of triggers) {
    await openAndSelectHE(trigger);
    await new Promise(r => setTimeout(r, 50));
  }
  await new Promise(r => setTimeout(r, 50));
  setRadios();
  await new Promise(r => setTimeout(r, 150));
  setContextSwitchHE();
  btn.disabled = false;
  showFeedback(btn, true);
}

function injectButton() {
  if (document.getElementById('orbit-he-btn')) return;
  const allEls = [...document.querySelectorAll('label, legend, p, span, b, strong, div, h1,h2,h3,h4,h5')];
  const labelEl = allEls.find(el => {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    return own.includes('Turn Type Classification');
  });
  if (!labelEl) return;
  const btn = createButton();
  btn.id = 'orbit-he-btn';
  btn.addEventListener('click', (e) => { e.preventDefault(); fillAllWithHE(btn); });
  labelEl.appendChild(btn);
}

const observer = new MutationObserver(() => {
  if (document.querySelector('input[type="radio"]')) injectButton();
});
observer.observe(document.body, { childList: true, subtree: true });
injectButton();

})();

// ==============================
// Feature 2: Tool Invoked Clippings
// ==============================

(function () {

'use strict';

const TOOL_MAP = {
  'Your Orders':['get_orders_information','get_orders'],
  'Approvals': ['diagnose_approval_execution','get_approval_delegations','get_approval_notifications'],
  'Tax Exemption (ATEP)': ['diagnose_tax_exemption_issue','get_atep_checkout_configuration','get_enrollment_status','get_exemption_assignment_snapshot','list_exemptions'],
  'Guided Buying': ['GBQuery_POC','GBGetPolicies','GBListApplicablePolicies','GBListAvailableTemplates'],
  'Savings Agent': ['get_savings_recommendation'],
  'Spend Anomaly Monitoring': ['get_spend_anomaly_reviews','get_spend_anomaly_recommendations'],
  'Business Order Information': ['diagnose_custom_order_fields'],
  'Pay By Invoice / BCA': ['get_pay_by_invoice_account_summary','get_pay_by_invoice_transactions'],
  'KB / Feature Queries': ['search_amazon_business_knowledge_base'],
};

const ALL_TOOLS = [
  'diagnose_approval_execution','diagnose_custom_order_fields','diagnose_tax_exemption_issue',
  'GBGetPolicies','GBListApplicablePolicies','GBListAvailableTemplates','GBQuery_POC',
  'get_approval_delegations','get_approval_notifications','get_atep_checkout_configuration',
  'get_current_time','get_enrollment_status','get_exemption_assignment_snapshot',
  'get_orders','get_orders_information',
  'get_pay_by_invoice_account_summary','get_pay_by_invoice_transactions',
  'get_savings_recommendation','get_spend_anomaly_recommendations','get_spend_anomaly_reviews',
  'list_exemptions',
  'search_amazon_business_knowledge_base',
];

const TOOL_DESCRIPTIONS = {
  'diagnose_approval_execution':'Diagnoses approval execution for an order - status, applied policy, approver, buyer, delegator, checkout group and timeline',
  'diagnose_custom_order_fields': 'Diagnoses Custom Order Fields (COF) / Business Order Information (BOI) - checkout group config, PO number, cost center, GL code, project code',
  'diagnose_tax_exemption_issue': 'Diagnoses why a tax exemption is not applying at checkout - root_cause, severity, explanation, resolution steps, action_url',
  'GBGetPolicies': 'Retrieves specific Guided Buying policies by resource policy ID - title, intent, description, group, criteria, and view link',
  'GBListApplicablePolicies': 'Lists and searches Guided Buying policies that apply to a business group - title, resource policy ID, intent, audit metadata, enriched criteria',
  'GBListAvailableTemplates': 'Lists Guided Buying policy types available for a business group - what policy types can be created based on BP tier and marketplace',
  'GBQuery_POC': 'Read-only Guided Buying query - policy lookup, matching rules, conflict resolution, customer-specific policy analysis',
  'get_approval_delegations': 'Retrieves active approval delegations and history for an approver - delegate assignments, start/end times',
  'get_approval_notifications': 'Retrieves approval notification records for an order - type, recipient, processing time',
  'get_atep_checkout_configuration': 'Returns ATEP account settings and checkout permissions - checkout_behavior, tax_exemption_enabled, opt_out_enabled',
  'get_current_time': 'Returns current UTC time as ISO8601 - used for date calculations, expiry checks, time-sensitive operations',
  'get_enrollment_status': 'Checks ATEP enrollment status (ENROLLED / NOT_ENROLLED / PARTIALLY_ENROLLED) - exemption counts by status, jurisdictions, URLs',
  'get_exemption_assignment_snapshot': 'Checks whether tax exemptions apply for a customer at a specific point in time',
  'get_orders': 'Retrieves order info via Bedrock AgentCore - status, items, tracking, returns, refunds, cancellations (Weblab C variant)',
  'get_orders_information': 'Retrieves order info via ABOM agent API Gateway - status, items, tracking, returns, refunds, cancellations. Up to 3 recent orders',
  'get_pay_by_invoice_account_summary': 'Returns BCA/PBI account summary - total due, past due, available credit limit, unapplied credits, pending charges, payment terms',
  'get_pay_by_invoice_transactions': 'Returns BCA/PBI transaction history - invoices, credit memos, payments, IDs, statuses, amounts, due dates, days past due',
  'get_savings_recommendation': 'Personalized savings recommendations - quantity/bulk discounts, Subscribe and Save, Prime Business exclusive pricing',
  'get_spend_anomaly_recommendations': 'Policy recommendations to prevent future spend anomalies - category/item restrictions based on flagged purchases',
  'get_spend_anomaly_reviews': 'Lists spend anomalies / unusual orders - defaults last 30 days, up to 90 days. Returns anomaly details, order ID, buyer info, type',
  'list_exemptions': 'Lists tax exemptions - filter by status, jurisdiction, expiring_within_days. Returns id, name, status, expiration, type',
  'search_amazon_business_knowledge_base': 'Fallback KB tool - searches AB knowledge base for HVA feature and informational queries across all AB categories and features',
};

const HVA_KEYWORD_MAP = [
  { keywords: ['your order','order information'], category: 'Your Orders' },
  { keywords: ['approval'], category: 'Approvals' },
  { keywords: ['atep','tax exemption','tax'], category: 'Tax Exemption (ATEP)' },
  { keywords: ['guided buying'], category: 'Guided Buying' },
  { keywords: ['savings agent','savings'], category: 'Savings Agent' },
  { keywords: ['spend anomaly','anomaly'], category: 'Spend Anomaly Monitoring' },
  { keywords: ['business order info','boi','cof'], category: 'Business Order Information' },
  { keywords: ['pay by invoice','pbi','bca','invoice'], category: 'Pay By Invoice / BCA' },
];

function getCustomTools() {
  try { return JSON.parse(localStorage.getItem('ti_filler_custom_tools') || '[]'); } catch(e) { return []; }
}
function saveCustomTools(list) {
  try { localStorage.setItem('ti_filler_custom_tools', JSON.stringify(list)); } catch(e) {}
}
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

GM_addStyle(`
  #ti-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:99998;display:none; }
  #ti-picker {
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:#ffffff;border:none;border-radius:12px;padding:0;z-index:99999;display:none;
    box-shadow:0 12px 40px rgba(0,0,0,0.45);min-width:480px;max-width:560px;
    max-height:85vh;overflow-y:auto;font-family:Arial,sans-serif;}
  #ti-picker .ti-header { background:#131921;padding:16px 20px 14px;border-radius:12px 12px 0 0;position:sticky;top:0;z-index:10; }
  #ti-picker .ti-header h3 { margin:0 0 4px;font-size:15px;font-weight:bold;color:#FF9900;letter-spacing:0.3px; }
  #ti-picker .ti-step-label { font-size:10px;color:#aaaaaa;text-transform:uppercase;letter-spacing:1.2px;margin:0; }
  #ti-picker .ti-body { padding:14px 20px 20px; }
  #ti-picker .ti-hva-detected { background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:8px 12px;font-size:12px;color:#2e7d32;margin-bottom:12px;font-weight:bold; }
  #ti-picker .ti-search { width:100%;padding:9px 14px;margin-bottom:12px;border:1.5px solid #dddddd;border-radius:6px;font-size:13px;box-sizing:border-box;background:#f9f9f9;color:#131921; }
  #ti-picker .ti-search:focus { outline:none;border-color:#FF9900;background:#fff;box-shadow:0 0 0 2px rgba(255,153,0,0.15); }
  #ti-picker .ti-opt-row { display:flex;align-items:flex-start;gap:6px;margin-bottom:7px; }
  #ti-picker .ti-opt {
    flex:1;padding:10px 14px 10px 16px;background:#f8f8f8;border:1px solid #e0e0e0;
    border-left:5px solid #FF9900;border-radius:6px;cursor:pointer;text-align:left;
    font-size:13px;color:#131921;line-height:1.5;box-sizing:border-box;
    white-space:normal;transition:background 0.15s,color 0.15s;
  }
  #ti-picker .ti-opt:hover { background:#131921;color:#FF9900;border-left-color:#FF9900;border-color:#131921; }
  #ti-picker .ti-opt-no { border-left-color:#cc0000;background:#fff5f5; }
  #ti-picker .ti-opt-no:hover { background:#cc0000;color:#ffffff;border-color:#cc0000;border-left-color:#cc0000; }
  #ti-picker .ti-opt-kb { border-left-color:#0066cc;background:#e8f4fd;color:#131921; }
  #ti-picker .ti-opt-kb:hover { background:#0066cc;color:#ffffff;border-color:#0066cc;border-left-color:#0066cc; }
  #ti-picker .ti-opt-tool { background:#f0f8ff;border-left-color:#0066cc;border-color:#cce0ff;color:#131921;font-family:monospace;font-size:12px; }
  #ti-picker .ti-opt-tool:hover { background:#131921;color:#66aaff;border-color:#131921;border-left-color:#0066cc; }
  #ti-picker .ti-opt-tool-match { background:#fff8e1;border-left-color:#FF9900;border-color:#ffe082;color:#131921;font-family:monospace;font-size:12px;font-weight:bold; }
  #ti-picker .ti-opt-tool-match:hover { background:#131921;color:#FF9900;border-color:#131921;border-left-color:#FF9900; }
  #ti-picker .ti-opt-debug { background:#f5f0ff;border-left-color:#7c3aed;border-color:#ddd6fe;color:#4c1d95;font-size:11px; }
  #ti-picker .ti-opt-debug:hover { background:#7c3aed;color:#ffffff;border-color:#7c3aed;border-left-color:#7c3aed; }
  #ti-picker .ti-section-label { font-size:11px;color:#999999;margin:10px 0 6px;text-transform:uppercase;letter-spacing:1px;border-top:1px dashed #e0e0e0;padding-top:10px; }
  #ti-picker .ti-debug-box { background:#1e1e2e;color:#cdd6f4;border-radius:6px;padding:10px 12px;font-size:11px;font-family:monospace;margin-bottom:10px;max-height:180px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5; }
  #ti-picker .ti-back { display:block;width:100%;padding:10px 12px;margin-top:10px;background:#f0f0f0;color:#131921;border:1px solid #cccccc;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;box-sizing:border-box;transition:background 0.15s,color 0.15s; }
  #ti-picker .ti-back:hover { background:#131921;color:#ffffff;border-color:#131921; }
  #ti-picker .ti-cancel { display:block;width:100%;padding:10px 12px;margin-top:6px;background:#131921;color:#ffffff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;box-sizing:border-box;transition:background 0.15s; }
  #ti-picker .ti-cancel:hover { background:#000000; }
  #ti-badge {
    position:fixed;bottom:55px;right:15px;background:#0a2540;color:#66aaff;
    padding:6px 8px;border-radius:20px;font-size:11px;font-weight:bold;z-index:99997;
    box-shadow:0 2px 10px rgba(0,0,0,0.4);font-family:Arial,sans-serif;cursor:pointer;
    border:1.5px solid #66aaff;transition:all 0.2s;max-width:18px;overflow:hidden;
    opacity:0.4;white-space:nowrap;
  }
  #ti-badge:hover { max-width:200px;opacity:1;background:#66aaff;color:#0a2540;padding:8px 16px; }
  .ti-toast { position:fixed;bottom:100px;right:15px;background:#0a2540;color:#66aaff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:100002;box-shadow:0 4px 14px rgba(0,0,0,0.35);font-family:Arial,sans-serif;border:1px solid #66aaff;font-weight:bold; }
  #ti-picker .ti-opt-dpq { border-left-color:#e65c00;background:#fff3e0;color:#131921; }
  #ti-picker .ti-opt-dpq:hover { background:#e65c00;color:#ffffff;border-color:#e65c00;border-left-color:#e65c00; }
  .ti-hide { display:none !important; }
`);

const badge = document.createElement('div');
badge.id = 'ti-badge';
badge.textContent = '\u{1F535} TI Filler Active';
badge.title = 'Click to open Tool Invoked picker (or Ctrl+Shift+T)';
badge.addEventListener('click', () => showPicker());
document.body.appendChild(badge);

const overlay = document.createElement('div');
overlay.id = 'ti-overlay';
document.body.appendChild(overlay);
overlay.addEventListener('click', () => { if (Date.now() - lastOpenTime < 600) return; hidePicker(); });

const picker = document.createElement('div');
picker.id = 'ti-picker';
document.body.appendChild(picker);

let pickerBusy = false;

let lastOpenTime = 0;
function showPicker() { pickerBusy = true; lastOpenTime = Date.now(); overlay.style.display = 'block'; picker.style.display = 'block'; renderStep1(); }
function hidePicker() { overlay.style.display = 'none'; picker.style.display = 'none'; setTimeout(() => { pickerBusy = false; }, 500); }

// ── NEW: Static Response Type = N/A trigger helpers ───────────────────────
//
// Identifies the Static Response Type dropdown by the presence of the
// "Engaging Customer - Clarity/Information" option (same fingerprint as auto-fill v9.7).
function isStaticResponseTypeSelect(el) {
  if (!el || el.tagName !== 'SELECT') return false;
  for (const opt of el.options) {
    const t = (opt.text || '').toLowerCase();
    if (t.includes('engaging customer') || t.includes('clarity/information') ||
        t.includes('engaging-waiting') || t.includes('engaging_waiting')) return true;
  }
  // Fallback: name/id hints
  const nameId = ((el.name || '') + ' ' + (el.id || '')).toLowerCase();
  return nameId.includes('static') || nameId.includes('response_type') || nameId.includes('responsetype');
}

// Returns true when the currently selected option is N/A.
function selectedOptionIsNA(el) {
  if (el.selectedIndex < 0) return false;
  const text = (el.options[el.selectedIndex]?.text || '').trim();
  const val  = (el.options[el.selectedIndex]?.value || '').trim();
  return /^n\/a$/i.test(text) || /^n\/a$/i.test(val) || /^na$/i.test(text);
}

// Returns true when a tool was actually invoked in the current chat message.
// Reads the #hva-tool-invoked-badge element — visible + non-empty means a tool fired.
function isToolInvokedInChat() {
  const badge = document.getElementById('hva-tool-invoked-badge');
  if (!badge) return false;
  return badge.style.display !== 'none' && badge.textContent.trim().length > 0;
}
// Clicks the Tool Invoked Accurate = Inaccurate radio so the expected-tool field
// becomes visible before the picker opens.
function clickToolInvokedInaccurate() {
  let radio = document.getElementById('ta-inaccurate');
  if (!radio) radio = document.querySelector('input[name="tool-accurate"][value="Inaccurate"]');
  if (radio) {
    radio.click();
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
// ── End Static Response Type helpers ─────────────────────────────────────

function isToolInvokedInaccurate(radio) {
  if (!radio || radio.type !== 'radio') return false;
  const val = (radio.value || '').trim().toLowerCase();
  if (val !== 'inaccurate') return false;
  const name = (radio.name || '').toLowerCase();
  const id = (radio.id || '').toLowerCase();
  if (name === 'tool-accurate' || name === 'tool_accurate' || name === 'toolaccurate') return true;
  if (name.includes('tool') && (name.includes('accur') || name.includes('invok'))) return true;
  if (id.startsWith('ta-')) return true;
  if (id.includes('tool') && (id.includes('accur') || id.includes('invok'))) return true;
  if (name.includes('response') || id.includes('response')) return false;
  if (name.includes('conv') || id.includes('conv')) return false;
  if (name.includes('context') || id.includes('context')) return false;
  if (name.includes('interaction') || id.includes('interaction')) return false;
  let parent = radio.parentElement;
  for (let i = 0; i < 15; i++) {
    if (!parent) break;
    const tag = parent.tagName;
    if (tag === 'BODY' || tag === 'HTML') break;
    const fullText = parent.textContent.toLowerCase();
    if (fullText.includes('tool invoked') && fullText.length < 800) return true;
    parent = parent.parentElement;
  }
  if (radio.id) {
    try {
      const lbl = document.querySelector('label[for="' + CSS.escape(radio.id) + '"]');
      if (lbl) {
        let p = lbl.parentElement;
        for (let i = 0; i < 10; i++) {
          if (!p) break;
          if (p.textContent.toLowerCase().includes('tool invoked') && p.textContent.length < 800) return true;
          p = p.parentElement;
        }
      }
    } catch(e) {}
  }
  try {
    let el = radio;
    for (let i = 0; i < 8; i++) {
      if (!el || !el.parentElement) break;
      const siblings = Array.from(el.parentElement.children);
      for (const sib of siblings) {
        const t = sib.textContent.toLowerCase().trim();
        if (t.length > 200) continue;
        if (t.includes('tool invoked')) return true;
        if (t.includes('response accuracy') || t.includes('response accurate')) return false;
        if (t.includes('context switch') || t.includes('conversation context')) return false;
        if (t.includes('interaction type') || t.includes('interaction accuracy')) return false;
      }
      el = el.parentElement;
    }
  } catch(e) {}
  return false;
}

function extractRadio(target) {
  if (!target) return null;
  if (target.type === 'radio') return target;
  if (target.tagName === 'LABEL') {
    if (target.htmlFor) { const r = document.getElementById(target.htmlFor); if (r) return r; }
    const inner = target.querySelector('input[type="radio"]'); if (inner) return inner;
  }
  const parentLabel = target.closest('label');
  if (parentLabel) {
    if (parentLabel.htmlFor) { const r = document.getElementById(parentLabel.htmlFor); if (r) return r; }
    const inner = parentLabel.querySelector('input[type="radio"]'); if (inner) return inner;
  }
  const radioDiv = target.closest('.radio-option, .radio-group, [class*="radio"], [class*="Radio"]');
  if (radioDiv) { const r = radioDiv.querySelector('input[type="radio"]'); if (r) return r; }
  return null;
}

function isToolInvokedTarget(target) {
  const radio = extractRadio(target);
  return radio ? isToolInvokedInaccurate(radio) : false;
}

function getDetectedHVA() {
  const selects = document.querySelectorAll('select');
  for (const sel of selects) {
    const nameOrId = (sel.name || sel.id || '').toLowerCase();
    const val = (sel.value || sel.options[sel.selectedIndex]?.text || '').toLowerCase();
    if (!val || val.startsWith('select')) continue;
    if (!nameOrId.includes('hva') && !nameOrId.includes('category')) continue;
    for (const entry of HVA_KEYWORD_MAP) {
      if (entry.keywords.some(kw => val.includes(kw))) return entry.category;
    }
  }
  return null;
}

function findExpectedToolField() {
  const attrSelectors = [
    '[name="expected_tool_invocation"]','[name="expected-tool-invocation"]','[name="expectedToolInvocation"]',
    '[name="expected_tool"]','[name="expected-tool"]','[name="tool_invocation"]','[name="tool-invocation"]',
    '[id="expected_tool_invocation"]','[id="expected-tool-invocation"]','[id="expectedToolInvocation"]',
    '[id="expected_tool"]','[id="expected-tool"]','[id="tool_invocation"]','[id="tool-invocation"]',
    '[name*="expected_tool" i]','[name*="expected-tool" i]','[id*="expected_tool" i]','[id*="expected-tool" i]',
    '[name*="tool_invoc" i]','[id*="tool_invoc" i]',
  ];
  for (const sel of attrSelectors) {
    try { const el = document.querySelector(sel); if (el && el.offsetParent !== null) { console.log('[TI Filler] Found via:', sel); return el; } } catch(e) {}
  }
  const placeholderSelectors = [
    'textarea[placeholder*="expected tool" i]','input[placeholder*="expected tool" i]',
    'textarea[placeholder*="tool invoc" i]','input[placeholder*="tool invoc" i]',
    'textarea[placeholder*="tool should" i]','input[placeholder*="tool should" i]',
  ];
  for (const sel of placeholderSelectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) { console.log('[TI Filler] Found via placeholder:', sel); return el; }
  }
  const labelKeywords = ['expected tool invocation','expected tool','expected_tool','tool invocation','tool should have','correct tool'];
  const allEls = document.querySelectorAll('label, span, p, div, h3, h4, h5, h6, legend, th, td');
  for (const el of allEls) {
    const text = el.textContent.trim().toLowerCase();
    if (text.length > 100) continue;
    if (labelKeywords.some(kw => text.includes(kw))) {
      let parent = el.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!parent) break;
        const field = parent.querySelector('textarea, input[type="text"], input:not([type])');
        if (field && field.offsetParent !== null) { console.log('[TI Filler] Found via label:', text); return field; }
        parent = parent.parentElement;
      }
    }
  }
  console.warn('[TI Filler] Field not found. Visible fields:');
  document.querySelectorAll('textarea, input[type="text"]').forEach(f => {
    if (f.offsetParent !== null) console.warn(' ->', f.tagName, '| name:', f.name||'(none)', '| id:', f.id||'(none)', '| placeholder:', f.placeholder||'(none)');
  });
  return null;
}

function getVisibleFieldsDebugText() {
  const fields = [];
  document.querySelectorAll('textarea, input[type="text"], input:not([type])').forEach(f => {
    if (f.offsetParent !== null)
      fields.push('tag: ' + f.tagName.toLowerCase() + ' | name: "' + (f.name||'') + '" | id: "' + (f.id||'') + '" | placeholder: "' + (f.placeholder||'') + '"');
  });
  return fields.length ? fields.join('\n') : 'No visible text fields found on page';
}

function renderStep1() {
  const detectedHVA = getDetectedHVA();
  const hvaNote = detectedHVA
    ? '<div class="ti-hva-detected">HVA Detected: <strong>' + escapeHtml(detectedHVA) + '</strong> - relevant tools highlighted in Step 2</div>'
    : '';
  picker.innerHTML =
    '<div class="ti-header"><h3>Tool Invoked - Inaccurate</h3><div class="ti-step-label">Step 1 - What happened?</div></div>' +
    '<div class="ti-body">' +
    hvaNote +
    '<div class="ti-opt-row"><button class="ti-opt" id="ti-wrong-tool-btn">Expected tool was not invoked<br/><small style="font-weight:normal;color:inherit;opacity:0.8;">Fills: [expected tool name]</small></button></div>' +
    '<div class="ti-opt-row"><button class="ti-opt ti-opt-kb" id="ti-kb-tool-btn">No tool - KB query (bot gave KB info)<br/><small style="font-weight:normal;color:inherit;opacity:0.8;">Fills: search_amazon_business_knowledge_base</small></button></div>' +
    '<div class="ti-section-label">Troubleshoot</div>' +
    '<div class="ti-opt-row"><button class="ti-opt ti-opt-debug" id="ti-debug-btn">Show all fields on this page<br/><small style="font-weight:normal;color:inherit;opacity:0.8;">Use this if filling is not working</small></button></div>' +
    '<button class="ti-cancel">Cancel</button>' +
    '</div>';
  picker.querySelector('#ti-wrong-tool-btn').addEventListener('click', () => renderStep2(detectedHVA));
  picker.querySelector('#ti-kb-tool-btn').addEventListener('click', () => {
    const field = findExpectedToolField(); hidePicker();
    setTimeout(() => {
      if (field) { smartFill(field, 'search_amazon_business_knowledge_base'); showToast('Filled: search_amazon_business_knowledge_base'); }
      else showToast('Field not found - click Show all fields to debug');
    }, 400);
  });

  picker.querySelector('#ti-debug-btn').addEventListener('click', renderDebugStep);
  picker.querySelector('.ti-cancel').addEventListener('click', hidePicker);
}

function renderDebugStep() {
  const debugText = getVisibleFieldsDebugText();
  picker.innerHTML =
    '<div class="ti-header"><h3>Field Debug Info</h3><div class="ti-step-label">All visible text fields on this page</div></div>' +
    '<div class="ti-body">' +
    '<div style="font-size:12px;color:#555;margin-bottom:8px;">Copy everything below and share it.</div>' +
    '<div class="ti-debug-box">' + escapeHtml(debugText) + '</div>' +
    '<div class="ti-opt-row" style="margin-top:8px;"><button class="ti-opt" id="ti-copy-debug-btn" style="border-left-color:#7c3aed;">Copy to Clipboard</button></div>' +
    '<button class="ti-back">Back</button><button class="ti-cancel">Cancel</button>' +
    '</div>';
  picker.querySelector('#ti-copy-debug-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(debugText).then(() => showToast('Copied! Paste this in chat.')).catch(() => showToast('Could not copy - select text manually'));
  });
  picker.querySelector('.ti-back').addEventListener('click', renderStep1);
  picker.querySelector('.ti-cancel').addEventListener('click', hidePicker);
}

function renderStep2(detectedHVA) {
  const matchedTools = (detectedHVA && TOOL_MAP[detectedHVA]) ? TOOL_MAP[detectedHVA] : [];
  const remainingTools = ALL_TOOLS.filter(t => !matchedTools.includes(t));
  let html =
    '<div class="ti-header"><h3>Expected Tool</h3><div class="ti-step-label">Step 2 - Select the tool that should have been called</div></div>' +
    '<div class="ti-body"><input type="text" class="ti-search" placeholder="Search tool name..." />';
  if (matchedTools.length > 0) {
    html += '<div class="ti-section-label">Likely for ' + escapeHtml(detectedHVA) + '</div>';
    matchedTools.forEach(tool => {
      const desc = TOOL_DESCRIPTIONS[tool] || '';
      html += '<div class="ti-opt-row" data-search="' + escapeHtml((tool+' '+desc).toLowerCase()) + '">' +
        '<button class="ti-opt ti-opt-tool-match ti-tool-btn" data-tool="' + escapeHtml(tool) + '">' + escapeHtml(tool) +
        (desc ? '<br/><small style="font-weight:normal;font-family:Arial;font-size:11px;opacity:0.8;">' + escapeHtml(desc) + '</small>' : '') +
        '</button></div>';
    });
  }
  html += '<div class="ti-section-label">' + (matchedTools.length > 0 ? 'All Other Tools' : 'All Tools') + '</div>';
  remainingTools.forEach(tool => {
    const desc = TOOL_DESCRIPTIONS[tool] || '';
    html += '<div class="ti-opt-row" data-search="' + escapeHtml((tool+' '+desc).toLowerCase()) + '">' +
      '<button class="ti-opt ti-opt-tool ti-tool-btn" data-tool="' + escapeHtml(tool) + '">' +
      escapeHtml(tool) +
      (desc ? '<br/><small style="font-weight:normal;font-family:Arial;font-size:11px;opacity:0.8;">' + escapeHtml(desc) + '</small>' : '') +
      '</button></div>';
  });
  const savedCustomTools = getCustomTools();
  html += '<div class="ti-section-label">Custom Tool</div>' +
    '<div style="padding:0 0 6px;">' +
    '<input type="text" id="ti-custom-tool-input" class="ti-search" placeholder="Type any tool name..." style="margin-bottom:6px;" />' +
    '<div style="display:flex;gap:8px;">' +
    '<button id="ti-custom-fill-btn" style="flex:1;padding:9px 14px;background:#FF9900;color:#131921;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Fill Now</button>' +
    '<button id="ti-custom-save-btn" style="flex:1;padding:9px 14px;background:#131921;color:#FF9900;border:1.5px solid #FF9900;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Save &amp; Fill</button>' +
    '</div></div>';
  if (savedCustomTools.length > 0) {
    html += '<div class="ti-section-label">Saved Custom Tools</div>';
    savedCustomTools.forEach(tool => {
      html += '<div class="ti-opt-row" data-search="' + escapeHtml(tool.toLowerCase()) + '">' +
        '<button class="ti-opt ti-opt-tool ti-tool-btn" data-tool="' + escapeHtml(tool) + '">' + escapeHtml(tool) + '</button>' +
        '<button class="ti-del-custom-btn" data-del="' + escapeHtml(tool) + '" style="padding:7px 10px;background:#cc0000;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;flex-shrink:0;">X</button>' +
        '</div>';
    });
  }
  html += '<button class="ti-back">Back</button><button class="ti-cancel">Cancel</button></div>';
  picker.innerHTML = html;
  const searchBox = picker.querySelector('.ti-search');
  if (searchBox) {
    searchBox.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      picker.querySelectorAll('.ti-opt-row').forEach(row => row.classList.toggle('ti-hide', !row.dataset.search.includes(q)));
    });
  }
  picker.querySelectorAll('.ti-tool-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const tool = this.dataset.tool;
      const field = findExpectedToolField(); hidePicker();
      setTimeout(() => {
        if (field) { smartFill(field, tool); showToast('Expected Tool Invocation filled!'); }
        else showToast('Field not found - use Show all fields to debug');
      }, 400);
    });
  });
  const customInput = picker.querySelector('#ti-custom-tool-input');
  const fillNowBtn = picker.querySelector('#ti-custom-fill-btn');
  const saveBtn = picker.querySelector('#ti-custom-save-btn');
  function fillCustom(save) {
    const val = customInput ? customInput.value.trim() : '';
    if (!val) { showToast('Please type a tool name first!'); return; }
    if (save) { const existing = getCustomTools(); if (!existing.includes(val)) { existing.push(val); saveCustomTools(existing); } }
    const field = findExpectedToolField(); hidePicker();
    setTimeout(() => {
      if (field) { smartFill(field, val); showToast(save ? 'Saved & filled!' : 'Expected Tool Invocation filled!'); }
      else showToast('Field not found - use Show all fields to debug');
    }, 400);
  }
  if (fillNowBtn) fillNowBtn.addEventListener('click', () => fillCustom(false));
  if (saveBtn) saveBtn.addEventListener('click', () => fillCustom(true));
  if (customInput) {
    customInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fillCustom(false); } });
    setTimeout(() => customInput.focus(), 100);
  }
  picker.querySelectorAll('.ti-del-custom-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      saveCustomTools(getCustomTools().filter(t => t !== this.dataset.del));
      showToast('Deleted custom tool'); renderStep2(detectedHVA);
    });
  });
  picker.querySelector('.ti-back').addEventListener('click', renderStep1);
  picker.querySelector('.ti-cancel').addEventListener('click', hidePicker);
}

let lastTriggerTime = 0;
const DEBOUNCE_MS = 2500;

function tryOpen() {
  const now = Date.now();
  if (now - lastTriggerTime < DEBOUNCE_MS) return;
  if (pickerBusy) return;
  lastTriggerTime = now;
  badge.textContent = 'Inaccurate - opening...';
  setTimeout(() => { badge.textContent = 'TI Filler Active'; }, 3000);
  setTimeout(() => showPicker(), 350);
}

document.addEventListener('click', function (e) {
  if (pickerBusy) return; if (picker.contains(e.target)) return;
  if (isToolInvokedTarget(e.target)) tryOpen();
}, true);

document.addEventListener('change', function (e) {
  if (pickerBusy) return; if (picker.contains(e.target)) return;
  const t = e.target;

  // Existing trigger: Tool Invoked radio set to Inaccurate
  if (t.type === 'radio' && t.checked && isToolInvokedTarget(t)) tryOpen();

  // New trigger: Static Response Type = N/A + no tool in chat.
  // Sets Tool Invoked = Inaccurate automatically, then opens the picker.
  if (isStaticResponseTypeSelect(t) && selectedOptionIsNA(t)) {
    setTimeout(() => {
      if (pickerBusy || isToolInvokedInChat()) return;
      clickToolInvokedInaccurate();
      tryOpen();
    }, 50);
  }

}, true);

function smartFill(field, value) {
  field.focus(); field.click();
  setTimeout(() => {
    const proto = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value').set;
    nativeSet.call(field, '');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      nativeSet.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(() => { field.dispatchEvent(new Event('blur', { bubbles: true })); }, 200);
    }, 100);
  }, 100);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'ti-toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2500);
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'T') { e.preventDefault(); showPicker(); }
  if (e.key === 'Escape') hidePicker();
});

console.log('[Tool Invoked Clippings v1.7.0] Loaded');

})();
