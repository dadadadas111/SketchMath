/* SketchMath v2 — Frontend Logic */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────
  let lang = 'vi';
  let strings = {};
  let theme = 'dark';
  let ggbReady = false;
  let busy = false;
  let history = [];
  let lastCommands = [];

  // ─── DOM refs ────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $messages = $('#chat-messages');
  const $input = $('#input-prompt');
  const $btnSend = $('#btn-send');
  const $btnClear = $('#btn-clear');
  const $btnRerender = $('#btn-rerender');
  const $btnExport = $('#btn-export');
  const $btnLang = $('#btn-lang');
  const $btnTheme = $('#btn-theme');
  const $cbContinue = $('#cb-continue');
  const $statusText = $('#status-text');
  const $statusObjects = $('#status-objects');
  const $ggbLoading = $('#ggb-loading');

  // ─── i18n ────────────────────────────────────────────────────────────
  async function loadStrings() {
    try {
      const res = await fetch('lang.json');
      strings = await res.json();
    } catch {
      strings = {};
    }
  }

  function t(key, replacements) {
    let s = (strings[lang] && strings[lang][key]) || key;
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        s = s.replace('{' + k + '}', v);
      }
    }
    return s;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    $btnLang.textContent = lang.toUpperCase();
  }

  // ─── Theme ───────────────────────────────────────────────────────────
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    $btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ─── GeoGebra Setup ─────────────────────────────────────────────────
  function initGeoGebra() {
    var params = {
      appName: 'geometry',
      width: 800,
      height: 600,
      showToolBar: false,
      showAlgebraInput: false,
      showMenuBar: false,
      showResetIcon: false,
      enableLabelDrags: true,
      enableShiftDragZoom: true,
      enableRightClick: false,
      useBrowserForJS: true,
      language: lang === 'vi' ? 'vi' : 'en',
      appletOnLoad: function (api) {
        window.ggbApplet = api || window.ggbApplet;
        ggbReady = true;
        $ggbLoading.classList.add('hidden');
        setStatus(t('ggbReady'));
      }
    };

    var applet = new GGBApplet(params, '5.0');
    applet.inject('ggb-element');
  }

  // ─── Chat UI ─────────────────────────────────────────────────────────
  function addMessage(type, content, commands) {
    var div = document.createElement('div');
    div.className = 'message ' + type;

    if (type === 'assistant' && commands && commands.length > 0) {
      var label = document.createElement('div');
      label.className = 'msg-label';
      label.textContent = 'AI';
      div.appendChild(label);

      var text = document.createElement('p');
      text.textContent = content;
      div.appendChild(text);

      var cmdBlock = document.createElement('div');
      cmdBlock.className = 'msg-commands';
      cmdBlock.textContent = commands.join('\n');
      div.appendChild(cmdBlock);
    } else {
      var p = document.createElement('p');
      p.textContent = content;
      div.appendChild(p);
    }

    $messages.appendChild(div);
    $messages.scrollTop = $messages.scrollHeight;
    return div;
  }

  function addThinking() {
    var div = document.createElement('div');
    div.className = 'message status';
    div.id = 'thinking-msg';
    div.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span> ' + t('thinking');
    $messages.appendChild(div);
    $messages.scrollTop = $messages.scrollHeight;
    return div;
  }

  function removeThinking() {
    var el = $('#thinking-msg');
    if (el) el.remove();
  }

  function setStatus(text) {
    $statusText.textContent = text;
  }

  function updateObjectCount() {
    if (!ggbReady) return;
    try {
      var state = ConstructionCompiler.getConstructionState(ggbApplet);
      $statusObjects.textContent = t('objects', { n: state.objects.length });
    } catch {
      $statusObjects.textContent = '';
    }
  }

  // ─── AI Communication ────────────────────────────────────────────────
  async function callAI(prompt, conversationHistory) {
    var response = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, history: conversationHistory })
    });

    if (!response.ok) {
      var errData = await response.json().catch(function () { return {}; });
      throw new Error(errData.error || 'HTTP ' + response.status);
    }

    return await response.json();
  }

  // ─── Construction Execution ──────────────────────────────────────────
  function executeConstruction(commands) {
    if (!ggbReady) throw new Error('GeoGebra not ready');

    // Validate first
    var validation = ConstructionCompiler.validate(commands);
    if (!validation.valid) {
      return { success: false, error: 'Validation failed: ' + validation.errors.join('; '), executed: 0, failed: commands.length };
    }

    // If not in continue mode, clear first
    if (!$cbContinue.checked) {
      ConstructionCompiler.reset(ggbApplet);
    }

    // Execute
    var result = ConstructionCompiler.execute(ggbApplet, validation.cleanedCommands);

    // Style
    ConstructionCompiler.styleConstruction(ggbApplet);

    // Verify
    var verify = ConstructionCompiler.verifyConstraints(ggbApplet, validation.cleanedCommands);

    updateObjectCount();

    return {
      success: result.success,
      executed: result.executed,
      failed: result.failed,
      errors: result.errors,
      verifyIssues: verify.issues
    };
  }

  // ─── Main Send Flow ──────────────────────────────────────────────────
  async function handleSend() {
    var prompt = $input.value.trim();
    if (!prompt || busy) return;

    busy = true;
    $btnSend.disabled = true;
    $input.value = '';

    // Show user message
    addMessage('user', prompt);

    // Build conversation history for continue mode
    var conversationHistory = $cbContinue.checked ? history.slice() : [];

    // Update history
    history.push({ role: 'user', content: prompt });

    var maxRetries = 3;
    var attempt = 0;
    var lastError = null;

    while (attempt < maxRetries) {
      attempt++;

      // Show thinking
      var thinkingEl = addThinking();
      if (attempt > 1) {
        setStatus(t('retrying', { n: attempt }));
      } else {
        setStatus(t('thinking'));
      }

      try {
        // Build prompt with error feedback for retries
        var aiPrompt = prompt;
        if (lastError && attempt > 1) {
          aiPrompt = prompt + '\n\n[SYSTEM: Previous attempt failed with error: ' + lastError + '. Please fix the construction and try again. Make sure all GeoGebra commands are valid.]';
        }

        // Call AI
        var aiResult = await callAI(aiPrompt, conversationHistory);
        removeThinking();

        if (!aiResult.commands || aiResult.commands.length === 0) {
          addMessage('error', t('noCommands'));
          setStatus(t('error'));
          break;
        }

        // Show explanation
        setStatus(t('drawing'));
        addMessage('assistant', aiResult.explanation || '', aiResult.commands);

        // Execute construction
        var execResult = executeConstruction(aiResult.commands);

        if (execResult.success) {
          // Save commands for rerender
          lastCommands = aiResult.commands;

          // Update history with AI response
          history.push({ role: 'assistant', content: JSON.stringify({ explanation: aiResult.explanation, commands: aiResult.commands }) });

          // Report success
          var statusMsg = t('constructionOk', { n: execResult.executed });
          if (execResult.verifyIssues && execResult.verifyIssues.length > 0) {
            statusMsg += ' — ' + t('verifyFailed', { issues: execResult.verifyIssues.join(', ') });
          }
          setStatus(statusMsg);
          break;

        } else {
          // Partial failure — retry
          var errorSummary = execResult.errors.map(function (e) { return e.command + ': ' + e.error; }).join('; ');
          lastError = errorSummary || 'Construction failed';

          if (attempt >= maxRetries) {
            addMessage('error', t('retryFailed'));
            setStatus(t('retryFailed'));
          }
        }

      } catch (err) {
        removeThinking();
        lastError = err.message;

        if (attempt >= maxRetries) {
          addMessage('error', t('networkError') + ' ' + err.message);
          setStatus(t('error'));
        }
      }
    }

    busy = false;
    $btnSend.disabled = false;
    $input.focus();
  }

  // ─── Toolbar Actions ─────────────────────────────────────────────────
  function handleClear() {
    if (!ggbReady) return;
    ConstructionCompiler.reset(ggbApplet);
    history = [];
    lastCommands = [];
    updateObjectCount();
    setStatus(t('cleared'));
  }

  function handleRerender() {
    if (!ggbReady || lastCommands.length === 0) return;
    ConstructionCompiler.reset(ggbApplet);
    var result = ConstructionCompiler.execute(ggbApplet, lastCommands);
    ConstructionCompiler.styleConstruction(ggbApplet);
    updateObjectCount();
    setStatus(t('rerendered'));
  }

  function handleExport() {
    if (!ggbReady) return;
    try {
      var base64 = ggbApplet.getPNGBase64(1, true, 72);
      var link = document.createElement('a');
      link.download = 'sketchmath-' + Date.now() + '.png';
      link.href = 'data:image/png;base64,' + base64;
      link.click();
      setStatus(t('exported'));
    } catch {
      setStatus(t('exportFail'));
    }
  }

  function toggleLang() {
    lang = lang === 'vi' ? 'en' : 'vi';
    localStorage.setItem('sm-lang', lang);
    applyI18n();
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('sm-theme', theme);
    applyTheme();
  }

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────
  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement === $input) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────
  async function init() {
    // Load saved preferences
    lang = localStorage.getItem('sm-lang') || 'vi';
    theme = localStorage.getItem('sm-theme') || 'dark';

    await loadStrings();
    applyI18n();
    applyTheme();

    // Bind events
    $btnSend.addEventListener('click', handleSend);
    $btnClear.addEventListener('click', handleClear);
    $btnRerender.addEventListener('click', handleRerender);
    $btnExport.addEventListener('click', handleExport);
    $btnLang.addEventListener('click', toggleLang);
    $btnTheme.addEventListener('click', toggleTheme);
    document.addEventListener('keydown', handleKeydown);

    // Init GeoGebra
    initGeoGebra();
  }

  // Start
  init();
})();
