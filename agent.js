/* LLM Agent — Browser Multi-Tool with Research Mode
   - Providers: OpenAI, Groq, Google Gemini, Anthropic
   - Tools: web_search, groq_proxy, js_exec, search_academic, summarize, compare, generate_report
   - UI: Chat tab + Research tab
*/

"use strict";

// -------- DOM helpers --------
const $ = (sel) => document.querySelector(sel);
const chatEl         = $('#chat');
const researchChatEl = $('#researchChat');
const alertsEl       = $('#alerts');
const codeCard       = $('#codeCard');
const codeOutput     = $('#codeOutput');
const statusEl       = $('#status');
const sendBtn        = $('#send');
const researchBtn    = $('#researchSend');
const clearBtn       = $('#clear');
const exportBtn      = $('#export');
const researchInput  = $('#researchInput');

const state = { messages: [], running: false, mode: "chat", report: null };

// -------- UI helpers --------
function addAlert(type, msg) {
  const el = document.createElement('div');
  el.className = `alert alert-${type} alert-dismissible fade show`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `${msg}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
  alertsEl.appendChild(el);
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setBusy(b) {
  state.running = !!b;
  if (b) statusEl.classList.remove('d-none'); else statusEl.classList.add('d-none');
  sendBtn.disabled = !!b; clearBtn.disabled = !!b; exportBtn.disabled = !!b; researchBtn.disabled = !!b;
}

// Colorful chat bubbles with avatars (system/tool hidden)
function addMessage(role, content, target="chat") {
  if (role === 'tool' || role === 'system') return;

  const row = document.createElement('div');
  row.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerHTML = (role === 'user')
    ? '<i class="bi bi-person-fill"></i>'
    : '<i class="bi bi-robot"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (role === 'assistant') {
    // Render Markdown safely
    bubble.innerHTML = marked.parse(content || "");
  } else {
    bubble.innerHTML = (typeof content === 'string')
      ? escapeHtml(content)
      : `<pre>${escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
  }

  if (role === 'user') { row.appendChild(bubble); row.appendChild(avatar); }
  else { row.appendChild(avatar); row.appendChild(bubble); }

  const container = (target === "research") ? researchChatEl : chatEl;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

// -------- Settings --------
function getSettings() {
  return {
    provider:  $('#provider').value,
    apiKey:    $('#apiKey').value.trim(),
    model:     $('#model').value,
    maxTokens: parseInt($('#maxTokens').value || '800', 10),
    googleKey: $('#googleKey')?.value.trim(),
    googleCx:  $('#googleCx')?.value.trim()
  };
}

function validateApiKeyOrWarn(provider, key) {
  const trimmed = (key || '').trim();
  if (!trimmed) {
    addAlert('warning', 'Missing API key/token for ' + provider + '.');
    return false;
  }
  if (provider === 'openai' && !/^sk-[A-Za-z0-9]/.test(trimmed)) {
    addAlert('warning', 'That does not look like an OpenAI key (should start with "sk-").');
    return false;
  }
  return true;
}

// -------- Tool schema --------
const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for snippets using DuckDuckGo.",
      parameters: {
        type: "object",
        properties: {
          q:   { type: "string",  description: "Search query" },
          num: { type: "integer", description: "Number of results", default: 3, minimum: 1, maximum: 10 }
        },
        required: ["q"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "groq_proxy",
      description: "Call Groq API with a short prompt and return completion.",
      parameters: {
        type: "object",
        properties: {
          prompt:     { type: "string" },
          model:      { type: "string", description: "Groq model name", default: "mixtral-8x7b-32768" },
          max_tokens: { type: "integer", default: 200 }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "js_exec",
      description: "Securely execute JavaScript code in a sandboxed Worker; return logs & result.",
      parameters: {
        type: "object",
        properties: { code: { type: "string", description: "JavaScript code to run" } },
        required: ["code"]
      }
    }
  },
  // Research Mode tools
  {
    type: "function",
    function: {
      name: "search_academic",
      description: "Search academic sources via Semantic Scholar API.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          num_results: { type: "integer", default: 5 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "summarize",
      description: "Summarize a text (short TL;DR or detailed deep dive).",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          mode: { type: "string", enum: ["short", "detailed"] },
          max_tokens: { type: "integer", default: 400 }
        },
        required: ["text","mode"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare",
      description: "Compare multiple summaries and extract consensus/conflicts.",
      parameters: {
        type: "object",
        properties: {
          summaries: { type: "array", items: { type: "object" } },
          focus: { type: "string" }
        },
        required: ["summaries"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "Generate structured research report (Markdown, HTML, PDF).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          summaries: { type: "array", items: { type: "object" } },
          comparison: { type: "object" },
          format: { type: "string", enum: ["md","html","pdf"] }
        },
        required: ["query","summaries","comparison","format"]
      }
    }
  }
];

// -------- Model options --------
const MODEL_OPTIONS = {
  openai: [
    { value: "gpt-4o-mini",  label: "gpt-4o-mini (default)" },
    { value: "gpt-4o",       label: "gpt-4o" },
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    { value: "gpt-4.1",      label: "gpt-4.1" }
  ],
  groq: [
    { value: "mixtral-8x7b-32768", label: "mixtral-8x7b-32768 (default)" },
    { value: "llama2-70b-4096",    label: "llama2-70b-4096" },
    { value: "gemma-7b-it",        label: "gemma-7b-it" }
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "claude-3-5-sonnet-latest (default)" },
    { value: "claude-3-opus-latest",     label: "claude-3-opus-latest" },
    { value: "claude-3-haiku-latest",    label: "claude-3-haiku-latest" }
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash (default)" },
    { value: "gemini-2.0-flash", label: "gemini-2.0-flash" },
    { value: "gemini-1.5-pro",   label: "gemini-1.5-pro" }
  ]
};

function populateModelOptions() {
  const provider = $('#provider').value || 'openai';
  const sel = $('#model');
  sel.innerHTML = '';
  const opts = MODEL_OPTIONS[provider] || MODEL_OPTIONS.openai;
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label; sel.appendChild(opt);
  }
}

// -------- Sanitizer --------
function sanitizeMessagesForOpenAI(messages) {
  return messages.map((m) => {
    const out = { role: m.role };
    const asString = (v) => (typeof v === 'string' ? v : (v == null ? '' : JSON.stringify(v)));
    if (m.role === 'assistant') {
      const tc = Array.isArray(m.tool_calls) ? m.tool_calls.filter(Boolean) : [];
      if (tc.length > 0) {
        out.tool_calls = tc.map((t) => ({
          id: t.id,
          type: 'function',
          function: {
            name: t.function?.name,
            arguments: typeof t.function?.arguments === 'string'
              ? t.function.arguments
              : JSON.stringify(t.function?.arguments || {})
          }
        }));
        const c = (m.content ?? '').toString().trim();
        out.content = c.length ? c : null;
      } else {
        out.content = asString(m.content ?? '');
      }
    } else if (m.role === 'tool') {
      out.tool_call_id = m.tool_call_id;
      if (m.name) out.name = m.name;
      out.content = asString(m.content ?? '');
    } else {
      out.content = asString(m.content ?? '');
      if (m.name) out.name = m.name;
    }
    return out;
  });
}

// -------- Agent loop --------
async function agentLoop() {
  if (state.running) return;
  setBusy(true);

  try {
    let turns = 0;
    while (turns++ < 8) {
      const resp = await callLLM(state.messages, tools);
      if (!resp) break;

      const msg = getAssistantMessage(resp);
      const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls.filter(Boolean) : [];
      const assistantMsg = { role: 'assistant', content: msg?.content || '' };
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      state.messages.push(assistantMsg);

      if (msg?.content) {
        const target = state.mode === "research" ? "research" : "chat";
        addMessage('assistant', escapeHtml(msg.content), target);
      }

      if (toolCalls.length === 0) break;

      for (const tc of toolCalls) {
        let args = {};
        try {
          args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function.arguments || {});
        } catch {}

        const result = await executeTool(tc.function.name, args).catch(e => ({ error: String(e) }));

        state.messages.push({
          role: 'tool',
          tool_call_id: tc.id || undefined,
          name: tc.function.name,
          content: JSON.stringify(result)
        });
      }
    }
  } catch (err) {
    addAlert('danger', 'Agent loop error: ' + escapeHtml(err?.message || String(err)));
  } finally {
    setBusy(false);
  }
}

// -------- LLM dispatcher --------
async function callLLM(messages, tools) {
  const settings = getSettings();
  const provider = settings.provider;

  if (!validateApiKeyOrWarn(provider, settings.apiKey)) return null;

  if (provider === 'openai')   return await callOpenAI(messages, tools, settings);
  if (provider === 'groq')     return await callGroq(messages, tools, settings);
  if (provider === 'gemini')   return await callGemini(messages, tools, settings);
  if (provider === 'anthropic')return await callAnthropic(messages, tools, settings);

  addAlert('danger', 'Unknown provider: ' + provider);
  return null;
}

// -------- Provider calls --------
async function callOpenAI(messages, tools, settings) {
  const body = {
    model: settings.model || "gpt-4o-mini",
    messages: sanitizeMessagesForOpenAI(messages),
    max_tokens: settings.maxTokens,
    tools
  };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("OpenAI API error: " + r.status);
  return await r.json();
}

async function callGroq(messages, tools, settings) {
  const body = {
    model: settings.model || "mixtral-8x7b-32768",
    messages: sanitizeMessagesForOpenAI(messages),
    max_tokens: settings.maxTokens,
    tools
  };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("Groq API error: " + r.status);
  return await r.json();
}

async function callGemini(messages, tools, settings) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + 
              (settings.model || "gemini-1.5-pro") + ":generateContent?key=" + settings.apiKey;

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
  }));

  const body = { contents };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!r.ok) throw new Error("Gemini API error: " + r.status);
  const data = await r.json();

  return {
    choices: [{
      message: {
        role: "assistant",
        content: data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
      }
    }]
  };
}

async function callAnthropic(messages, tools, settings) {
  const url = "https://api.anthropic.com/v1/messages";

  const body = {
    model: settings.model || "claude-3-5-sonnet-latest",
    max_tokens: settings.maxTokens || 800,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    }))
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) throw new Error("Anthropic API error: " + r.status);
  const data = await r.json();

  return {
    choices: [{
      message: {
        role: "assistant",
        content: data?.content?.[0]?.text || ""
      }
    }]
  };
}

// -------- Extract assistant --------
function getAssistantMessage(data) {
  return (data?.choices?.length ? data.choices[0].message : null);
}

// -------- Tools --------
async function executeTool(name, args) {
  switch (name) {
    case 'web_search':       return await toolWebSearch(args);
    case 'groq_proxy':       return await toolGroqProxy(args);
    case 'js_exec':          return await toolJsExec(args);
    case 'search_academic':  return await toolSearchAcademic(args);
    case 'summarize':        return await toolSummarize(args);
    case 'compare':          return await toolCompare(args);
    case 'generate_report':  return await toolGenerateReport(args);
    default: return { error: 'Unknown tool: ' + name };
  }
}

// -------- Tool Implementations --------
async function toolWebSearch({ q, num=3 }) {
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`);
    const data = await r.json();
    return (data?.RelatedTopics || []).slice(0,num).map(t => ({
      title: t.Text, url: t.FirstURL
    }));
  } catch (e) { return { error: String(e) }; }
}

async function toolJsExec({ code }) {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([`
        self.onmessage = function(e) {
          try {
            const result = eval(e.data);
            self.postMessage({ result });
          } catch (err) {
            self.postMessage({ error: String(err) });
          }
        };
      `], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate();
      };
      worker.postMessage(code);
    } catch (err) { resolve({ error: String(err) }); }
  });
}

async function toolSearchAcademic({ query, num_results = 5 }) {
  try {
    const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${num_results}&fields=title,url,abstract,year`);
    return await res.json();
  } catch (e) { return { error: String(e) }; }
}

async function toolSummarize({ text, mode="short", max_tokens=400 }) {
  const settings = getSettings();
  return await callOpenAI(
    [{ role: "user", content: `Summarize this text in ${mode} form:\n\n${text}` }],
    [],
    settings
  );
}

async function toolCompare({ summaries, focus=null }) {
  const settings = getSettings();
  return await callOpenAI(
    [{ role: "user", content: `Compare these summaries and highlight consensus and conflicts.\nFocus: ${focus || "general"}\n\n${JSON.stringify(summaries)}` }],
    [],
    settings
  );
}

async function toolGenerateReport({ query, summaries, comparison, format="md" }) {
  const settings = getSettings();

  const messages = [{
    role: "user",
    content: `Generate a structured research report about "${query}". 
Summaries: ${JSON.stringify(summaries)} 
Comparison: ${JSON.stringify(comparison)} 
Format: ${format}`
  }];

  let result;
  if (settings.provider === "openai") {
    result = await callOpenAI(messages, [], settings);
  } else if (settings.provider === "gemini") {
    result = await callGemini(messages, [], settings);
  } else if (settings.provider === "groq") {
    result = await callGroq(messages, [], settings);
  } else if (settings.provider === "anthropic") {
    result = await callAnthropic(messages, [], settings);
  } else {
    throw new Error("Unsupported provider for report generation: " + settings.provider);
  }

  const content = result?.choices?.[0]?.message?.content || "";
  state.report = { content };

  const group = $('#downloadReportGroup');
  if (group) group.classList.remove('d-none');

  return { report: content };
}


async function toolGroqProxy({ prompt, model="mixtral-8x7b-32768", max_tokens=200 }) {
  const settings = getSettings();
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: [{ role:"user", content: prompt }]
      })
    });
    return await r.json();
  } catch (e) { return { error: String(e) }; }
}

// -------- Wire up UI --------
$('#send').addEventListener('click', onSend);
$('#clear').addEventListener('click', () => {
  if (state.running) return;
  state.messages = []; chatEl.innerHTML = ''; researchChatEl.innerHTML = ''; codeCard.classList.add('d-none');
});
$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.messages, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'conversation.json'; a.click();
  URL.revokeObjectURL(url);
});
$('#userInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
});
researchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onResearchSend(); }
});
researchBtn.addEventListener('click', onResearchSend);

// Theme toggle
const themeToggle = $('#themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    document.documentElement.setAttribute('data-bs-theme', themeToggle.checked ? 'dark' : 'light');
  });
}

// Init
window.addEventListener('DOMContentLoaded', () => { populateModelOptions(); });
$('#provider').addEventListener('change', () => { populateModelOptions(); });

// -------- onSend (Chat) --------
async function onSend() {
  if (state.running) return;
  const ta = $('#userInput');
  const text = ta.value.trim();
  if (!text) return;

  state.mode = "chat";

  // ✅ Add interactive tutor persona once
  if (!state.messages.some(m => m.role === "system" && m.mode === "chat")) {
    state.messages.unshift({
      role: "system",
      mode: "chat",
      content: "You are an interactive mentor. Always guide the user step by step, \
ask clarifying questions, and avoid dumping all information at once. \
Engage in back-and-forth conversation like a tutor."
    });
  }

  addMessage('user', escapeHtml(text), "chat");
  state.messages.push({ role: 'user', content: text });
  ta.value = '';

  await agentLoop();
}


// -------- onResearchSend --------

async function onResearchSend() {
  if (state.running) return;
  const text = researchInput.value.trim();
  if (!text) return;

  state.mode = "research";
  addMessage('user', escapeHtml(text), "research");
  state.messages.push({
    role: 'user',
    content: text,
    meta: { mode: 'research', depth: 'detailed', numSources: 5 }
  });
  researchInput.value = '';

  // Run the agent as before
  await agentLoop();

  // ✅ Always generate a report afterwards
  try {
    await toolGenerateReport({
      query: text,
      summaries: state.messages.filter(m => m.role === "assistant"), // only assistant outputs
      comparison: {},
      format: "md"
    });
  } catch (err) {
    addAlert("danger", "Report generation failed: " + escapeHtml(err?.message || String(err)));
  }
}


// -------- Report Download Handlers --------
$('#downloadReportMd')?.addEventListener('click', () => {
  if (!state.report) return;
  const blob = new Blob([state.report.content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = "research-report.md"; a.click();
  URL.revokeObjectURL(url);
});

$('#downloadReportPdf')?.addEventListener('click', () => {
  if (!state.report) return;
  if (typeof html2pdf === "undefined") {
    addAlert("danger", "PDF generation library not loaded.");
    return;
  }

  const element = document.createElement('div');
  element.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color:#000;">
      <h1 style="text-align:center; margin-bottom: 20px;">Research Report</h1>
      ${marked.parse(state.report.content)}
      <footer style="margin-top:40px; font-size: 12px; text-align:center; color:#666;">
        Generated by LLM Research Assistant
      </footer>
    </div>
  `;

  const opt = {
    margin:       [10, 10, 20, 10],
    filename:     "research-report.pdf",
    image:        { type: 'jpeg', quality: 1.0 },
    html2canvas:  { scale: 3, dpi: 300, letterRendering: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
});
