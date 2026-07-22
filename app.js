(function () {
  const STORAGE_KEY = "ai-trainer-level3-practice-v1";
  const SYNC_PROFILE_KEY = "ai-trainer-level3-sync-profile-v1";
  const SYNC_DEBOUNCE_MS = 900;
  const questionBank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const syncConfig = window.SYNC_CONFIG || {};

  const typeLabels = {
    judge: "判断题",
    single: "单选题",
    multi: "多选题",
  };

  const filterLabels = {
    all: "全部题目",
    judge: "判断题",
    single: "单选题",
    multi: "多选题",
    wrong: "错题回看",
    marked: "标记题",
  };

  const state = loadState();
  const syncProfile = loadSyncProfile();
  let currentSelection = [];
  let explanationOpen = false;
  let syncTimer = null;
  let isSyncing = false;

  const elements = {
    totalCount: document.getElementById("totalCount"),
    successRate: document.getElementById("successRate"),
    remainingCount: document.getElementById("remainingCount"),
    scopeLabel: document.getElementById("scopeLabel"),
    progressBar: document.getElementById("progressBar"),
    scopeAnsweredCount: document.getElementById("scopeAnsweredCount"),
    scopeSuccessRate: document.getElementById("scopeSuccessRate"),
    answeredCount: document.getElementById("answeredCount"),
    accuracyRate: document.getElementById("accuracyRate"),
    wrongCount: document.getElementById("wrongCount"),
    markedCount: document.getElementById("markedCount"),
    filterList: document.getElementById("filterList"),
    wrongReviewButton: document.getElementById("wrongReviewButton"),
    resetButton: document.getElementById("resetButton"),
    syncNameInput: document.getElementById("syncNameInput"),
    syncSecretInput: document.getElementById("syncSecretInput"),
    syncStatusPill: document.getElementById("syncStatusPill"),
    syncMessage: document.getElementById("syncMessage"),
    enableSyncButton: document.getElementById("enableSyncButton"),
    pullSyncButton: document.getElementById("pullSyncButton"),
    pushSyncButton: document.getElementById("pushSyncButton"),
    questionTypeLabel: document.getElementById("questionTypeLabel"),
    questionPosition: document.getElementById("questionPosition"),
    toggleMarkButton: document.getElementById("toggleMarkButton"),
    questionCard: document.querySelector(".question-card"),
    questionId: document.getElementById("questionId"),
    statusPill: document.getElementById("statusPill"),
    questionStem: document.getElementById("questionStem"),
    optionsList: document.getElementById("optionsList"),
    feedback: document.getElementById("feedback"),
    explanationBlock: document.getElementById("explanationBlock"),
    toggleExplanationButton: document.getElementById("toggleExplanationButton"),
    explanationText: document.getElementById("explanationText"),
    prevButton: document.getElementById("prevButton"),
    submitButton: document.getElementById("submitButton"),
    nextButton: document.getElementById("nextButton"),
    emptyState: document.getElementById("emptyState"),
    questionNavigator: document.getElementById("questionNavigator"),
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultState();
      }
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch (error) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      version: 1,
      activeFilter: "all",
      currentByFilter: {},
      answers: {},
      marked: {},
      updatedAt: null,
    };
  }

  function loadSyncProfile() {
    try {
      const raw = localStorage.getItem(SYNC_PROFILE_KEY);
      if (!raw) {
        return { enabled: false, syncName: "", syncSecret: "", lastSyncedAt: null };
      }
      return {
        enabled: false,
        syncName: "",
        syncSecret: "",
        lastSyncedAt: null,
        ...JSON.parse(raw),
      };
    } catch (error) {
      return { enabled: false, syncName: "", syncSecret: "", lastSyncedAt: null };
    }
  }

  function saveSyncProfile() {
    localStorage.setItem(SYNC_PROFILE_KEY, JSON.stringify(syncProfile));
  }

  function saveState(options = {}) {
    if (options.touch !== false) {
      state.updatedAt = new Date().toISOString();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (options.sync !== false) {
      schedulePushSync();
    }
  }

  function isCloudSyncConfigured() {
    return Boolean(syncConfig.supabaseUrl && syncConfig.supabaseAnonKey && syncConfig.table);
  }

  function getFilteredQuestions() {
    if (state.activeFilter === "all") {
      return questionBank;
    }
    if (["judge", "single", "multi"].includes(state.activeFilter)) {
      return questionBank.filter((question) => question.type === state.activeFilter);
    }
    if (state.activeFilter === "wrong") {
      return questionBank.filter((question) => state.answers[question.id]?.correct === false);
    }
    if (state.activeFilter === "marked") {
      return questionBank.filter((question) => state.marked[question.id]);
    }
    return questionBank;
  }

  function getCurrentIndex(questions) {
    const saved = state.currentByFilter[state.activeFilter] || 0;
    return Math.min(Math.max(saved, 0), Math.max(questions.length - 1, 0));
  }

  function getCurrentQuestion() {
    const questions = getFilteredQuestions();
    return questions[getCurrentIndex(questions)];
  }

  function normalizeAnswer(values) {
    return [...values].sort().join("|");
  }

  function isCorrect(question, selected) {
    return normalizeAnswer(question.answer) === normalizeAnswer(selected);
  }

  function updateStats() {
    const questions = getFilteredQuestions();
    const answeredEntries = Object.values(state.answers);
    const answered = answeredEntries.length;
    const correct = answeredEntries.filter((entry) => entry.correct).length;
    const wrong = answeredEntries.filter((entry) => entry.correct === false).length;
    const marked = Object.values(state.marked).filter(Boolean).length;
    const progress = questionBank.length ? Math.round((answered / questionBank.length) * 100) : 0;
    const scopeAnswered = questions.filter((question) => state.answers[question.id]).length;
    const scopeCorrect = questions.filter((question) => state.answers[question.id]?.correct).length;
    const scopeSuccess = scopeAnswered ? Math.round((scopeCorrect / scopeAnswered) * 100) : 0;

    elements.totalCount.textContent = String(questionBank.length);
    elements.successRate.textContent = answered ? `${Math.round((correct / answered) * 100)}%` : "0%";
    elements.remainingCount.textContent = String(Math.max(questionBank.length - answered, 0));
    elements.answeredCount.textContent = String(answered);
    elements.accuracyRate.textContent = answered ? `${Math.round((correct / answered) * 100)}%` : "0%";
    elements.wrongCount.textContent = String(wrong);
    elements.markedCount.textContent = String(marked);
    elements.progressBar.style.width = `${progress}%`;
    elements.scopeLabel.textContent = filterLabels[state.activeFilter] || "全部题目";
    elements.scopeAnsweredCount.textContent = `${scopeAnswered} / ${questions.length} 已答`;
    elements.scopeSuccessRate.textContent = `${scopeSuccess}%`;
    elements.wrongReviewButton.textContent = state.activeFilter === "wrong" ? "退出错题复习" : "错题复习";
    elements.wrongReviewButton.disabled = state.activeFilter !== "wrong" && wrong === 0;
    renderSyncStatus();
  }

  function renderFilters() {
    elements.filterList.querySelectorAll(".filter-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === state.activeFilter);
    });
  }

  function renderQuestion() {
    const questions = getFilteredQuestions();
    const question = questions[getCurrentIndex(questions)];
    updateStats();
    renderFilters();

    if (!question) {
      elements.questionCard.hidden = true;
      elements.emptyState.hidden = false;
      elements.questionTypeLabel.textContent = filterLabels[state.activeFilter] || "练习";
      elements.questionPosition.textContent = "暂无题目";
      renderNavigator(questions);
      return;
    }

    elements.questionCard.hidden = false;
    elements.emptyState.hidden = true;

    const savedAnswer = state.answers[question.id];
    currentSelection = savedAnswer ? [...savedAnswer.selected] : [];
    explanationOpen = false;

    elements.questionTypeLabel.textContent = typeLabels[question.type] || "练习题";
    elements.questionPosition.textContent = `第 ${getCurrentIndex(questions) + 1} / ${questions.length} 题`;
    elements.questionId.textContent = question.id;
    elements.questionStem.textContent = question.stem;
    elements.submitButton.disabled = currentSelection.length === 0;
    elements.prevButton.disabled = getCurrentIndex(questions) === 0;
    elements.nextButton.disabled = getCurrentIndex(questions) >= questions.length - 1;
    elements.toggleMarkButton.classList.toggle("is-active", Boolean(state.marked[question.id]));
    elements.toggleMarkButton.textContent = state.marked[question.id] ? "取消标记" : "标记不确定";

    renderStatus(question, savedAnswer);
    renderOptions(question, savedAnswer);
    renderFeedback(question, savedAnswer);
    renderNavigator(questions);
  }

  function renderStatus(question, savedAnswer) {
    elements.statusPill.className = "";
    if (savedAnswer?.correct) {
      elements.statusPill.textContent = "回答正确";
      elements.statusPill.classList.add("is-correct");
    } else if (savedAnswer?.correct === false) {
      elements.statusPill.textContent = "回答错误";
      elements.statusPill.classList.add("is-wrong");
    } else if (state.marked[question.id]) {
      elements.statusPill.textContent = "已标记";
      elements.statusPill.classList.add("is-marked");
    } else {
      elements.statusPill.textContent = "未作答";
    }
  }

  function renderOptions(question, savedAnswer) {
    elements.optionsList.innerHTML = "";
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.dataset.value = option.key;

      const key = document.createElement("span");
      key.className = "option-key";
      key.textContent = option.key;

      const text = document.createElement("span");
      text.textContent = option.text;

      button.append(key, text);
      button.classList.toggle("is-selected", currentSelection.includes(option.key));

      if (savedAnswer) {
        const isRightAnswer = question.answer.includes(option.key);
        const isPickedWrong = savedAnswer.selected.includes(option.key) && !isRightAnswer;
        button.classList.toggle("is-correct", isRightAnswer);
        button.classList.toggle("is-wrong", isPickedWrong);
      }

      button.addEventListener("click", () => selectOption(question, option.key));
      elements.optionsList.appendChild(button);
    });
  }

  function renderFeedback(question, savedAnswer) {
    if (!savedAnswer) {
      elements.feedback.hidden = true;
      elements.explanationBlock.hidden = true;
      elements.explanationText.hidden = true;
      elements.toggleExplanationButton.textContent = "查看解释";
      return;
    }

    elements.feedback.hidden = false;
    elements.feedback.className = `feedback ${savedAnswer.correct ? "is-correct" : "is-wrong"}`;
    const answerText = question.answer.join("、");
    elements.feedback.textContent = savedAnswer.correct
      ? `回答正确。正确答案：${answerText}`
      : `回答错误。正确答案：${answerText}`;

    elements.explanationBlock.hidden = false;
    elements.explanationText.hidden = !explanationOpen;
    elements.explanationText.textContent = question.explanation;
    elements.toggleExplanationButton.textContent = explanationOpen ? "收起解释" : "查看解释";
  }

  function renderNavigator(questions) {
    const currentIndex = getCurrentIndex(questions);
    elements.questionNavigator.innerHTML = "";
    questions.forEach((question, index) => {
      const button = document.createElement("button");
      const savedAnswer = state.answers[question.id];
      const displayNumber = state.activeFilter === "all" ? index + 1 : question.number;
      button.type = "button";
      button.className = "nav-question";
      button.textContent = String(displayNumber);
      button.title = `${typeLabels[question.type]} ${question.number} (${question.id})`;
      button.classList.toggle("is-current", index === currentIndex);
      button.classList.toggle("is-correct", savedAnswer?.correct === true);
      button.classList.toggle("is-wrong", savedAnswer?.correct === false);
      button.classList.toggle("is-marked", Boolean(state.marked[question.id]));
      button.addEventListener("click", () => {
        state.currentByFilter[state.activeFilter] = index;
        saveState();
        renderQuestion();
      });
      elements.questionNavigator.appendChild(button);
    });
  }

  function selectOption(question, value) {
    if (question.type === "multi") {
      currentSelection = currentSelection.includes(value)
        ? currentSelection.filter((item) => item !== value)
        : [...currentSelection, value];
    } else {
      currentSelection = [value];
    }
    elements.submitButton.disabled = currentSelection.length === 0;
    renderOptions(question, state.answers[question.id]);
  }

  function submitCurrentAnswer() {
    const question = getCurrentQuestion();
    if (!question || currentSelection.length === 0) {
      return;
    }
    state.answers[question.id] = {
      selected: [...currentSelection],
      correct: isCorrect(question, currentSelection),
      answeredAt: new Date().toISOString(),
    };
    explanationOpen = false;
    saveState();
    renderQuestion();
  }

  function move(offset) {
    const questions = getFilteredQuestions();
    const nextIndex = Math.min(Math.max(getCurrentIndex(questions) + offset, 0), questions.length - 1);
    state.currentByFilter[state.activeFilter] = nextIndex;
    saveState();
    renderQuestion();
  }

  function setFilter(filter) {
    state.activeFilter = filter;
    state.currentByFilter[filter] = state.currentByFilter[filter] || 0;
    saveState();
    renderQuestion();
  }

  function toggleMark() {
    const question = getCurrentQuestion();
    if (!question) {
      return;
    }
    state.marked[question.id] = !state.marked[question.id];
    if (!state.marked[question.id]) {
      delete state.marked[question.id];
    }
    saveState();
    renderQuestion();
  }

  function renderSyncStatus() {
    elements.syncNameInput.value = syncProfile.syncName || "";
    elements.syncSecretInput.value = syncProfile.syncSecret || "";
    elements.pullSyncButton.disabled = !syncProfile.enabled || !isCloudSyncConfigured() || isSyncing;
    elements.pushSyncButton.disabled = !syncProfile.enabled || !isCloudSyncConfigured() || isSyncing;
    elements.enableSyncButton.disabled = isSyncing;

    if (!isCloudSyncConfigured()) {
      elements.syncStatusPill.textContent = "未配置";
      elements.syncStatusPill.className = "is-off";
      elements.syncMessage.textContent = "云端服务未配置：请先在 sync-config.js 填入 Supabase URL 和 anon key。";
      return;
    }

    if (!syncProfile.enabled) {
      elements.syncStatusPill.textContent = "未开启";
      elements.syncStatusPill.className = "is-off";
      elements.syncMessage.textContent = "输入同步账号和口令后开启；同一用户在不同设备输入同一组信息即可同步。";
      return;
    }

    elements.syncStatusPill.textContent = "已开启";
    elements.syncStatusPill.className = "is-on";
    const syncedText = syncProfile.lastSyncedAt
      ? `上次同步：${new Date(syncProfile.lastSyncedAt).toLocaleString()}`
      : "尚未完成首次同步";
    elements.syncMessage.textContent = `${syncedText}。当前同步账号：${syncProfile.syncName}`;
  }

  async function makeUserKey() {
    const text = `${syncProfile.syncName.trim()}::${syncProfile.syncSecret}`;
    const encoded = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function exportProgressPayload() {
    return {
      version: state.version || 1,
      answers: state.answers || {},
      marked: state.marked || {},
      currentByFilter: state.currentByFilter || {},
      activeFilter: state.activeFilter || "all",
      updatedAt: state.updatedAt || new Date().toISOString(),
    };
  }

  function mergeProgress(remotePayload) {
    if (!remotePayload || typeof remotePayload !== "object") {
      return false;
    }

    const mergedAnswers = { ...(state.answers || {}) };
    Object.entries(remotePayload.answers || {}).forEach(([questionId, remoteAnswer]) => {
      const localAnswer = mergedAnswers[questionId];
      if (!localAnswer || Date.parse(remoteAnswer.answeredAt || 0) > Date.parse(localAnswer.answeredAt || 0)) {
        mergedAnswers[questionId] = remoteAnswer;
      }
    });

    const remoteIsNewer =
      Date.parse(remotePayload.updatedAt || 0) > Date.parse(state.updatedAt || 0);

    state.answers = mergedAnswers;
    state.marked = remoteIsNewer ? { ...(remotePayload.marked || {}) } : { ...(state.marked || {}) };
    state.currentByFilter = remoteIsNewer
      ? { ...(remotePayload.currentByFilter || {}) }
      : { ...(state.currentByFilter || {}) };
    state.updatedAt = new Date().toISOString();
    saveState({ sync: false });
    renderQuestion();
    return true;
  }

  async function requestSync(method, payload) {
    const userKey = await makeUserKey();
    const baseUrl = syncConfig.supabaseUrl.replace(/\/$/, "");
    const table = encodeURIComponent(syncConfig.table);
    const url = `${baseUrl}/rest/v1/${table}`;
    const headers = {
      apikey: syncConfig.supabaseAnonKey,
      Authorization: `Bearer ${syncConfig.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    if (method === "GET") {
      const response = await fetch(`${url}?user_key=eq.${userKey}&select=payload,updated_at`, { headers });
      if (!response.ok) {
        throw new Error(`拉取失败：HTTP ${response.status}`);
      }
      const rows = await response.json();
      return rows[0] || null;
    }

    const body = JSON.stringify({
      user_key: userKey,
      payload,
      updated_at: new Date().toISOString(),
    });
    const response = await fetch(`${url}?on_conflict=user_key`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body,
    });
    if (!response.ok) {
      throw new Error(`上传失败：HTTP ${response.status}`);
    }
    const rows = await response.json();
    return rows[0] || null;
  }

  function setSyncMessage(message, isError = false) {
    elements.syncMessage.textContent = message;
    elements.syncMessage.classList.toggle("is-error", isError);
  }

  function schedulePushSync() {
    if (!syncProfile.enabled || !isCloudSyncConfigured()) {
      return;
    }
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      pushSync({ silent: true });
    }, SYNC_DEBOUNCE_MS);
  }

  async function pullSync() {
    if (!syncProfile.enabled || !isCloudSyncConfigured()) {
      renderSyncStatus();
      return;
    }
    isSyncing = true;
    renderSyncStatus();
    try {
      const row = await requestSync("GET");
      if (!row) {
        await pushSync({ silent: true });
        setSyncMessage("云端还没有进度，已把本机进度作为首次同步上传。");
      } else {
        mergeProgress(row.payload);
        syncProfile.lastSyncedAt = new Date().toISOString();
        saveSyncProfile();
        setSyncMessage("已拉取云端进度，并与本机进度合并。");
      }
    } catch (error) {
      setSyncMessage(error.message || "同步失败，请检查网络和云端配置。", true);
    } finally {
      isSyncing = false;
      renderSyncStatus();
    }
  }

  async function pushSync(options = {}) {
    if (!syncProfile.enabled || !isCloudSyncConfigured()) {
      renderSyncStatus();
      return;
    }
    isSyncing = true;
    renderSyncStatus();
    try {
      await requestSync("POST", exportProgressPayload());
      syncProfile.lastSyncedAt = new Date().toISOString();
      saveSyncProfile();
      if (!options.silent) {
        setSyncMessage("本机进度已上传到云端。");
      }
    } catch (error) {
      if (!options.silent) {
        setSyncMessage(error.message || "上传失败，请检查网络和云端配置。", true);
      }
    } finally {
      isSyncing = false;
      renderSyncStatus();
    }
  }

  function enableSync() {
    const syncName = elements.syncNameInput.value.trim();
    const syncSecret = elements.syncSecretInput.value;
    if (!syncName || !syncSecret) {
      setSyncMessage("请同时填写同步账号和同步口令。", true);
      return;
    }
    syncProfile.enabled = true;
    syncProfile.syncName = syncName;
    syncProfile.syncSecret = syncSecret;
    saveSyncProfile();
    renderSyncStatus();
    pullSync();
  }

  elements.filterList.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-button");
    if (button) {
      setFilter(button.dataset.filter);
    }
  });

  elements.prevButton.addEventListener("click", () => move(-1));
  elements.nextButton.addEventListener("click", () => move(1));
  elements.submitButton.addEventListener("click", submitCurrentAnswer);
  elements.toggleMarkButton.addEventListener("click", toggleMark);
  elements.wrongReviewButton.addEventListener("click", () => {
    setFilter(state.activeFilter === "wrong" ? "all" : "wrong");
  });
  elements.enableSyncButton.addEventListener("click", enableSync);
  elements.pullSyncButton.addEventListener("click", pullSync);
  elements.pushSyncButton.addEventListener("click", () => pushSync());

  elements.toggleExplanationButton.addEventListener("click", () => {
    explanationOpen = !explanationOpen;
    renderFeedback(getCurrentQuestion(), state.answers[getCurrentQuestion().id]);
  });

  elements.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm("确认清空本地练习记录吗？题库不会被删除。");
    if (!confirmed) {
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, defaultState());
    currentSelection = [];
    renderQuestion();
  });

  renderQuestion();
  if (syncProfile.enabled && isCloudSyncConfigured()) {
    window.setTimeout(() => pullSync(), 300);
  }
})();
