// ---------------------------------------------------------------------------
// auth.js  –  Arena Clash authentication layer (Supabase)
//
// Responsibilities:
//   • Login  : supabase.auth.signInWithPassword
//   • Register: supabase.auth.signUp  +  insert into public.profiles
//   • Logout  : supabase.auth.signOut
//   • Session restore on page load (onAuthStateChange)
//   • Lobby   : invite-code system (invite_codes table) + real-time presence
// ---------------------------------------------------------------------------

import { supabase } from "../lib/supabase.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const authScene     = document.getElementById("auth-scene");
const loginForm     = document.getElementById("login-form");
const signupForm    = document.getElementById("signup-form");
const authToggleLink = document.getElementById("auth-toggle-link");
const authModeLabel = document.getElementById("auth-mode");
const authError     = document.getElementById("auth-error");
const authSuccess   = document.getElementById("auth-success");

const lobbyScene    = document.getElementById("lobby-scene");
const lobbyPlayers  = document.getElementById("lobby-players");
const inviteCodeInput = document.getElementById("invite-code");
const copyInviteBtn = document.getElementById("copy-invite");
const simulateJoinBtn = document.getElementById("simulate-join");
const lobbyStartBtn = document.getElementById("lobby-start-btn");

// ── State ────────────────────────────────────────────────────────────────────
let currentUser   = null;   // Supabase User object
let currentProfile = null;  // row from public.profiles
let players       = [];     // [{name, id}]  in current lobby
let inviteCode    = null;

// ── Utility: show / hide feedback messages ────────────────────────────────────
function showError(msg) {
  if (!authError) return;
  authError.textContent = msg;
  authError.style.display = "block";
  if (authSuccess) authSuccess.style.display = "none";
}
function showSuccess(msg) {
  if (!authSuccess) return;
  authSuccess.textContent = msg;
  authSuccess.style.display = "block";
  if (authError) authError.style.display = "none";
}
function clearMessages() {
  if (authError) authError.style.display = "none";
  if (authSuccess) authSuccess.style.display = "none";
}

// ── Utility: button loading state ─────────────────────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.origText = btn.dataset.origText || btn.textContent;
  btn.textContent = loading ? "Loading…" : btn.dataset.origText;
}

// ── Auth mode toggle (login ↔ signup) ─────────────────────────────────────────
function setAuthMode(mode) {
  clearMessages();
  if (mode === "signup") {
    loginForm.style.display  = "none";
    signupForm.style.display = "block";
    if (authModeLabel)   authModeLabel.innerText   = "Sign Up";
    if (authToggleLink)  authToggleLink.innerText  = "Click here to login.";
  } else {
    loginForm.style.display  = "block";
    signupForm.style.display = "none";
    if (authModeLabel)   authModeLabel.innerText   = "Sign In";
    if (authToggleLink)  authToggleLink.innerText  = "Click here to register.";
  }
}

authToggleLink?.addEventListener("click", (e) => {
  e.preventDefault();
  const isSignup = signupForm.style.display === "block";
  setAuthMode(isSignup ? "login" : "signup");
});

// Default view
setAuthMode("login");

// ── LOGIN ─────────────────────────────────────────────────────────────────────
document.getElementById("login-btn")?.addEventListener("click", async () => {
  clearMessages();
  const email    = document.getElementById("login-email")?.value?.trim();
  const password = document.getElementById("login-password")?.value;

  if (!email || !password) {
    showError("Please fill in email and password.");
    return;
  }

  const loginBtn = document.getElementById("login-btn");
  setLoading(loginBtn, true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  setLoading(loginBtn, false);

  if (error) {
    showError(error.message);
    return;
  }

  // onAuthStateChange will call loginSuccess automatically
  // but we call it manually here too for immediate feedback
  if (data?.user) {
    await handleSession(data.user);
  }
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
document.getElementById("forgot-link")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value?.trim();
  if (!email) {
    showError("Enter your email first, then click Forgot Password.");
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) showError(error.message);
  else showSuccess("Password reset email sent! Check your inbox.");
});

// ── REGISTER ──────────────────────────────────────────────────────────────────
document.getElementById("signup-btn")?.addEventListener("click", async () => {
  clearMessages();
  const username = document.getElementById("signup-username")?.value?.trim();
  const email    = document.getElementById("signup-email")?.value?.trim();
  const password = document.getElementById("signup-password")?.value;

  if (!username || !email || !password) {
    showError("Please fill in all fields.");
    return;
  }
  if (username.length < 2) {
    showError("Username must be at least 2 characters.");
    return;
  }
  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  const signupBtn = document.getElementById("signup-btn");
  setLoading(signupBtn, true);

  // 1. Create auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Save username in auth metadata so we can read it in the trigger/callback
      data: { username },
    },
  });

  if (error) {
    setLoading(signupBtn, false);
    showError(error.message);
    return;
  }

  // 2. If email confirmation is disabled (Supabase project setting), the user
  //    is returned immediately and we insert the profile row.
  //    If confirmation is enabled, data.user is null and we show a message.
  if (data?.user) {
    await upsertProfile(data.user.id, username);
    setLoading(signupBtn, false);
    await handleSession(data.user);
  } else {
    setLoading(signupBtn, false);
    showSuccess("Registration successful! Check your email to confirm your account.");
    setAuthMode("login");
  }
});

// ── Session helpers ───────────────────────────────────────────────────────────

/**
 * Fetch or create the profile row for the logged-in user.
 * public.profiles schema:
 *   id        uuid  (references auth.users.id)
 *   username  text  NOT NULL UNIQUE
 *   created_at timestamptz
 */
async function upsertProfile(userId, username) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, username }, { onConflict: "id" });

  if (error) console.warn("[auth] upsertProfile error:", error.message);
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("[auth] fetchProfile error:", error.message);
    return null;
  }
  return data;
}

async function handleSession(user) {
  currentUser = user;

  // Try to load username from profiles table
  const profile = await fetchProfile(user.id);

  // Fallback: username stored in auth metadata (set during signUp)
  const username =
    profile?.username ||
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Player";

  currentProfile = { username };

  // Hide auth, show lobby
  authScene.style.display = "none";
  lobbyScene.style.display = "flex";
  document.getElementById("lobby-username").innerText = username;

  // Generate invite code
  inviteCode = genInviteCode();
  if (inviteCodeInput) inviteCodeInput.value = inviteCode;

  players = [{ name: username, id: user.id }];
  renderPlayers();
  updateStartButton();
}

// ── Supabase auth state listener (restores session on page reload) ─────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session?.user && !currentUser) {
    await handleSession(session.user);
  }
  if (event === "SIGNED_OUT") {
    currentUser    = null;
    currentProfile = null;
    players        = [];
    inviteCode     = null;
    lobbyScene.style.display = "none";
    authScene.style.display  = "block";
    setAuthMode("login");
  }
});

// ── Invite code ───────────────────────────────────────────────────────────────
function genInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

copyInviteBtn?.addEventListener("click", () => {
  if (!inviteCode) return;
  navigator.clipboard?.writeText(inviteCode).then(() => {
    alert("Invite code copied: " + inviteCode);
  });
});

// ── Lobby UI ──────────────────────────────────────────────────────────────────
function renderPlayers() {
  if (!lobbyPlayers) return;
  lobbyPlayers.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name + (p.id === currentUser?.id ? " (you)" : "");
    lobbyPlayers.appendChild(li);
  });
}

function updateStartButton() {
  if (lobbyStartBtn) lobbyStartBtn.disabled = players.length < 2;
}

// Simulate a second player joining (local only — for testing)
simulateJoinBtn?.addEventListener("click", () => {
  const other = {
    name: "Player_" + Math.floor(Math.random() * 1000),
    id: "sim_" + Date.now(),
  };
  players.push(other);
  renderPlayers();
  updateStartButton();
});

// Join by invite code (UI-only check for now; extend with DB lookup if needed)
document.getElementById("join-code-btn")?.addEventListener("click", () => {
  const code = document.getElementById("join-code-input")?.value?.trim();
  if (!code) return alert("Enter an invite code first.");
  if (code === inviteCode) {
    const other = { name: "Friend", id: "join_" + Date.now() };
    players.push(other);
    renderPlayers();
    updateStartButton();
  } else {
    alert("Invite code not found.");
  }
});

// ── Start game from lobby ─────────────────────────────────────────────────────
lobbyStartBtn?.addEventListener("click", () => {
  const p1Input = document.getElementById("p1-name-input");
  const p2Input = document.getElementById("p2-name-input");
  if (p1Input) p1Input.value = players[0]?.name || "Player 1";
  if (p2Input) p2Input.value = players[1]?.name || "Player 2";

  document.getElementById("lobby-scene").style.display = "none";
  document.getElementById("start-scene").style.display = "flex";
  document.getElementById("start-btn")?.click();
});

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById("leave-lobby")?.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn("[auth] signOut error:", error.message);
  // onAuthStateChange handles the rest
});

export {};
