const {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo
} = React;

// ============================================================
// CONFIGURATION
// ============================================================
const DEFAULT_REFRESH_MS = 15000; // Auto-refresh interval default (ms) — admin-configurable
const MIN_REFRESH_MS = 5000;      // 5s floor (must match api.php)
const MAX_REFRESH_MS = 120000;    // 2 min ceiling (must match api.php)
const MAX_Q_LENGTH = 500; // Max question character length (must match api.php)
const DEFAULT_MAX_PER_USER = 3; // Max LIVE questions per person default (must match api.php)
const MIN_MAX_PER_USER = 1;     // (must match api.php)
const MAX_MAX_PER_USER = 20;    // (must match api.php)
const DEFAULT_HALF_LIFE_MIN = 60; // Balanced-ranking half-life default (must match api.php)
const MIN_HALF_LIFE_MIN = 5;      // (must match api.php)
const MAX_HALF_LIFE_MIN = 10080;  // 1 week (must match api.php)
const NEW_WINDOW_MIN = 10; // A question is "new" (and fades) over its first N minutes
const REDIRECT_COUNTDOWN_S = 5; // Poll-redirect overlay countdown (seconds)
const DEMO_MODE = false; // Set true to show 20 fake questions (skips server)
const API_URL = "api.php"; // path to backend, relative to QA.html

// ============================================================
// API HELPERS — talk to api.php (single source of truth)
// Identity comes from an HttpOnly cookie set by the server; the
// client only knows its uid via the `identity` field returned
// by every API response.
// ============================================================
const ADMIN_TOKEN_KEY = "qa-board:admin-token"; // sessionStorage, cleared on tab close
const REDIRECT_DISMISS_KEY = "qa-board:redirect-dismissed"; // sessionStorage: URL the user chose to skip
async function apiCall(action, body = {}) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      credentials: "same-origin", // send qa_uid cookie
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body })
    });
    if (!res.ok) return { error: "http_" + res.status };
    return await res.json();
  } catch {
    return { error: "network" };
  }
}

// ============================================================
// DEMO DATA (only used when DEMO_MODE = true)
// ============================================================
const DEMO_QUESTIONS = [{
  id: "d01",
  text: "What's the roadmap for AI integration in the product this year?",
  authorName: "Sarah K.",
  authorFingerprint: "demo_1",
  timestamp: Date.now() - 3600000,
  upvotes: Array.from({
    length: 24
  }, (_, i) => "voter_" + i)
}, {
  id: "d02",
  text: "Can we get an update on the hiring freeze — is it still in effect?",
  authorName: "Marcus T.",
  authorFingerprint: "demo_2",
  timestamp: Date.now() - 7200000,
  upvotes: Array.from({
    length: 19
  }, (_, i) => "voter_" + (i + 30))
}, {
  id: "d03",
  text: "Will there be any changes to the remote work policy next quarter?",
  authorName: "Priya R.",
  authorFingerprint: "demo_3",
  timestamp: Date.now() - 1800000,
  upvotes: Array.from({
    length: 17
  }, (_, i) => "voter_" + (i + 60))
}, {
  id: "d04",
  text: "How is leadership addressing the recent drop in customer retention metrics?",
  authorName: "James L.",
  authorFingerprint: "demo_4",
  timestamp: Date.now() - 5400000,
  upvotes: Array.from({
    length: 15
  }, (_, i) => "voter_" + (i + 90))
}, {
  id: "d05",
  text: "Are there plans to open-source any of our internal tooling?",
  authorName: "Anika P.",
  authorFingerprint: "demo_5",
  timestamp: Date.now() - 900000,
  upvotes: Array.from({
    length: 13
  }, (_, i) => "voter_" + (i + 120))
}, {
  id: "d06",
  text: "What's the status of the data center migration to AWS?",
  authorName: "Chen W.",
  authorFingerprint: "demo_6",
  timestamp: Date.now() - 10800000,
  upvotes: Array.from({
    length: 12
  }, (_, i) => "voter_" + (i + 150))
}, {
  id: "d07",
  text: "Can we discuss improving the on-call rotation? Current schedule is burning people out.",
  authorName: "Devon M.",
  authorFingerprint: "demo_7",
  timestamp: Date.now() - 2700000,
  upvotes: Array.from({
    length: 11
  }, (_, i) => "voter_" + (i + 180))
}, {
  id: "d08",
  text: "Is the company considering a 4-day work week pilot?",
  authorName: "Lisa F.",
  authorFingerprint: "demo_8",
  timestamp: Date.now() - 4500000,
  upvotes: Array.from({
    length: 10
  }, (_, i) => "voter_" + (i + 210))
}, {
  id: "d09",
  text: "What happened with the partnership talks with Stripe?",
  authorName: "Omar H.",
  authorFingerprint: "demo_9",
  timestamp: Date.now() - 6300000,
  upvotes: Array.from({
    length: 9
  }, (_, i) => "voter_" + (i + 240))
}, {
  id: "d10",
  text: "Any plans for a bug bounty program for external researchers?",
  authorName: "Rachel S.",
  authorFingerprint: "demo_10",
  timestamp: Date.now() - 300000,
  upvotes: Array.from({
    length: 8
  }, (_, i) => "voter_" + (i + 270))
}, {
  id: "d11",
  text: "When will the new performance review framework be rolled out?",
  authorName: "Tyler B.",
  authorFingerprint: "demo_11",
  timestamp: Date.now() - 8100000,
  upvotes: Array.from({
    length: 7
  }, (_, i) => "voter_" + (i + 300))
}, {
  id: "d12",
  text: "Can engineering get access to the enterprise Figma licenses?",
  authorName: "Nadia C.",
  authorFingerprint: "demo_12",
  timestamp: Date.now() - 1200000,
  upvotes: Array.from({
    length: 6
  }, (_, i) => "voter_" + (i + 330))
}, {
  id: "d13",
  text: "What's the budget situation for conference attendance this year?",
  authorName: "Greg A.",
  authorFingerprint: "demo_13",
  timestamp: Date.now() - 9000000,
  upvotes: Array.from({
    length: 5
  }, (_, i) => "voter_" + (i + 360))
}, {
  id: "d14",
  text: "Are we going to address the tech debt in the payments service before Q3?",
  authorName: "Yuki N.",
  authorFingerprint: "demo_14",
  timestamp: Date.now() - 600000,
  upvotes: Array.from({
    length: 14
  }, (_, i) => "voter_" + (i + 390))
}, {
  id: "d15",
  text: "Can someone explain the new equity refresh grant structure?",
  authorName: "Ben D.",
  authorFingerprint: "demo_15",
  timestamp: Date.now() - 3000000,
  upvotes: Array.from({
    length: 3
  }, (_, i) => "voter_" + (i + 420))
}, {
  id: "d16",
  text: "Will the cafeteria menu be updated? The options have been the same for months.",
  authorName: "Mia J.",
  authorFingerprint: "demo_16",
  timestamp: Date.now() - 7800000,
  upvotes: Array.from({
    length: 2
  }, (_, i) => "voter_" + (i + 450))
}, {
  id: "d17",
  text: "How are we preparing for the upcoming SOC 2 audit?",
  authorName: "Alex V.",
  authorFingerprint: "demo_17",
  timestamp: Date.now() - 150000,
  upvotes: Array.from({
    length: 16
  }, (_, i) => "voter_" + (i + 480))
}, {
  id: "d18",
  text: "Is there a timeline for shipping the mobile app redesign?",
  authorName: "Dana E.",
  authorFingerprint: "demo_18",
  timestamp: Date.now() - 5000000,
  upvotes: Array.from({
    length: 20
  }, (_, i) => "voter_" + (i + 510))
}, {
  id: "d19",
  text: "Can leadership share more context on why the Berlin office was closed?",
  authorName: "Kai R.",
  authorFingerprint: "demo_19",
  timestamp: Date.now() - 2000000,
  upvotes: Array.from({
    length: 22
  }, (_, i) => "voter_" + (i + 540))
}, {
  id: "d20",
  text: "What mentorship programs are available for junior engineers?",
  authorName: "Zoe T.",
  authorFingerprint: "demo_20",
  timestamp: Date.now() - 4000000,
  upvotes: Array.from({
    length: 4
  }, (_, i) => "voter_" + (i + 570))
}];
function simulateVoteChanges(qs) {
  return qs.map(q => {
    const change = Math.floor(Math.random() * 11) - 4;
    const currentLen = q.upvotes.length;
    const newLen = Math.max(0, currentLen + change);
    const newUpvotes = Array.from({
      length: newLen
    }, (_, i) => "voter_sim_" + q.id + "_" + i);
    return {
      ...q,
      upvotes: newUpvotes
    };
  });
}

// ============================================================
// SUBMIT FORM — owns its own text/name so a refresh never disturbs typing.
// Memoized: re-renders only when remaining/limit change, not when questions do.
// ============================================================
const SubmitForm = React.memo(function SubmitForm({ remaining, limit, onSubmit }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const atLimit = remaining <= 0;
  const canSend = !atLimit && !busy && !!text.trim() && !!name.trim();

  async function send() {
    if (busy) return;
    const t = text.trim(), n = name.trim();
    if (!t) { setErr("Please enter a question."); return; }
    if (!n) { setErr("Please enter your name."); return; }
    if (t.length > MAX_Q_LENGTH) { setErr("Question must be under " + MAX_Q_LENGTH + " characters."); return; }
    if (atLimit) { setErr("You've used all " + limit + " of your questions. Delete one to ask another."); return; }
    setBusy(true);
    try {
      const res = await onSubmit(t, n);
      if (res && res.ok) { setText(""); setErr(""); }
      else if (res && res.error === "limit_reached") setErr("You've used all " + limit + " of your questions. Delete one to ask another.");
      else if (res && res.error === "too_long") setErr("Question is too long.");
      else setErr("Failed to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return /*#__PURE__*/React.createElement("div", { style: S.submitCard },
    /*#__PURE__*/React.createElement("p", { style: S.rateNote },
      "You can submit up to " + limit + " total questions. Questions can't be edited once they've received votes from other people — but you can delete your submitted questions to ask a new one or rephrase."),
    /*#__PURE__*/React.createElement("div", { style: S.nameRow },
      /*#__PURE__*/React.createElement("input", {
        type: "text",
        placeholder: "First name & last initial (e.g. Jane D.)",
        "aria-label": "Your first name and last initial",
        value: name,
        onChange: e => setName(e.target.value.slice(0, 40)),
        style: S.nameInput
      })),
    /*#__PURE__*/React.createElement("textarea", {
      placeholder: "Type your question here...",
      "aria-label": "Your question",
      value: text,
      onChange: e => { setText(e.target.value.slice(0, MAX_Q_LENGTH)); setErr(""); },
      onKeyDown: e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send(); },
      rows: 3,
      style: S.questionInput
    }),
    /*#__PURE__*/React.createElement("div", { style: S.submitRow },
      /*#__PURE__*/React.createElement("span", { style: S.charCount }, text.length, "/", MAX_Q_LENGTH),
      /*#__PURE__*/React.createElement("span", { style: S.usageNote },
        atLimit ? "You've used all " + limit + " — delete one to ask another" : (limit - remaining) + " of " + limit + " used"),
      err && /*#__PURE__*/React.createElement("span", { style: S.errorText }, err),
      /*#__PURE__*/React.createElement("button", {
        className: "submit-btn",
        onClick: send,
        disabled: !canSend,
        style: S.submitBtn
      }, busy ? "Submitting…" : "Submit Question")));
});

// ============================================================
// REDIRECT OVERLAY — full-screen 5s countdown to the poll, with an
// opt-out guarded by a secondary confirm. Owns its own timer/confirm state.
// ============================================================
function RedirectOverlay({ url, seconds, onGo, onStay }) {
  const [remaining, setRemaining] = useState(seconds);
  const [confirming, setConfirming] = useState(false);
  const goRef = useRef(onGo);
  goRef.current = onGo;

  useEffect(() => {
    if (confirming) return; // pause the auto-navigate while the user is deciding to stay
    if (remaining <= 0) { goRef.current(); return; }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, confirming]);

  return /*#__PURE__*/React.createElement("div", { style: S.redirectOverlay, role: "dialog", "aria-modal": "true" },
    /*#__PURE__*/React.createElement("div", { style: S.redirectBox },
      confirming
        ? /*#__PURE__*/React.createElement(React.Fragment, null,
            /*#__PURE__*/React.createElement("p", { style: S.redirectTitle }, "Are you sure?"),
            /*#__PURE__*/React.createElement("p", { style: S.redirectText }, "You'll miss the live poll."),
            /*#__PURE__*/React.createElement("div", { style: S.redirectBtns },
              /*#__PURE__*/React.createElement("button", { style: S.redirectStayBtn, onClick: onStay }, "Yes, stay here"),
              /*#__PURE__*/React.createElement("button", { style: S.redirectGoBtn, onClick: onGo }, "Take me to the poll")))
        : /*#__PURE__*/React.createElement(React.Fragment, null,
            /*#__PURE__*/React.createElement("p", { style: S.redirectEmoji }, "📊"),
            /*#__PURE__*/React.createElement("p", { style: S.redirectTitle }, "Heading to the poll"),
            /*#__PURE__*/React.createElement("p", { style: S.redirectText }, "Taking you there in " + remaining + "s…"),
            /*#__PURE__*/React.createElement("div", { style: S.redirectBtns },
              /*#__PURE__*/React.createElement("button", { style: S.redirectStayBtn, onClick: () => setConfirming(true) }, "Stay on the Q&A"),
              /*#__PURE__*/React.createElement("button", { style: S.redirectGoBtn, onClick: onGo }, "Go to poll now →")))));
}

// ============================================================
// MAIN APP
// ============================================================
function QAVotingBoard() {
  const [questions, setQuestions] = useState([]);
  const [sortMode, setSortMode] = useState("balanced");
  const [fingerprint, setFingerprint] = useState(""); // server-issued uid via cookie
  const [halfLifeMin, setHalfLifeMin] = useState(DEFAULT_HALF_LIFE_MIN);
  const [halfLifeInput, setHalfLifeInput] = useState(String(DEFAULT_HALF_LIFE_MIN));
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(""); // session token from server
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshCountdown, setRefreshCountdown] = useState(DEFAULT_REFRESH_MS / 1000);
  const [redirectUrl, setRedirectUrl] = useState("");      // active poll-redirect URL from server ("" = none)
  const [redirectAdminInput, setRedirectAdminInput] = useState(""); // admin's URL textbox
  const [needsSetup, setNeedsSetup] = useState(false);
  const [maxPerUser, setMaxPerUser] = useState(DEFAULT_MAX_PER_USER);
  const [maxPerUserInput, setMaxPerUserInput] = useState(String(DEFAULT_MAX_PER_USER));
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [refreshSecInput, setRefreshSecInput] = useState(String(DEFAULT_REFRESH_MS / 1000));
  const [setupPw, setSetupPw] = useState("");
  const [setupPw2, setSetupPw2] = useState("");
  const [setupError, setSetupError] = useState("");
  const [changePw, setChangePw] = useState("");
  const [changePw2, setChangePw2] = useState("");
  const [changePwMsg, setChangePwMsg] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState("");

  // Refs used for FLIP animation and to dodge stale closures.
  const cardRefs = useRef(new Map());
  const prevRects = useRef(new Map());
  const refreshTimerRef = useRef(null);
  const refreshMsRef = useRef(DEFAULT_REFRESH_MS);
  const actionErrorTimerRef = useRef(null);

  // Surface a transient error to the user for ~4s.
  const flashError = useCallback(msg => {
    setActionError(msg);
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    actionErrorTimerRef.current = setTimeout(() => setActionError(""), 4000);
  }, []);

  // The redirect URL this user explicitly chose to skip (per tab/session).
  const getDismissedUrl = useCallback(() => {
    try { return sessionStorage.getItem(REDIRECT_DISMISS_KEY) || ""; } catch { return ""; }
  }, []);

  // Restore admin session from sessionStorage if present.
  useEffect(() => {
    const tok = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (tok) {
      setAdminToken(tok);
      setIsAdmin(true);
    }
  }, []);

  // Pull latest server state and apply it.
  const refresh = useCallback(async () => {
    if (DEMO_MODE) {
      setQuestions(prev => simulateVoteChanges(prev));
      return;
    }
    const data = await apiCall("list");
    if (data.error) {
      // Don't clobber existing state on a transient failure.
      return;
    }
    if (data.identity) setFingerprint(data.identity);
    if (Array.isArray(data.questions)) {
      const qs = data.questions;
      setQuestions(qs);
      // Close a stale inline edit if the question gained a vote or was removed.
      setEditingId(prev => {
        if (!prev) return prev;
        const still = qs.find(q => q.id === prev);
        const votes = still && still.upvotes ? still.upvotes.length : 0;
        return (still && votes === 0) ? prev : null;
      });
    }
    if (typeof data.halfLifeMin === "number") setHalfLifeMin(data.halfLifeMin);
    if (typeof data.maxPerUser === "number") setMaxPerUser(data.maxPerUser);
    if (typeof data.refreshMs === "number") setRefreshMs(data.refreshMs);
    if (typeof data.needsSetup === "boolean") setNeedsSetup(data.needsSetup);
    if (typeof data.redirectUrl === "string") setRedirectUrl(data.redirectUrl);
    setRefreshCountdown(refreshMsRef.current / 1000);
  }, []);

  // Reset the 15s refresh timer (call after any user-initiated action).
  const resetRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(refresh, refreshMsRef.current);
    setRefreshCountdown(refreshMsRef.current / 1000);
  }, [refresh]);

  // --- Init ---
  useEffect(() => {
    if (DEMO_MODE) {
      setQuestions(DEMO_QUESTIONS);
      setFingerprint("demo_self");
      setLoading(false);
      return;
    }
    (async () => {
      const data = await apiCall("list");
      if (data.error) {
        setLoadError("Couldn't reach the server. Retrying every 15s…");
      } else {
        if (data.identity) setFingerprint(data.identity);
        if (Array.isArray(data.questions)) setQuestions(data.questions);
        if (typeof data.halfLifeMin === "number") setHalfLifeMin(data.halfLifeMin);
        if (typeof data.maxPerUser === "number") setMaxPerUser(data.maxPerUser);
        if (typeof data.refreshMs === "number") setRefreshMs(data.refreshMs);
        if (typeof data.needsSetup === "boolean") setNeedsSetup(data.needsSetup);
        if (typeof data.redirectUrl === "string") setRedirectUrl(data.redirectUrl);
        setLoadError("");
      }
      setLoading(false);
    })();
  }, []);

  // --- Auto-refresh (configurable, default 15s) — independent of sort mode. ---
  // Keyed on refreshMs: when the admin changes the interval the effect tears down and
  // rebuilds, which intentionally re-jitters (a fresh first-tick delay + one immediate
  // refresh). Jitter: a random first-tick delay de-phases clients that loaded at the same
  // instant, and the visibility refresh is spread over ~3s so a mass tab-return isn't one spike.
  useEffect(() => {
    refreshMsRef.current = refreshMs;
    const startDelay = Math.random() * 3000;
    let intervalId = null;
    const startTimer = setTimeout(() => {
      refresh();
      intervalId = setInterval(refresh, refreshMs);
      refreshTimerRef.current = intervalId;
    }, startDelay);
    const onVisible = () => {
      if (document.visibilityState === "visible") setTimeout(refresh, Math.random() * 3000);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, refreshMs]);

  // --- Keep the admin half-life input in sync with the active server value ---
  useEffect(() => { setHalfLifeInput(String(halfLifeMin)); }, [halfLifeMin]);
  useEffect(() => { setMaxPerUserInput(String(maxPerUser)); }, [maxPerUser]);
  useEffect(() => { setRefreshSecInput(String(Math.round(refreshMs / 1000))); }, [refreshMs]);

  // --- Refresh-countdown ticker (purely visual) ---
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshCountdown(prev => prev <= 1 ? Math.round(refreshMsRef.current / 1000) : prev - 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const sortedQuestions = useMemo(
    () => QARanking.sortQuestions(questions, sortMode, { now: Date.now(), halfLifeMin }),
    [questions, sortMode, halfLifeMin]
  );

  // --- FLIP animation: slide cards between old and new positions over 1s,
  //     with opacity dipping to 70% mid-move. Per spec.
  useLayoutEffect(() => {
    const refs = cardRefs.current;
    const prev = prevRects.current;
    const liveIds = new Set();
    refs.forEach((el, id) => {
      if (!el) return;
      liveIds.add(id);
      const newRect = el.getBoundingClientRect();
      const oldRect = prev.get(id);
      if (oldRect && Math.abs(oldRect.top - newRect.top) > 0.5) {
        const dy = oldRect.top - newRect.top;
        el.style.animation = "none";
        el.style.transition = "none";
        el.style.transform = "translateY(" + dy + "px)";
        // force reflow so the next assignment animates from this position
        void el.offsetHeight;
        el.style.transition = "transform 1s cubic-bezier(0.25,0.46,0.45,0.94)";
        el.style.animation = "qaOpacityDip 1s ease-in-out";
        el.style.transform = "";
      }
      prev.set(id, newRect);
    });
    // Drop rects for unmounted cards.
    prev.forEach((_, id) => { if (!liveIds.has(id)) prev.delete(id); });
  }, [sortedQuestions]);

  const myCount = useMemo(
    () => questions.filter(q => (q.authorUid || q.authorFingerprint) === fingerprint).length,
    [questions, fingerprint]
  );

  // --- Actions ---
  // Stable: must NOT close over myCount/questions, or <SubmitForm> would re-render
  // on every refresh. The server enforces the 3-question limit authoritatively.
  const handleSubmit = useCallback(async (text, name) => {
    const data = await apiCall("submit", { text, authorName: name });
    if (data.error === "limit_reached")  return { ok: false, error: "limit_reached" };
    if (data.error === "too_long")       return { ok: false, error: "too_long" };
    if (data.error === "missing_fields") return { ok: false, error: "missing_fields" };
    if (data.error)                      return { ok: false, error: "failed" };
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    if (data.identity) setFingerprint(data.identity);
    if (typeof data.halfLifeMin === "number") setHalfLifeMin(data.halfLifeMin);
    resetRefreshTimer();
    return { ok: true };
  }, [resetRefreshTimer]);
  async function handleVote(questionId) {
    const data = await apiCall("vote", { questionId });
    if (data.error && data.error !== "not_found") {
      flashError("Couldn't register vote. Please try again.");
      return;
    }
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    resetRefreshTimer();
  }
  async function handleDelete(questionId) {
    const data = await apiCall("delete", { questionId, adminToken: isAdmin ? adminToken : undefined });
    if (data.error) {
      flashError(data.error === "not_allowed" ? "You can only delete your own question." : "Couldn't delete. Try again.");
      return;
    }
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    resetRefreshTimer();
  }
  async function handleAnswer(questionId) {
    const data = await apiCall("answer", { questionId, adminToken });
    if (data.error === "unauthorized") {
      flashError("Admin session expired. Please log in again.");
      doAdminLogout();
      return;
    }
    if (data.error) { flashError("Couldn't update. Try again."); return; }
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    resetRefreshTimer();
  }
  async function handleResetAll() {
    if (resetInput.trim().toLowerCase() !== "confirm") return;
    const data = await apiCall("reset", { adminToken });
    if (data.error === "unauthorized") {
      flashError("Admin session expired. Please log in again.");
      setShowResetConfirm(false);
      doAdminLogout();
      return;
    }
    if (data.error) { flashError("Couldn't reset. Try again."); return; }
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    setShowResetConfirm(false);
    setResetInput("");
    resetRefreshTimer();
  }

  async function handleEditSave(questionId) {
    const text = editingText.trim();
    if (!text) return;
    const data = await apiCall("edit", { questionId, text });
    if (data.error === "already_voted") {
      flashError("This question already has a vote, so it can't be edited.");
      setEditingId(null); refresh(); return;
    }
    if (data.error === "not_allowed") { flashError("You can only edit your own question."); setEditingId(null); return; }
    if (data.error === "too_long")    { flashError("Question is too long."); return; }
    if (data.error)                   { flashError("Couldn't save edit. Try again."); return; }
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    setEditingId(null);
    setEditingText("");
    resetRefreshTimer();
  }
  async function handleSetHalfLife() {
    const v = parseInt(halfLifeInput, 10);
    if (!Number.isFinite(v) || v < MIN_HALF_LIFE_MIN || v > MAX_HALF_LIFE_MIN) {
      flashError("Half-life must be between " + MIN_HALF_LIFE_MIN + " and " + MAX_HALF_LIFE_MIN + " minutes.");
      return;
    }
    const data = await apiCall("set-config", { adminToken, halfLifeMin: v });
    if (data.error === "unauthorized") { flashError("Admin session expired. Please log in again."); doAdminLogout(); return; }
    if (data.error) { flashError("Couldn't update half-life. Try again."); return; }
    if (typeof data.halfLifeMin === "number") setHalfLifeMin(data.halfLifeMin);
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    resetRefreshTimer();
  }
  async function doAdminLogin() {
    setAdminError("");
    const r = await apiCall("admin-login", { password: adminCode });
    if (r.error === "rate_limited") {
      setAdminError("Too many attempts — wait a few minutes.");
      setAdminCode("");
      return;
    }
    if (r.ok && r.adminToken) {
      setIsAdmin(true);
      setAdminToken(r.adminToken);
      try { sessionStorage.setItem(ADMIN_TOKEN_KEY, r.adminToken); } catch {}
      setShowAdminLogin(false);
      setAdminCode("");
    } else {
      setAdminError("Wrong password.");
      setAdminCode("");
    }
  }
  function doAdminLogout() {
    if (adminToken) apiCall("admin-logout", { adminToken }); // fire and forget
    setIsAdmin(false);
    setAdminToken("");
    try { sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
  }
  async function doSetupPassword() {
    setSetupError("");
    if (setupPw.length < 8) { setSetupError("At least 8 characters."); return; } // min must match api.php
    if (setupPw !== setupPw2) { setSetupError("Passwords don't match."); return; }
    const r = await apiCall("set-password", { password: setupPw });
    if (r.error === "weak_password") { setSetupError("At least 8 characters."); return; }
    if (r.ok && r.adminToken) {
      setIsAdmin(true);
      setAdminToken(r.adminToken);
      try { sessionStorage.setItem(ADMIN_TOKEN_KEY, r.adminToken); } catch {}
      setNeedsSetup(false);
      setShowAdminLogin(false);
      setSetupPw(""); setSetupPw2("");
      resetRefreshTimer();
    } else {
      setSetupError("Couldn't set the password. Try again.");
    }
  }
  async function doChangePassword() {
    setChangePwMsg("");
    if (changePw.length < 8) { setChangePwMsg("At least 8 characters."); return; } // min must match api.php
    if (changePw !== changePw2) { setChangePwMsg("Passwords don't match."); return; }
    const r = await apiCall("set-password", { adminToken, password: changePw });
    if (r.error === "unauthorized") { flashError("Admin session expired. Please log in again."); doAdminLogout(); return; }
    if (r.error === "weak_password") { setChangePwMsg("At least 8 characters."); return; }
    if (r.ok) {
      setChangePw(""); setChangePw2("");
      setChangePwMsg("Password updated. Other admin sessions were signed out.");
      resetRefreshTimer();
    } else {
      setChangePwMsg("Couldn't update the password.");
    }
  }
  async function handleSetMaxPerUser() {
    const v = parseInt(maxPerUserInput, 10);
    if (!Number.isFinite(v) || v < MIN_MAX_PER_USER || v > MAX_MAX_PER_USER) {
      flashError("Max questions must be between " + MIN_MAX_PER_USER + " and " + MAX_MAX_PER_USER + ".");
      return;
    }
    const data = await apiCall("set-config", { adminToken, maxPerUser: v });
    if (data.error === "unauthorized") { flashError("Admin session expired. Please log in again."); doAdminLogout(); return; }
    if (data.error) { flashError("Couldn't update the limit. Try again."); return; }
    if (typeof data.maxPerUser === "number") setMaxPerUser(data.maxPerUser);
    resetRefreshTimer();
  }
  async function handleSetRefresh() {
    const sec = parseInt(refreshSecInput, 10);
    const ms = sec * 1000;
    if (!Number.isFinite(sec) || ms < MIN_REFRESH_MS || ms > MAX_REFRESH_MS) {
      flashError("Refresh must be between " + (MIN_REFRESH_MS / 1000) + " and " + (MAX_REFRESH_MS / 1000) + " seconds.");
      return;
    }
    const data = await apiCall("set-config", { adminToken, refreshMs: ms });
    if (data.error === "unauthorized") { flashError("Admin session expired. Please log in again."); doAdminLogout(); return; }
    if (data.error) { flashError("Couldn't update the refresh interval. Try again."); return; }
    if (typeof data.refreshMs === "number") setRefreshMs(data.refreshMs);
    resetRefreshTimer();
  }
  async function handleSetRedirect(url) {
    const data = await apiCall("set-redirect", { adminToken, url });
    if (data.error === "unauthorized") { flashError("Admin session expired. Please log in again."); doAdminLogout(); return; }
    if (data.error === "invalid_url") { flashError("Enter a valid http(s) URL."); return; }
    if (data.error) { flashError("Couldn't update redirect. Try again."); return; }
    if (typeof data.redirectUrl === "string") setRedirectUrl(data.redirectUrl);
    setRedirectAdminInput("");
    resetRefreshTimer();
  }
  // Navigate this browser to the poll.
  function goToPoll() {
    if (redirectUrl) window.location.href = redirectUrl;
  }
  // User chose to stay: remember THIS url so the overlay won't re-prompt for it,
  // then drop the local redirect so the overlay closes. A different future URL re-prompts.
  function stayOnBoard() {
    try { sessionStorage.setItem(REDIRECT_DISMISS_KEY, redirectUrl); } catch {}
    setRedirectUrl("");
  }
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return Math.floor(diff / 86400000) + "d ago";
  }

  // --- Render ---
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      style: S.loadingWrap
    }, /*#__PURE__*/React.createElement("p", {
      style: S.loadingText
    }, "Loading questions..."));
  }
  const redirectDecision = QARedirect.action(
    { redirectUrl },
    { isAdmin, dismissedUrl: getDismissedUrl() }
  );
  const authMode = QAAuth.setupState({ needsSetup });
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    redirectDecision === "overlay" && /*#__PURE__*/React.createElement(RedirectOverlay, {
      url: redirectUrl,
      seconds: REDIRECT_COUNTDOWN_S,
      onGo: goToPoll,
      onStay: stayOnBoard
    }),
  /*#__PURE__*/React.createElement("div", {
    style: S.page
  }, /*#__PURE__*/React.createElement("header", {
    style: S.header
  }, /*#__PURE__*/React.createElement("div", {
    style: S.headerInner
  }, /*#__PURE__*/React.createElement("h1", {
    style: S.title
  }, /*#__PURE__*/React.createElement("span", {
    style: S.titleAccent
  }, "Q"), "&", /*#__PURE__*/React.createElement("span", {
    style: S.titleAccent
  }, "A"), " Board", DEMO_MODE && /*#__PURE__*/React.createElement("span", {
    style: S.demoBadge
  }, "PREVIEW")), /*#__PURE__*/React.createElement("div", {
    style: S.headerRight
  }, /*#__PURE__*/React.createElement("div", {
    style: S.refreshBadge
  }, "\u21BB ", refreshCountdown, "s"), !isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAdminLogin(!showAdminLogin),
    style: S.adminToggle,
    "aria-label": "Admin login",
    title: "Admin login"
  }, "\u2699"), isAdmin && /*#__PURE__*/React.createElement("span", {
    style: S.adminBadge
  }, "ADMIN"), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowResetConfirm(true);
      setResetInput("");
    },
    style: S.resetBtn
  }, "Reset All"), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: doAdminLogout,
    style: S.resetBtn,
    title: "Sign out of admin"
  }, "Sign out")))), showAdminLogin && !isAdmin && authMode === "setup" && /*#__PURE__*/React.createElement("div", {
    style: S.adminLoginBar
  }, /*#__PURE__*/React.createElement("span", {
    style: S.adminConfigLabel
  }, "Create the admin password (first-time setup)"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "New password (min 8)",
    "aria-label": "New admin password",
    value: setupPw,
    onChange: e => { setSetupPw(e.target.value); setSetupError(""); },
    onKeyDown: e => { if (e.key === "Enter") doSetupPassword(); },
    style: S.adminInput,
    autoFocus: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Confirm password",
    "aria-label": "Confirm admin password",
    value: setupPw2,
    onChange: e => { setSetupPw2(e.target.value); setSetupError(""); },
    onKeyDown: e => { if (e.key === "Enter") doSetupPassword(); },
    style: S.adminInput
  }), /*#__PURE__*/React.createElement("button", {
    onClick: doSetupPassword,
    style: S.adminLoginBtn
  }, "Create"), setupError && /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 12, color: "#fca5a5", marginLeft: 8, alignSelf: "center" }
  }, setupError)), showAdminLogin && !isAdmin && authMode === "login" && /*#__PURE__*/React.createElement("div", {
    style: S.adminLoginBar
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Admin password",
    "aria-label": "Admin password",
    value: adminCode,
    onChange: e => { setAdminCode(e.target.value); setAdminError(""); },
    onKeyDown: e => { if (e.key === "Enter") doAdminLogin(); },
    style: S.adminInput,
    autoFocus: true
  }), /*#__PURE__*/React.createElement("button", {
    onClick: doAdminLogin,
    style: S.adminLoginBtn
  }, "Enter"), adminError && /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 12, color: "#fca5a5", marginLeft: 8, alignSelf: "center" }
  }, adminError)), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: S.adminConfigBar
  }, /*#__PURE__*/React.createElement("label", {
    style: S.adminConfigLabel,
    htmlFor: "qa-halflife"
  }, "Balanced half-life (min) — default 60"), /*#__PURE__*/React.createElement("input", {
    id: "qa-halflife",
    type: "number",
    min: MIN_HALF_LIFE_MIN,
    max: MAX_HALF_LIFE_MIN,
    value: halfLifeInput,
    onChange: e => setHalfLifeInput(e.target.value),
    onKeyDown: e => { if (e.key === "Enter") handleSetHalfLife(); },
    "aria-label": "Balanced half-life in minutes",
    style: S.adminInput
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSetHalfLife,
    style: S.adminLoginBtn
  }, "Apply"), /*#__PURE__*/React.createElement("span", {
    style: S.adminConfigCurrent
  }, "current: " + halfLifeMin + "m")), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: S.adminConfigBar
  }, /*#__PURE__*/React.createElement("label", {
    style: S.adminConfigLabel,
    htmlFor: "qa-maxq"
  }, "Max questions per person — default 3"), /*#__PURE__*/React.createElement("input", {
    id: "qa-maxq",
    type: "number",
    min: MIN_MAX_PER_USER,
    max: MAX_MAX_PER_USER,
    value: maxPerUserInput,
    onChange: e => setMaxPerUserInput(e.target.value),
    onKeyDown: e => { if (e.key === "Enter") handleSetMaxPerUser(); },
    "aria-label": "Max questions per person",
    style: S.adminInput
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSetMaxPerUser,
    style: S.adminLoginBtn
  }, "Apply"), /*#__PURE__*/React.createElement("span", {
    style: S.adminConfigCurrent
  }, "current: " + maxPerUser)), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: S.adminConfigBar
  }, /*#__PURE__*/React.createElement("label", {
    style: S.adminConfigLabel,
    htmlFor: "qa-refresh"
  }, "Refresh interval (seconds) — default 15"), /*#__PURE__*/React.createElement("input", {
    id: "qa-refresh",
    type: "number",
    min: MIN_REFRESH_MS / 1000,
    max: MAX_REFRESH_MS / 1000,
    value: refreshSecInput,
    onChange: e => setRefreshSecInput(e.target.value),
    onKeyDown: e => { if (e.key === "Enter") handleSetRefresh(); },
    "aria-label": "Refresh interval in seconds",
    style: S.adminInput
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSetRefresh,
    style: S.adminLoginBtn
  }, "Apply"), /*#__PURE__*/React.createElement("span", {
    style: S.adminConfigCurrent
  }, "current: " + Math.round(refreshMs / 1000) + "s")), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: S.adminConfigBar
  }, /*#__PURE__*/React.createElement("label", {
    style: S.adminConfigLabel
  }, "Change admin password"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "New password (min 8)",
    "aria-label": "New admin password",
    value: changePw,
    onChange: e => { setChangePw(e.target.value); setChangePwMsg(""); },
    style: S.adminInput
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Confirm",
    "aria-label": "Confirm new password",
    value: changePw2,
    onChange: e => { setChangePw2(e.target.value); setChangePwMsg(""); },
    onKeyDown: e => { if (e.key === "Enter") doChangePassword(); },
    style: S.adminInput
  }), /*#__PURE__*/React.createElement("button", {
    onClick: doChangePassword,
    style: S.adminLoginBtn
  }, "Update"), changePwMsg && /*#__PURE__*/React.createElement("span", {
    style: S.adminConfigCurrent
  }, changePwMsg)), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: S.adminConfigBar
  }, /*#__PURE__*/React.createElement("label", {
    style: S.adminConfigLabel,
    htmlFor: "qa-redirect"
  }, "Redirect attendees to:"), /*#__PURE__*/React.createElement("input", {
    id: "qa-redirect",
    type: "url",
    placeholder: "https://poll.example/...",
    value: redirectAdminInput,
    onChange: e => setRedirectAdminInput(e.target.value),
    onKeyDown: e => { if (e.key === "Enter") handleSetRedirect(redirectAdminInput.trim()); },
    "aria-label": "Poll redirect URL",
    style: { ...S.adminInput, width: 240 }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleSetRedirect(redirectAdminInput.trim()),
    style: S.adminLoginBtn
  }, "Send"), redirectUrl && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleSetRedirect(""),
    style: S.resetBtn
  }, "Clear redirect"), redirectUrl && /*#__PURE__*/React.createElement("span", {
    style: S.adminConfigCurrent
  }, "active: " + redirectUrl)), /*#__PURE__*/React.createElement("main", {
    style: S.main
  }, /*#__PURE__*/React.createElement(SubmitForm, {
    remaining: maxPerUser - myCount,
    limit: maxPerUser,
    onSubmit: handleSubmit
  }), /*#__PURE__*/React.createElement("div", {
    style: S.sortBar
  }, /*#__PURE__*/React.createElement("span", {
    style: S.sortLabel
  }, sortedQuestions.length, " question", sortedQuestions.length !== 1 ? "s" : ""), /*#__PURE__*/React.createElement("div", {
    style: S.sortBtns
  }, /*#__PURE__*/React.createElement("button", {
    className: "sort-btn",
    onClick: () => setSortMode("balanced"),
    style: {
      ...S.sortBtn,
      ...(sortMode === "balanced" ? S.sortBtnActive : {})
    }
  }, "Balanced"), /*#__PURE__*/React.createElement("button", {
    className: "sort-btn",
    onClick: () => setSortMode("votes"),
    style: {
      ...S.sortBtn,
      ...(sortMode === "votes" ? S.sortBtnActive : {})
    }
  }, "Top Voted"), /*#__PURE__*/React.createElement("button", {
    className: "sort-btn",
    onClick: () => setSortMode("newest"),
    style: {
      ...S.sortBtn,
      ...(sortMode === "newest" ? S.sortBtnActive : {})
    }
  }, "Newest"))),(actionError || loadError) && /*#__PURE__*/React.createElement("div", {
    className: "qa-action-error",
    role: "alert"
  }, actionError || loadError), /*#__PURE__*/React.createElement("div", {
    style: S.questionsList
  }, sortedQuestions.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: S.emptyState
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 32,
      marginBottom: 8
    }
  }, "\uD83D\uDCAC"), /*#__PURE__*/React.createElement("p", {
    style: S.emptyText
  }, loadError ? "Couldn't load questions yet." : "No questions yet. Be the first to ask!")), sortedQuestions.map(q => {
    const voteCount = q.upvotes?.length || 0;
    const ownerId = q.authorUid || q.authorFingerprint;
    const hasVoted = (q.upvotes || []).includes(fingerprint);
    const isOwner = ownerId === fingerprint;
    const isEditing = editingId === q.id;
    const canEdit = isOwner && voteCount === 0 && !q.answered;
    // New-question fade — Balanced view only, never for answered cards.
    const showFade = sortMode === "balanced" && !q.answered;
    const f = showFade ? QARanking.freshness(q, Date.now(), NEW_WINDOW_MIN) : 0;
    const g = Math.round(255 - 13 * (1 - f));
    const dimStyle = showFade ? { background: "rgb(" + g + "," + g + "," + g + ")" } : {};
    return /*#__PURE__*/React.createElement("div", {
      key: q.id,
      ref: el => {
        if (el) cardRefs.current.set(q.id, el);
        else cardRefs.current.delete(q.id);
      },
      className: "card-wrap question-card",
      style: {
        ...S.cardWrap,
        ...dimStyle,
        ...(q.answered ? S.cardWrapAnswered : {})
      }
    }, q.answered && /*#__PURE__*/React.createElement("div", {
      style: S.answeredOverlay
    }, /*#__PURE__*/React.createElement("span", {
      style: S.answeredText
    }, "ANSWERED")), /*#__PURE__*/React.createElement("div", {
      style: S.voteCol
    }, /*#__PURE__*/React.createElement("button", {
      className: "vote-btn",
      onClick: () => {
        if (!isOwner) handleVote(q.id);
      },
      disabled: isOwner,
      style: {
        ...S.voteBtn,
        ...(isOwner ? S.voteBtnDisabled : {}),
        ...(hasVoted ? S.voteBtnActive : {})
      },
      title: isOwner ? "Can't vote on your own" : hasVoted ? "Remove vote" : "Upvote"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "none",
      style: {
        display: "block"
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M8 3L13 9H3L8 3Z",
      fill: hasVoted ? "#fff" : "#6b7280",
      stroke: hasVoted ? "#fff" : "#6b7280",
      strokeWidth: "1"
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        ...S.voteCount,
        ...(hasVoted ? S.voteCountActive : {})
      }
    }, voteCount)), /*#__PURE__*/React.createElement("div", {
      style: f > 0 ? { ...S.cardContent, paddingBottom: 14, paddingRight: 26 } : S.cardContent
    }, isEditing ? /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("textarea", {
        value: editingText,
        onChange: e => setEditingText(e.target.value.slice(0, MAX_Q_LENGTH)),
        rows: 3,
        "aria-label": "Edit your question",
        autoFocus: true,
        style: S.questionInput
      }),
      /*#__PURE__*/React.createElement("div", { style: S.editBtnRow },
        /*#__PURE__*/React.createElement("span", { style: S.charCount }, editingText.length, "/", MAX_Q_LENGTH),
        /*#__PURE__*/React.createElement("button", { onClick: () => { setEditingId(null); setEditingText(""); }, style: S.editCancelBtn }, "Cancel"),
        /*#__PURE__*/React.createElement("button", { onClick: () => handleEditSave(q.id), disabled: !editingText.trim(), style: S.editSaveBtn }, "Save"))
    ) : /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("p", { style: S.cardText }, q.text),
      /*#__PURE__*/React.createElement("div", { style: S.cardMeta },
        /*#__PURE__*/React.createElement("span", { style: S.authorName }, q.authorName),
        /*#__PURE__*/React.createElement("span", { style: S.dot }, "\xB7"),
        /*#__PURE__*/React.createElement("span", { style: S.timeAgo }, timeAgo(q.timestamp)),
        q.editedAt && /*#__PURE__*/React.createElement("span", { style: S.editedTag }, "\xB7 edited"),
        isOwner && /*#__PURE__*/React.createElement("span", { style: S.youBadge }, "you")))
    ), /*#__PURE__*/React.createElement("div", {
      style: S.cardActions
    }, canEdit && !isEditing && /*#__PURE__*/React.createElement("button", {
      className: "answer-btn",
      onClick: () => { setEditingId(q.id); setEditingText(q.text); },
      style: S.editBtn,
      title: "Edit your question"
    }, "\u270e"), isAdmin && /*#__PURE__*/React.createElement("button", {
      className: "answer-btn",
      onClick: () => handleAnswer(q.id),
      style: {
        ...S.answerBtn,
        ...(q.answered ? S.answerBtnActive : {})
      },
      title: q.answered ? "Unmark as answered" : "Mark as answered"
    }, "\u2713"), (isOwner || isAdmin) && /*#__PURE__*/React.createElement("button", {
      className: "delete-btn",
      onClick: () => handleDelete(q.id),
      style: S.deleteBtn,
      title: isAdmin && !isOwner ? "Delete (admin)" : "Delete your question"
    }, "\u2715")), f > 0 && /*#__PURE__*/React.createElement("span", {
      style: { ...S.newBadge, opacity: f }
    }, "new"));
  }))), showResetConfirm && /*#__PURE__*/React.createElement("div", {
    style: S.modalOverlay,
    onClick: () => setShowResetConfirm(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: S.modalBox,
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", {
    style: S.modalTitle
  }, "Reset All Questions"), /*#__PURE__*/React.createElement("p", {
    style: S.modalText
  }, "This will permanently delete all questions and votes. This action cannot be undone."), /*#__PURE__*/React.createElement("p", {
    style: S.modalPrompt
  }, "Type ", /*#__PURE__*/React.createElement("strong", null, "confirm"), " below to proceed:"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: resetInput,
    onChange: e => setResetInput(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") handleResetAll();
    },
    placeholder: "Type confirm",
    "aria-label": "Type confirm to delete all questions",
    style: S.modalInput,
    autoFocus: true
  }), /*#__PURE__*/React.createElement("div", {
    style: S.modalBtns
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowResetConfirm(false),
    style: S.modalCancelBtn
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: handleResetAll,
    disabled: resetInput.trim().toLowerCase() !== "confirm",
    style: {
      ...S.modalConfirmBtn,
      ...(resetInput.trim().toLowerCase() !== "confirm" ? {
        opacity: 0.4,
        cursor: "not-allowed"
      } : {})
    }
  }, "Delete Everything"))))));
}

// ============================================================
// STYLES
// ============================================================
const S = {
  page: {
    fontFamily: "'DM Sans', sans-serif",
    minHeight: "100vh",
    background: "#f8f7f4",
    color: "#1a1a2e"
  },
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    fontFamily: "'DM Sans', sans-serif",
    background: "#f8f7f4"
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 14
  },
  header: {
    background: "#1a1a2e",
    padding: "0 24px",
    position: "sticky",
    top: 0,
    zIndex: 100
  },
  headerInner: {
    maxWidth: 640,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.02em"
  },
  titleAccent: {
    color: "#f0c674"
  },
  demoBadge: {
    fontSize: 9,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#1a1a2e",
    background: "#f0c674",
    padding: "2px 7px",
    borderRadius: 4,
    marginLeft: 10,
    verticalAlign: "middle",
    position: "relative",
    top: -2
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  refreshBadge: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontVariantNumeric: "tabular-nums"
  },
  adminToggle: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: 18,
    cursor: "pointer",
    padding: 4
  },
  adminBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#f0c674",
    background: "rgba(240,198,116,0.15)",
    padding: "3px 8px",
    borderRadius: 4
  },
  adminLoginBar: {
    background: "#16162a",
    padding: "10px 24px",
    display: "flex",
    justifyContent: "center",
    gap: 8
  },
  adminInput: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    width: 160
  },
  adminLoginBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: "#f0c674",
    color: "#1a1a2e",
    cursor: "pointer"
  },
  main: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "20px 16px 60px"
  },
  submitCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "20px 20px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
    marginBottom: 24
  },
  rateNote: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 12,
    fontStyle: "italic"
  },
  nameRow: {
    marginBottom: 10
  },
  nameInput: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #e5e7eb",
    background: "#fafaf8",
    color: "#1a1a2e",
    transition: "border-color 0.15s, box-shadow 0.15s"
  },
  questionInput: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    lineHeight: 1.5,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #e5e7eb",
    background: "#fafaf8",
    color: "#1a1a2e",
    resize: "vertical",
    transition: "border-color 0.15s, box-shadow 0.15s"
  },
  submitRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 10,
    flexWrap: "wrap"
  },
  charCount: {
    fontSize: 11,
    color: "#9ca3af",
    marginRight: "auto"
  },
  usageNote: {
    fontSize: 11,
    color: "#9ca3af"
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: 500
  },
  submitBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    background: "#1a1a2e",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.15s ease"
  },
  sortBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    padding: "0 4px"
  },
  sortLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 500
  },
  sortBtns: {
    display: "flex",
    gap: 4
  },
  sortBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 6,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer"
  },
  sortBtnActive: {
    background: "#1a1a2e",
    color: "#fff",
    borderColor: "#1a1a2e"
  },
  questionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 20px"
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af"
  },
  cardWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: "#fff",
    borderRadius: 10,
    padding: "14px 16px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)",
    position: "relative"
  },
  voteCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    minWidth: 36,
    paddingTop: 2
  },
  voteBtn: {
    width: 32,
    height: 28,
    borderRadius: 6,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0
  },
  voteBtnActive: {
    background: "#1a1a2e",
    borderColor: "#1a1a2e"
  },
  voteBtnDisabled: {
    opacity: 0.3,
    cursor: "default"
  },
  voteCount: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    fontVariantNumeric: "tabular-nums"
  },
  voteCountActive: {
    color: "#1a1a2e"
  },
  cardContent: {
    flex: 1,
    minWidth: 0
  },
  cardText: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "#1a1a2e",
    marginBottom: 6,
    wordBreak: "break-word"
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  authorName: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280"
  },
  dot: {
    fontSize: 10,
    color: "#d1d5db"
  },
  timeAgo: {
    fontSize: 12,
    color: "#9ca3af"
  },
  youBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#1a1a2e",
    background: "rgba(26,26,46,0.07)",
    padding: "1px 6px",
    borderRadius: 4,
    marginLeft: 2
  },
  cardActions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 3
  },
  answerBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1.5px solid #d1d5db",
    background: "#fff",
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1
  },
  answerBtnActive: {
    background: "#16a34a",
    borderColor: "#16a34a",
    color: "#fff"
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "none",
    background: "rgba(220,38,38,0.08)",
    color: "#dc2626",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 1
  },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1.5px solid #d1d5db",
    background: "#fff",
    color: "#6b7280",
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    opacity: 1
  },
  editBtnRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 8
  },
  editCancelBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer"
  },
  editSaveBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: "#1a1a2e",
    color: "#fff",
    cursor: "pointer"
  },
  editedTag: {
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic"
  },
  newBadge: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "#c6a15b",
    pointerEvents: "none"
  },
  adminConfigBar: {
    background: "#16162a",
    padding: "8px 24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap"
  },
  adminConfigLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "'DM Sans', sans-serif"
  },
  adminConfigCurrent: {
    fontSize: 12,
    color: "#f0c674",
    fontVariantNumeric: "tabular-nums"
  },
  cardWrapAnswered: {
    opacity: 0.5,
    position: "relative",
    overflow: "hidden"
  },
  answeredOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    pointerEvents: "none"
  },
  answeredText: {
    fontFamily: "'Fraunces', serif",
    fontSize: 42,
    fontWeight: 700,
    color: "rgba(22,163,74,0.18)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    userSelect: "none",
    whiteSpace: "nowrap"
  },
  resetBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "#dc2626",
    background: "rgba(220,38,38,0.12)",
    border: "none",
    padding: "3px 8px",
    borderRadius: 4,
    cursor: "pointer"
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(2px)"
  },
  modalBox: {
    background: "#fff",
    borderRadius: 14,
    padding: "28px 28px 22px",
    maxWidth: 400,
    width: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)"
  },
  modalTitle: {
    fontFamily: "'Fraunces', serif",
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: 10
  },
  modalText: {
    fontSize: 14,
    lineHeight: 1.5,
    color: "#4b5563",
    marginBottom: 14
  },
  modalPrompt: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8
  },
  modalInput: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #e5e7eb",
    background: "#fafaf8",
    color: "#1a1a2e",
    marginBottom: 16
  },
  modalBtns: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end"
  },
  modalCancelBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 18px",
    borderRadius: 8,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer"
  },
  modalConfirmBtn: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
    transition: "opacity 0.15s"
  },
  redirectOverlay: {
    position: "fixed", inset: 0, background: "rgba(26,26,46,0.92)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, backdropFilter: "blur(3px)"
  },
  redirectBox: {
    background: "#fff", borderRadius: 16, padding: "32px 36px",
    maxWidth: 420, width: "90%", textAlign: "center",
    boxShadow: "0 24px 70px rgba(0,0,0,0.35)"
  },
  redirectEmoji: { fontSize: 40, marginBottom: 6 },
  redirectTitle: {
    fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700,
    color: "#1a1a2e", marginBottom: 8
  },
  redirectText: { fontSize: 14, color: "#4b5563", marginBottom: 20, fontVariantNumeric: "tabular-nums" },
  redirectBtns: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  redirectGoBtn: {
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#1a1a2e", color: "#fff", cursor: "pointer"
  },
  redirectStayBtn: {
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
    padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e5e7eb",
    background: "#fff", color: "#6b7280", cursor: "pointer"
  }
};

// ============================================================
// MOUNT
// ============================================================
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(QAVotingBoard, null));
