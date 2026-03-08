/* SketchMath v2 — Frontend Logic */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────
  let lang = 'vi';
  let strings = {};
  let theme = 'dark';
  let ggbReady = false;
  let busy = false;
  let lastCommands = [];
  let lastShowAxes = false;

  let sessions = [];
  let activeSessionId = null;

  const $ = (sel) => document.querySelector(sel);
  const $messages = $('#chat-messages');
  const $input = $('#input-prompt');
  const $btnSend = $('#btn-send');
  const $btnLang = $('#btn-lang');
  const $btnTheme = $('#btn-theme');
  const $statusText = $('#status-text');
  const $statusObjects = $('#status-objects');
  const $ggbLoading = $('#ggb-loading');
  const $ggbModal = $('#ggb-modal');
  const $ggbModalBody = $('#ggb-modal-body');
  const $btnCloseModal = $('#btn-close-modal');

  const $sidebar = $('#sidebar');
  const $sessionList = $('#session-list');
  const $btnNewChat = $('#btn-new-chat');
  const $btnSidebar = $('#btn-sidebar');
  const $sidebarOverlay = $('#sidebar-overlay');
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
      appName: 'classic',
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
        // Hide axes and grid for pure geometry
        if (api) {
          api.setAxesVisible(false, false);
          api.setGridVisible(false);
        } else if (window.ggbApplet) {
          window.ggbApplet.setAxesVisible(false, false);
          window.ggbApplet.setGridVisible(false);
        }
        $ggbLoading.classList.add('hidden');
        setStatus(t('ggbReady'));
      }
    };
    var applet = new GGBApplet(params, '5.0');
    applet.inject('ggb-element');
  }

  // ─── Session Management ──────────────────────────────────────────────
  function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  function generateTopic(message) {
    var trimmed = message.trim();
    if (trimmed.length <= 30) return trimmed;
    var truncated = trimmed.substring(0, 30);
    var lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 10) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated + '...';
  }

  function loadSessions() {
    try {
      var stored = localStorage.getItem('sm-sessions');
      if (stored) sessions = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
    if (!Array.isArray(sessions)) sessions = [];
    
    var activeId = localStorage.getItem('sm-active-session');
    if (sessions.length === 0) {
      createNewSession();
    } else {
      if (activeId && sessions.find(function(s) { return s.id === activeId; })) {
        activeSessionId = activeId;
      } else {
        activeSessionId = sessions[0].id;
      }
    }
  }

  function saveSessions() {
    localStorage.setItem('sm-sessions', JSON.stringify(sessions));
  }

  function saveActiveSessionId() {
    if (activeSessionId) {
      localStorage.setItem('sm-active-session', activeSessionId);
    }
  }

  function getActiveSession() {
    return sessions.find(function(s) { return s.id === activeSessionId; }) || sessions[0];
  }

  function createNewSession() {
    var session = {
      id: generateSessionId(),
      topic: t('newChat') || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    sessions.unshift(session);
    activeSessionId = session.id;
    saveSessions();
    saveActiveSessionId();
    renderSessionList();
    restoreChat(session);
    if (window.innerWidth <= 800) toggleSidebar(false);
  }

  function switchSession(id) {
    if (activeSessionId === id) return;
    activeSessionId = id;
    saveActiveSessionId();
    renderSessionList();
    restoreChat(getActiveSession());
    if (window.innerWidth <= 800) toggleSidebar(false);
  }

  function deleteSession(id, e) {
    if (e) e.stopPropagation();
    if (!confirm(t('deleteConfirm') || 'Delete this chat?')) return;
    
    sessions = sessions.filter(function(s) { return s.id !== id; });
    
    if (sessions.length === 0) {
      createNewSession();
    } else if (activeSessionId === id) {
      saveSessions();
      switchSession(sessions[0].id);
    } else {
      saveSessions();
      renderSessionList();
    }
  }

  function renderSessionList() {
    $sessionList.innerHTML = '';
    if (sessions.length === 0) {
      var empty = document.createElement('div');
      empty.style.padding = '16px';
      empty.style.color = 'var(--text-muted)';
      empty.style.fontSize = '12px';
      empty.style.textAlign = 'center';
      empty.textContent = t('noSessions') || 'No conversations yet';
      $sessionList.appendChild(empty);
      return;
    }

    sessions.forEach(function(session) {
      var item = document.createElement('div');
      item.className = 'session-item' + (session.id === activeSessionId ? ' active' : '');
      item.onclick = function() { switchSession(session.id); };

      var info = document.createElement('div');
      info.className = 'session-info';
      
      var topic = document.createElement('div');
      topic.className = 'session-topic';
      topic.textContent = session.topic;
      
      var date = document.createElement('div');
      date.className = 'session-date';
      var d = new Date(session.updatedAt);
      date.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      info.appendChild(topic);
      info.appendChild(date);
      item.appendChild(info);

      var btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete-session';
      btnDelete.innerHTML = '✕';
      btnDelete.title = t('deleteSession') || 'Delete';
      btnDelete.onclick = function(e) { deleteSession(session.id, e); };
      item.appendChild(btnDelete);

      $sessionList.appendChild(item);
    });
  }

  function restoreChat(session) {
    $messages.innerHTML = '';
    
    // Re-add welcome message
    var welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message system';
    var p = document.createElement('p');
    p.setAttribute('data-i18n', 'welcome');
    p.textContent = t('welcome');
    welcomeDiv.appendChild(p);
    $messages.appendChild(welcomeDiv);

    // Reset GeoGebra visually if no history
    if (session.messages.length === 0 && ggbReady) {
      ConstructionCompiler.reset(ggbApplet);
      updateObjectCount();
    }

    session.messages.forEach(function(msg) {
      addMessageDOM(msg.role, msg.content, msg.commands, msg.diagramBase64);
    });
    $messages.scrollTop = $messages.scrollHeight;
  }

  function addMessageToSession(role, content, commands, diagramBase64) {
    var session = getActiveSession();
    
    // Auto-generate topic on first user message
    if (role === 'user' && session.messages.filter(function(m) { return m.role === 'user'; }).length === 0) {
      session.topic = generateTopic(content);
    }

    session.messages.push({
      role: role,
      content: content,
      commands: commands,
      diagramBase64: diagramBase64,
      timestamp: Date.now()
    });
    session.updatedAt = Date.now();
    saveSessions();
    renderSessionList();
  }

  function toggleSidebar(force) {
    var isOpen = force !== undefined ? force : !$sidebar.classList.contains('open');
    if (isOpen) {
      $sidebar.classList.add('open');
      $sidebarOverlay.classList.add('open');
    } else {
      $sidebar.classList.remove('open');
      $sidebarOverlay.classList.remove('open');
    }
  }

  // ─── Chat UI ─────────────────────────────────────────────────────────
  function addMessage(role, content, commands, diagramBase64) {
    addMessageDOM(role, content, commands, diagramBase64);
    if (role !== 'status') {
      addMessageToSession(role, content, commands, diagramBase64);
    }
  }

  function addMessageDOM(type, content, commands, diagramBase64) {
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

      // === Tabbed container ===
      var tabsContainer = document.createElement('div');
      tabsContainer.className = 'msg-tabs';

      // Tab header
      var tabHeader = document.createElement('div');
      tabHeader.className = 'tab-header';

      var btnDiagramTab = document.createElement('button');
      btnDiagramTab.className = 'tab-btn active';
      btnDiagramTab.setAttribute('data-tab', 'diagram');
      btnDiagramTab.textContent = t('diagram') || 'Diagram';

      var btnCodeTab = document.createElement('button');
      btnCodeTab.className = 'tab-btn';
      btnCodeTab.setAttribute('data-tab', 'code');
      btnCodeTab.textContent = t('code') || 'Code';

      var btnCopyCode = document.createElement('button');
      btnCopyCode.className = 'btn-copy-code';
      btnCopyCode.innerHTML = '\ud83d\udccb ' + (t('copyCode') || 'Copy Code');
      var commandsText = commands.join('\n');
      btnCopyCode.onclick = function() {
        navigator.clipboard.writeText(commandsText).then(function() {
          btnCopyCode.innerHTML = '\u2705 ' + (t('copied') || 'Copied!');
          setTimeout(function() {
            btnCopyCode.innerHTML = '\ud83d\udccb ' + (t('copyCode') || 'Copy Code');
          }, 2000);
        });
      };

      tabHeader.appendChild(btnDiagramTab);
      tabHeader.appendChild(btnCodeTab);
      tabHeader.appendChild(btnCopyCode);
      tabsContainer.appendChild(tabHeader);

      // === Diagram tab (default active) ===
      var diagramTab = document.createElement('div');
      diagramTab.className = 'tab-content tab-diagram active';

      try {
        var base64 = diagramBase64 || '';
        if (base64) {
          var diagramCont = document.createElement('div');
          diagramCont.className = 'inline-diagram';
          diagramCont.dataset.commands = JSON.stringify(commands);
          diagramCont.dataset.showAxes = String(lastShowAxes);

          var img = document.createElement('img');
          img.src = 'data:image/png;base64,' + base64;
          diagramCont.appendChild(img);

          var toolbar = document.createElement('div');
          toolbar.className = 'diagram-toolbar';

          var btnRerender = document.createElement('button');
          btnRerender.className = 'btn-tool';
          btnRerender.innerHTML = '\ud83d\udd04 ' + (t('rerender') || 'Rerender');
          btnRerender.onclick = function() { handleInlineRerender(diagramCont); };

          var btnExport = document.createElement('button');
          btnExport.className = 'btn-tool';
          btnExport.innerHTML = '\ud83d\udce5 ' + (t('export') || 'Export');
          btnExport.onclick = function() { handleInlineExport(img.src); };

          var btnInteractive = document.createElement('button');
          btnInteractive.className = 'btn-tool';
          btnInteractive.innerHTML = '\ud83d\udd0d ' + (t('interactiveView') || 'Interactive');
          btnInteractive.onclick = function() { showInteractiveModal(commands); };

          toolbar.appendChild(btnRerender);
          toolbar.appendChild(btnExport);
          toolbar.appendChild(btnInteractive);
          diagramCont.appendChild(toolbar);

          diagramTab.appendChild(diagramCont);
        }
      } catch (e) {
        console.error('Failed to generate PNG:', e);
      }

      tabsContainer.appendChild(diagramTab);

      // === Code tab ===
      var codeTab = document.createElement('div');
      codeTab.className = 'tab-content tab-code';

      var cmdBlock = document.createElement('pre');
      cmdBlock.className = 'msg-commands';
      cmdBlock.textContent = commands.join('\n');
      codeTab.appendChild(cmdBlock);

      tabsContainer.appendChild(codeTab);

      // === Tab switching logic ===
      tabHeader.addEventListener('click', function(e) {
        var btn = e.target.closest('.tab-btn');
        if (!btn) return;
        var tabName = btn.getAttribute('data-tab');
        var allBtns = tabHeader.querySelectorAll('.tab-btn');
        var allTabs = tabsContainer.querySelectorAll('.tab-content');
        for (var i = 0; i < allBtns.length; i++) { allBtns[i].classList.remove('active'); }
        for (var j = 0; j < allTabs.length; j++) { allTabs[j].classList.remove('active'); }
        btn.classList.add('active');
        var target = tabsContainer.querySelector('.tab-' + tabName);
        if (target) target.classList.add('active');
      });

      div.appendChild(tabsContainer);

    } else if (type === 'error') {
      var p = document.createElement('p');
      p.textContent = content;
      div.appendChild(p);

      var btnRetry = document.createElement('button');
      btnRetry.className = 'btn-retry';
      btnRetry.textContent = '\ud83d\udd04 ' + (t('retry') || 'Retry');
      btnRetry.onclick = function() { handleRetry(); };
      div.appendChild(btnRetry);
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
  function executeConstruction(commands, showAxes) {
    if (!ggbReady) throw new Error('GeoGebra not ready');

    // Validate first
    var validation = ConstructionCompiler.validate(commands);
    if (!validation.valid) {
      return { success: false, error: 'Validation failed: ' + validation.errors.join('; '), executed: 0, failed: commands.length };
    }

    ConstructionCompiler.reset(ggbApplet, showAxes);
    // Execute
    var result = ConstructionCompiler.execute(ggbApplet, validation.cleanedCommands);

    // Style
    ConstructionCompiler.styleConstruction(ggbApplet, showAxes);

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

  // ─── Retry ───────────────────────────────────────────────────────────
  function handleRetry() {
    if (busy) return;
    var session = getActiveSession();
    if (!session || session.messages.length === 0) return;

    // Find the last user message
    var lastUserMsg = null;
    for (var i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        lastUserMsg = session.messages[i].content;
        break;
      }
    }
    if (!lastUserMsg) return;

    // Remove trailing error messages from session and DOM
    while (session.messages.length > 0 && session.messages[session.messages.length - 1].role === 'error') {
      session.messages.pop();
    }
    saveSessions();
    var errorEls = $messages.querySelectorAll('.message.error');
    errorEls.forEach(function(el) { el.remove(); });

    // Re-send without adding duplicate user message
    sendPrompt(lastUserMsg, true);
  }

  // ─── Main Send Flow ──────────────────────────────────────────────────
  async function handleSend() {
    var prompt = $input.value.trim();
    if (!prompt || busy) return;
    $input.value = '';
    sendPrompt(prompt, false);
  }

  async function sendPrompt(prompt, isRetry) {
    busy = true;
    $btnSend.disabled = true;

    // Show user message only if not a retry (it already exists in chat)
    if (!isRetry) {
      addMessage('user', prompt);
    }

    // Build conversation history from session
    var session = getActiveSession();
    var conversationHistory = session.messages.map(function(m) {
      return { role: m.role, content: m.commands ? JSON.stringify({ explanation: m.content, commands: m.commands }) : m.content };
    });
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

        // Execute construction, then capture PNG after GeoGebra finishes rendering
        var showAxes = aiResult.showAxes === true;
        var execResult = executeConstruction(aiResult.commands, showAxes);

        if (execResult.success) {
          // Save commands and axes state for rerender
          lastCommands = aiResult.commands;
          lastShowAxes = showAxes;
          setStatus(t('drawing'));

          // Wait for GeoGebra to finish rendering before capturing PNG
          var diagramBase64 = await new Promise(function(resolve) {
            // refreshViews ensures pending draw ops complete
            if (typeof ggbApplet.refreshViews === 'function') ggbApplet.refreshViews();
            // Apply axes visibility based on AI response
            ggbApplet.setAxesVisible(showAxes, showAxes);
            ggbApplet.setGridVisible(showAxes);
            setTimeout(function() {
              try { resolve(ggbApplet.getPNGBase64(1, true, 72)); }
              catch(e) { resolve(''); }
            }, 150);
          });

          addMessage('assistant', aiResult.explanation || '', aiResult.commands, diagramBase64);

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

  // ─── Inline Diagram Actions ──────────────────────────────────────────
  function handleInlineRerender(diagramCont) {
    if (!ggbReady) return;
    var cmds = JSON.parse(diagramCont.dataset.commands);
    var showAxes = diagramCont.dataset.showAxes === 'true';
    ConstructionCompiler.reset(ggbApplet, showAxes);
    ConstructionCompiler.execute(ggbApplet, cmds);
    ConstructionCompiler.styleConstruction(ggbApplet, showAxes);
    
    // Wait for GeoGebra rendering to complete
    if (typeof ggbApplet.refreshViews === 'function') ggbApplet.refreshViews();
    ggbApplet.setAxesVisible(showAxes, showAxes);
    ggbApplet.setGridVisible(showAxes);
    setTimeout(function() {
      try {
        var base64 = ggbApplet.getPNGBase64(1, true, 72);
        var img = diagramCont.querySelector('img');
        if (img) img.src = 'data:image/png;base64,' + base64;
        setStatus(t('rerendered') || 'Rerendered');
      } catch (e) {
        console.error(e);
      }
    }, 150);
  }

  function handleInlineExport(base64Src) {
    var link = document.createElement('a');
    link.download = 'sketchmath-' + Date.now() + '.png';
    link.href = base64Src;
    link.click();
    setStatus(t('exported') || 'Exported PNG');
  }

  function showInteractiveModal(commands) {
    if (!ggbReady) return;
    // Move ggb-element to modal
    $ggbModalBody.appendChild($('#ggb-element'));
    $ggbModal.classList.remove('hidden');

    // Re-execute so user sees the live construction
    ConstructionCompiler.reset(ggbApplet, lastShowAxes);
    ConstructionCompiler.execute(ggbApplet, commands);
    ConstructionCompiler.styleConstruction(ggbApplet, lastShowAxes);
    // Apply axes visibility based on last known state
    if (typeof ggbApplet.refreshViews === 'function') ggbApplet.refreshViews();
    ggbApplet.setAxesVisible(lastShowAxes, lastShowAxes);
    ggbApplet.setGridVisible(lastShowAxes);
  }

  function hideInteractiveModal() {
    $ggbModal.classList.add('hidden');
    // Move ggb-element back to hidden container
    $('#ggb-hidden').appendChild($('#ggb-element'));
  }

  // ─── Toolbar Actions (Fallback/Global) ───────────────────────────────
  function handleClear() {
    if (!ggbReady) return;
    ConstructionCompiler.reset(ggbApplet);
    var session = getActiveSession(); if (session) { session.messages = []; saveSessions(); }
    $messages.innerHTML = '';
    lastCommands = [];
    updateObjectCount();
    setStatus(t('cleared') || 'Cleared');
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

    // Load sessions
    loadSessions();

    // Bind events
    $btnSend.addEventListener('click', handleSend);
    if ($btnCloseModal) $btnCloseModal.addEventListener('click', hideInteractiveModal);
    $btnLang.addEventListener('click', toggleLang);
    $btnTheme.addEventListener('click', toggleTheme);
    $btnNewChat.addEventListener('click', createNewSession);
    if ($btnSidebar) $btnSidebar.addEventListener('click', function() { toggleSidebar(); });
    if ($sidebarOverlay) $sidebarOverlay.addEventListener('click', function() { toggleSidebar(false); });
    document.addEventListener('keydown', handleKeydown);
    // Init GeoGebra
    initGeoGebra();
  }

  // Start
  init();
})();
