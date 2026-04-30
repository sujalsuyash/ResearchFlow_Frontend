/* =========================================
   app.js — Workspace Application Logic
   Full Supabase + FastAPI Integration
   ========================================= */

document.addEventListener("DOMContentLoaded", async () => {

  // ── DOM Elements ──────────────────────────────────────────────
  const searchWrapper    = document.getElementById("search-wrapper");
  const searchInput      = document.getElementById("search-input");
  const searchSubmit     = document.getElementById("search-submit");
  const statusContainer  = document.getElementById("status-container");
  const resultsContainer = document.getElementById("results-content");
  const newSearchBtn     = document.getElementById("new-search-btn");
  const historyList      = document.querySelector(".sidebar__history");

  // Auth modal elements
  const loginSidebarBtn  = document.querySelector(".login-btn");
  const historyLoginBtn  = document.getElementById("history-login-btn");
  const authOverlay      = document.getElementById("auth-overlay");
  const authClose        = document.getElementById("auth-close");
  const authForm         = document.getElementById("auth-form");
  const authToggleBtn    = document.getElementById("auth-toggle-btn");
  const authTitle        = document.getElementById("auth-title");
  const authSubtitle     = document.getElementById("auth-subtitle");
  const authSubmitBtn    = document.getElementById("auth-submit-btn");
  const authToggleText   = document.getElementById("auth-toggle-text");

  const API_BASE = "https://researchflow-production.up.railway.app";

  // ── Step timing config (seconds before each step activates) ──
  const STEP_DELAYS = [0, 10, 22, 38]; // steps 1–4 activate at these elapsed seconds


  // ══════════════════════════════════════════════════════════════
  //  SECTION 1 — Loading / Step UI
  // ══════════════════════════════════════════════════════════════

  let statusInterval = null;

  function startThinkingUI() {
    // Reset all steps to idle
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`step-${i}`);
      step.className = "status-step";
    }
    // Activate step 1 immediately
    document.getElementById("step-1").classList.add("current");
    statusContainer.classList.add("active");

    // Schedule each subsequent step
    const startTime = Date.now();
    statusInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      for (let i = 0; i < STEP_DELAYS.length; i++) {
        const stepEl = document.getElementById(`step-${i + 1}`);
        if (elapsed >= STEP_DELAYS[i]) {
          // Mark previous steps as done
          if (i > 0) {
            const prev = document.getElementById(`step-${i}`);
            if (prev.classList.contains("current")) {
              prev.classList.remove("current");
              prev.classList.add("done");
            }
          }
          // Activate this step if not already done
          if (!stepEl.classList.contains("done") && !stepEl.classList.contains("current")) {
            stepEl.classList.add("current");
          }
        }
      }
    }, 500);
  }

  function stopThinkingUI(success = true) {
    clearInterval(statusInterval);
    statusInterval = null;

    if (success) {
      // Mark all steps as done
      for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step-${i}`);
        step.className = "status-step done";
      }
      // Brief pause so user sees ✅ before hiding
      setTimeout(() => statusContainer.classList.remove("active"), 800);
    } else {
      statusContainer.classList.remove("active");
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  SECTION 2 — Research (POST → Poll → Render)
  // ══════════════════════════════════════════════════════════════

  async function executeSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Move search bar to top, clear old results
    searchWrapper.classList.add("active");
    resultsContainer.classList.remove("active");
    resultsContainer.innerHTML = "";
    startThinkingUI();
    searchSubmit.disabled = true;

    try {
      // ── POST: submit job ──────────────────────────────────────
      const postRes = await fetch(`${API_BASE}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to start research job.");
      }

      const { job_id } = await postRes.json();
      if (!job_id) throw new Error("No job ID returned from server.");

      // ── POLL: check status every 3 seconds ───────────────────
      let finalData = null;
      const MAX_POLLS = 60;  // 60 × 3s = 3 minutes max wait

      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        await sleep(3000);

        const pollRes = await fetch(`${API_BASE}/research/${job_id}`);
        if (!pollRes.ok) throw new Error("Polling failed — server error.");

        const data = await pollRes.json();
        const status = (data.status || "").toLowerCase();

        if (status === "done") {
          finalData = data;
          break;
        }
        if (status === "failed") {
          throw new Error(data.error || "Backend pipeline failed.");
        }
        // "pending" or "running" → keep polling
      }

      if (!finalData) throw new Error("Research timed out. The server may be under heavy load.");

      // ── RENDER: show the report ───────────────────────────────
      stopThinkingUI(true);

      const markdown = finalData.report || "No report was returned.";
      resultsContainer.innerHTML = marked.parse(markdown);
      resultsContainer.classList.add("active");

      // Open all links in a new tab
      resultsContainer.querySelectorAll("a").forEach(a => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });

      // ── SAVE to Supabase if user is logged in ─────────────────
      const { data: { session } } = await _supabase.auth.getSession();
      if (session) {
        await _supabase.from("research_history").insert({
          user_id:       session.user.id,
          query:         query,
          report:        finalData.report,
          paper_count:   finalData.paper_count  ?? null,
          total_seconds: finalData.total_seconds ?? null,
        });
        loadHistory(); // refresh sidebar
      }

    } catch (error) {
      console.error("Research error:", error);
      stopThinkingUI(false);

      const isCapacity = error.message.toLowerCase().includes("capacity")
                || error.message.toLowerCase().includes("failed")
                || error.message.toLowerCase().includes("exhausted")
                || error.message.toLowerCase().includes("providers")
                || error.message.toLowerCase().includes("rate limit");

      resultsContainer.innerHTML = isCapacity
        ? `<div style="text-align:center;padding:3rem 1rem;">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-brown)" stroke-width="2" style="margin-bottom:1rem"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             <h3 style="color:var(--color-espresso);font-family:var(--font-display);margin-bottom:0.5rem;">Researchers are currently at capacity</h3>
             <p style="color:var(--color-brown);font-size:0.95rem;">Our free-tier API providers are under heavy load. Please wait a few minutes and try again.</p>
           </div>`
        : `<p style="color:red;padding:2rem;">Error: ${error.message}</p>`;

      resultsContainer.classList.add("active");
    } finally {
      searchSubmit.disabled = false;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  // ══════════════════════════════════════════════════════════════
  //  SECTION 3 — Supabase Auth
  // ══════════════════════════════════════════════════════════════

  // ── Open / Close modal helpers ────────────────────────────────
  function openAuth()  { authOverlay.classList.add("active"); }
  function closeAuth() { authOverlay.classList.remove("active"); authForm.reset(); clearAuthError(); }

  loginSidebarBtn?.addEventListener("click", () => {
    const session = _supabase.auth.getSession();
    session.then(({ data: { session } }) => {
      if (session) {
        handleSignOut();
      } else {
        setAuthMode(true); // open as Log In
        openAuth();
      }
    });
  });

  historyLoginBtn?.addEventListener("click", () => { setAuthMode(true); openAuth(); });
  authClose?.addEventListener("click", closeAuth);
  authOverlay?.addEventListener("click", e => { if (e.target === authOverlay) closeAuth(); });

  // ── Toggle Login ↔ Signup ─────────────────────────────────────
  let isLoginMode = true;

  function setAuthMode(loginMode) {
    isLoginMode = loginMode;
    const nameField = document.getElementById("auth-name-field");

    if (loginMode) {
      authTitle.textContent       = "Welcome Back";
      authSubtitle.textContent    = "Log in to save your research history.";
      authSubmitBtn.textContent   = "Log In";
      authToggleText.textContent  = "Don't have an account?";
      authToggleBtn.textContent   = "Sign up";
      if (nameField) nameField.style.display = "none";
    } else {
      authTitle.textContent       = "Create Account";
      authSubtitle.textContent    = "Join to save and revisit your research.";
      authSubmitBtn.textContent   = "Sign Up";
      authToggleText.textContent  = "Already have an account?";
      authToggleBtn.textContent   = "Log in";
      if (nameField) nameField.style.display = "block";
    }
    clearAuthError();
  }

  authToggleBtn?.addEventListener("click", () => setAuthMode(!isLoginMode));

  // Inject a "Full Name" field for signup (hidden in login mode)
  // We add it dynamically so we don't break the existing HTML
  (function injectNameField() {
    const emailField = authForm.querySelector(".auth-field");
    if (!emailField || document.getElementById("auth-name-field")) return;

    const nameDiv = document.createElement("div");
    nameDiv.className = "auth-field";
    nameDiv.id = "auth-name-field";
    nameDiv.style.display = "none"; // hidden by default (login mode)
    nameDiv.innerHTML = `
      <label for="full-name">Full Name</label>
      <input type="text" id="full-name" placeholder="Your Name" />
    `;
    emailField.before(nameDiv);
  })();

  // Error display helper
  function showAuthError(msg) {
    let el = document.getElementById("auth-error");
    if (!el) {
      el = document.createElement("p");
      el.id = "auth-error";
      el.style.cssText = "color:#c0392b;font-size:0.85rem;margin-top:-0.5rem;margin-bottom:0.5rem;";
      authSubmitBtn.before(el);
    }
    el.textContent = msg;
  }

  function clearAuthError() {
    const el = document.getElementById("auth-error");
    if (el) el.textContent = "";
  }

  // ── Form Submit: real Supabase call ───────────────────────────
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthError();

    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const nameEl   = document.getElementById("full-name");
    const fullName = nameEl ? nameEl.value.trim() : "";

    authSubmitBtn.textContent = isLoginMode ? "Logging in…" : "Creating account…";
    authSubmitBtn.disabled = true;

    try {
      if (isLoginMode) {
        // ── SIGN IN ──────────────────────────────────────────────
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Update last_sign_in timestamp
        await _supabase
          .from("profiles")
          .update({ last_sign_in: new Date().toISOString() })
          .eq("id", data.user.id);

        closeAuth();
        updateUIForUser(data.user);
        loadHistory();

      } else {
        // ── SIGN UP ──────────────────────────────────────────────
        if (!fullName) { showAuthError("Please enter your full name."); return; }

        const { data, error } = await _supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;

        // Profile is created automatically by the DB trigger (handle_new_user)
        closeAuth();

        // Supabase may require email confirmation depending on your settings.
        // If "Confirm email" is OFF in Auth settings, user is logged in immediately.
        if (data.session) {
          updateUIForUser(data.user);
        } else {
          showTempMessage("Check your email to confirm your account!");
        }
      }

    } catch (error) {
      showAuthError(error.message || "Something went wrong. Please try again.");
    } finally {
      authSubmitBtn.textContent = isLoginMode ? "Log In" : "Sign Up";
      authSubmitBtn.disabled = false;
    }
  });

  // ── Sign Out ──────────────────────────────────────────────────
  async function handleSignOut() {
    await _supabase.auth.signOut();
    updateUIForGuest();
  }


  // ══════════════════════════════════════════════════════════════
  //  SECTION 4 — UI State: Logged In vs Guest
  // ══════════════════════════════════════════════════════════════

  function updateUIForUser(user) {
    const name = user.user_metadata?.full_name || user.email.split("@")[0];

  // Show greeting at top of sidebar
    let greeting = document.getElementById("sidebar-greeting");
    if (!greeting) {
        greeting = document.createElement("div");
        greeting.id = "sidebar-greeting";
        greeting.style.cssText = `
        font-size: 0.85rem;
        color: var(--color-espresso);
        font-weight: 600;
        margin-bottom: 1.5rem;
        padding: 0.6rem 0.75rem;
        background: rgba(139,99,85,0.08);
        border-radius: var(--radius-sm);
        `;
        // Insert after the "Back to Home" link
        const newBtn = document.getElementById("new-search-btn");
        newBtn.before(greeting);
    }
  greeting.textContent = ` Hello, ${name}`;

  loginSidebarBtn.textContent = "Sign Out";
  loginSidebarBtn.style.color = "var(--color-dusty)";
  loginSidebarBtn.style.borderColor = "transparent";

  if (historyLoginBtn) historyLoginBtn.style.display = "none";
    }

 function updateUIForGuest() {
  const greeting = document.getElementById("sidebar-greeting");
  if (greeting) greeting.remove();

  loginSidebarBtn.textContent = "Log In / Sign Up";
  loginSidebarBtn.style.color = "";
  loginSidebarBtn.style.borderColor = "";

  historyList.innerHTML = `<div class="history-item" id="history-login-btn">Sign in to save history</div>`;
  document.getElementById("history-login-btn")?.addEventListener("click", () => { setAuthMode(true); openAuth(); });
}

  function showTempMessage(msg) {
    const el = document.createElement("p");
    el.style.cssText = "color:var(--color-brown);font-size:0.85rem;padding:0.5rem 0;text-align:center;";
    el.textContent = msg;
    historyList.prepend(el);
    setTimeout(() => el.remove(), 6000);
  }


  // ══════════════════════════════════════════════════════════════
  //  SECTION 5 — Sidebar History
  // ══════════════════════════════════════════════════════════════

  async function loadHistory() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return;

  const { data: items, error } = await _supabase
    .from("research_history")
    .select("id, query, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !items?.length) {
    historyList.innerHTML = `<div class="history-item" style="pointer-events:none;color:var(--color-dusty);">No searches yet.</div>`;
    return;
  }

  historyList.innerHTML = items.map(item => `
    <div class="history-item" style="display:flex;align-items:center;justify-content:space-between;gap:0.25rem;" data-id="${item.id}">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;cursor:pointer;" class="history-item__text">
        ${escapeHtml(truncate(item.query, 30))}
      </span>
      <button class="history-item__delete" data-id="${item.id}" title="Delete" style="
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-dusty);
        padding: 0 0.15rem;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.2s, color 0.2s;
        line-height: 1;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join("");

  // Show/hide X on hover
  historyList.querySelectorAll(".history-item").forEach(el => {
    const btn = el.querySelector(".history-item__delete");
    el.addEventListener("mouseenter", () => btn.style.opacity = "1");
    el.addEventListener("mouseleave", () => btn.style.opacity = "0");
  });

  // Click text → load report
  historyList.querySelectorAll(".history-item__text").forEach(el => {
    el.addEventListener("click", () => loadHistoryItem(el.closest(".history-item").dataset.id));
  });

  // Click X → delete
  historyList.querySelectorAll(".history-item__delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await _supabase.from("research_history").delete().eq("id", id);
      loadHistory(); // refresh sidebar
    });
  });
  }

  async function loadHistoryItem(id) {
    const { data, error } = await _supabase
      .from("research_history")
      .select("query, report")
      .eq("id", id)
      .single();

    if (error || !data) return;

    searchInput.value = data.query;
    searchWrapper.classList.add("active");
    statusContainer.classList.remove("active");

    const markdown = data.report || "Report not found.";
    resultsContainer.innerHTML = marked.parse(markdown);
    resultsContainer.classList.add("active");

    resultsContainer.querySelectorAll("a").forEach(a => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  }


  // ══════════════════════════════════════════════════════════════
  //  SECTION 6 — Session Persistence (page reload)
  // ══════════════════════════════════════════════════════════════

  async function initSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
      updateUIForUser(session.user);
      loadHistory();
    }

    // Listen for auth changes (login/logout from any tab)
    _supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        updateUIForUser(session.user);
        loadHistory();
      } else {
        updateUIForGuest();
      }
    });
  }

  await initSession();


  // ══════════════════════════════════════════════════════════════
  //  SECTION 7 — Event Listeners
  // ══════════════════════════════════════════════════════════════

  searchSubmit.addEventListener("click", executeSearch);

  searchInput.addEventListener("keypress", e => {
    if (e.key === "Enter") { e.preventDefault(); executeSearch(); }
  });

  newSearchBtn.addEventListener("click", () => {
    searchWrapper.classList.remove("active");
    resultsContainer.classList.remove("active");
    statusContainer.classList.remove("active");
    clearInterval(statusInterval);
    searchInput.value = "";
    searchInput.focus();
  });


  // ══════════════════════════════════════════════════════════════
  //  SECTION 8 — Utility helpers
  // ══════════════════════════════════════════════════════════════

  function truncate(str, maxLen) {
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

});