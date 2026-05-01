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
      formatReferencesAsTable(resultsContainer); 
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
  // ── Google Sign In ────────────────────────────────────────────
  document.getElementById("google-signin-btn")?.addEventListener("click", async () => {
    await _supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://episteme-mu.vercel.app/app.html"
      }
    });
  });
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

  // ── Password validation ──────────────────────────────────
      if (password.length < 8) {
          showAuthError("Password must be at least 8 characters."); return;
      }
      if (!/[A-Z]/.test(password)) {
        showAuthError("Password must contain at least one uppercase letter."); return;
      }
      if (!/[0-9]/.test(password)) {
        showAuthError("Password must contain at least one number."); return;
      }

  // ── Check if email already exists ───────────────────────
      const { data: existingUser } = await _supabase
        .from("profiles")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        showAuthError("An account with this email already exists. Please log in.");
        return;
      }

      const { data, error } = await _supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: "https://episteme-mu.vercel.app/app.html"
            },
          });
        if (error) throw error;

        // Profile is created automatically by the DB trigger (handle_new_user)
        closeAuth();

if (data.session) {
  // Email confirmation is OFF — user is logged in immediately
  updateUIForUser(data.user);
  loadHistory();
} else {
  // Email confirmation is ON — show a proper modal message
  authOverlay.classList.add("active");
  authForm.style.display = "none";
  document.querySelector(".auth-footer").style.display = "none";

  const confirmMsg = document.createElement("div");
  confirmMsg.id = "confirm-msg";
  confirmMsg.style.cssText = "text-align:center;padding:1.5rem 0;";
  confirmMsg.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-brown)" stroke-width="1.5" style="margin-bottom:1rem">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
    <h3 style="font-family:var(--font-display);color:var(--color-espresso);margin-bottom:0.5rem;">Check your inbox</h3>
    <p style="color:var(--color-brown);font-size:0.9rem;line-height:1.6;">
      We sent a confirmation link to<br>
      <strong>${email}</strong><br><br>
      Click the link in the email to activate your account.
    </p>
    <button id="confirm-close-btn" style="
      margin-top:1.5rem;
      padding:0.6rem 1.5rem;
      background:var(--color-espresso);
      color:var(--color-cream);
      border:none;
      border-radius:var(--radius-pill);
      cursor:pointer;
      font-weight:500;
    ">Got it</button>
  `;

  document.querySelector(".auth-modal").appendChild(confirmMsg);

  document.getElementById("confirm-close-btn").addEventListener("click", () => {
    // Clean up and close
    confirmMsg.remove();
    authForm.style.display = "block";
    document.querySelector(".auth-footer").style.display = "block";
    authOverlay.classList.remove("active");
  });
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

  // Move search bar to top
  searchWrapper.classList.add("active");
  // Hide status, clear old results
  statusContainer.classList.remove("active");
  resultsContainer.classList.remove("active");
  resultsContainer.innerHTML = "";

  // Set the query in the search bar
  searchInput.value = data.query;

  // Small delay so the layout transition completes before content appears
  setTimeout(() => {
    const markdown = data.report || "Report not found.";
    resultsContainer.innerHTML = marked.parse(markdown);
    formatReferencesAsTable(resultsContainer);
    resultsContainer.classList.add("active");

    resultsContainer.querySelectorAll("a").forEach(a => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });

    // Scroll workspace back to top
    document.querySelector(".workspace").scrollTop = 0;
  }, 300);
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

  function formatReferencesAsTable(container) {
  const headings = container.querySelectorAll("h2, h3");
  let refHeading = null;
  headings.forEach(h => {
    if (h.textContent.trim().toLowerCase() === "references") refHeading = h;
  });
  if (!refHeading) return;

  const refContainer = refHeading.nextElementSibling;
  if (!refContainer) return;

  const rawText = refContainer.innerText || refContainer.textContent;
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);


  const table = document.createElement("table");
  table.style.cssText = `
    width:100%; border-collapse:collapse; font-size:0.875rem;
    margin-top:1rem; font-family:var(--font-body);
  `;
  table.innerHTML = `
    <thead>
      <tr style="background:rgba(139,99,85,0.1);text-align:left;">
        <th style="padding:0.6rem 0.75rem;color:var(--color-espresso);font-weight:600;width:3%;">#</th>
        <th style="padding:0.6rem 0.75rem;color:var(--color-espresso);font-weight:600;width:42%;">Title</th>
        <th style="padding:0.6rem 0.75rem;color:var(--color-espresso);font-weight:600;width:28%;">Authors</th>
        <th style="padding:0.6rem 0.75rem;color:var(--color-espresso);font-weight:600;width:7%;">Year</th>
        <th style="padding:0.6rem 0.75rem;color:var(--color-espresso);font-weight:600;width:20%;">Link</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  lines.forEach(line => {
    const numMatch = line.match(/^\[(\d+)\]/);
    if (!numMatch) return;

    const num = numMatch[1];

    // Extract URL
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0].replace(/[.,)\]]+$/, "") : null;

    // Extract year
    const yearMatch = line.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : "—";

    // ── Key fix: split on "(YEAR). " to separate authors from title ──
    // Format is always: [N] Authors (Year). Title. URL
    let authors = "—";
    let title   = "—";

    const yearSplit = line.match(/^.*?\((\d{4})\)\.\s*/);
    if (yearSplit) {
      // Everything before "(Year). " is [N] + authors
      const beforeTitle = line.slice(0, yearSplit[0].length);
      // Everything after "(Year). " is title + URL
      let afterTitle = line.slice(yearSplit[0].length);

      // Remove URL from title
      afterTitle = afterTitle.replace(/https?:\/\/[^\s]+/, "").trim();
      afterTitle = afterTitle.replace(/\.$/, "").trim();
      title = afterTitle || "—";

      // Authors = beforeTitle minus [N] and (Year)
      authors = beforeTitle
        .replace(/^\[\d+\]\s*/, "")
        .replace(/\(\d{4}\)\.?\s*$/, "")
        .trim();
      authors = authors.replace(/[,.]$/, "").trim();
    } else {
      // Fallback — no year found, dump everything as title
      title = line
        .replace(/^\[\d+\]\s*/, "")
        .replace(/https?:\/\/[^\s]+/, "")
        .trim();
    }

    // Shorten long author lists
    const authorParts = authors.split(",").map(a => a.trim()).filter(Boolean);
    const displayAuthors = authorParts.length > 4
      ? authorParts.slice(0, 3).join(", ") + " et al."
      : authors;

    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid rgba(201,170,150,0.3)";
    row.innerHTML = `
      <td style="padding:0.6rem 0.75rem;color:var(--color-dusty);vertical-align:top;">${num}</td>
      <td style="padding:0.6rem 0.75rem;color:var(--color-espresso);vertical-align:top;font-weight:500;">${title}</td>
      <td style="padding:0.6rem 0.75rem;color:var(--color-brown);vertical-align:top;">${displayAuthors}</td>
      <td style="padding:0.6rem 0.75rem;color:var(--color-dusty);vertical-align:top;">${year}</td>
      <td style="padding:0.6rem 0.75rem;vertical-align:top;">
        ${url
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer"
               style="color:var(--color-brown);font-size:0.8rem;word-break:break-all;">
               View Paper ↗
             </a>`
          : "—"
        }
      </td>
    `;
    tbody.appendChild(row);
  });

  if (tbody.children.length > 0) refContainer.replaceWith(table);
  }

});