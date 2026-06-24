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
const authScene = document.getElementById("auth-scene");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const authToggleLink = document.getElementById("auth-toggle-link");
const authModeLabel = document.getElementById("auth-mode");
const authError = document.getElementById("auth-error");
const authSuccess = document.getElementById("auth-success");

const menuScene = document.getElementById("menu-scene");
const createScene = document.getElementById("create-scene");
const joinScene = document.getElementById("join-scene");
const createPlayers = document.getElementById("create-players");
const inviteCodeInput = document.getElementById("invite-code");
const copyInviteBtn = document.getElementById("copy-invite");
const simulateJoinBtn = document.getElementById("simulate-join");
const createStartBtn = document.getElementById("create-start-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const joinCodeInput = document.getElementById("join-code-input");
const createBackBtn = document.getElementById("create-back-btn");
const joinBackBtn = document.getElementById("join-back-btn");
const logoutBtn = document.getElementById("logout-btn");
const createUsername = document.getElementById("create-username");
const joinUsername = document.getElementById("join-username");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const battleScene = document.getElementById("battle-scene");

// ── State ────────────────────────────────────────────────────────────────────
let currentUser = null; // Supabase User object
let currentProfile = null; // row from public.profiles
let players = []; // [{name, id}]  in current lobby
let inviteCode = null;

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
    loginForm.style.display = "none";
    signupForm.style.display = "block";
    if (authModeLabel) authModeLabel.innerText = "Sign Up";
    if (authToggleLink) authToggleLink.innerText = "Click here to login.";
  } else {
    loginForm.style.display = "block";
    signupForm.style.display = "none";
    if (authModeLabel) authModeLabel.innerText = "Sign In";
    if (authToggleLink) authToggleLink.innerText = "Click here to register.";
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
  const email = document.getElementById("login-email")?.value?.trim();
  const password = document.getElementById("login-password")?.value;

  if (!email || !password) {
    showError("Please fill in email and password.");
    return;
  }

  const loginBtn = document.getElementById("login-btn");
  setLoading(loginBtn, true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

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
  const email = document.getElementById("signup-email")?.value?.trim();
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
    showSuccess(
      "Registration successful! Check your email to confirm your account.",
    );
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

  const profile = await fetchProfile(user.id);

  const username =
    profile?.username ||
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Player";

  currentProfile = { username };

  // Update UI after login
  if (authScene) authScene.style.display = "none";
  if (menuScene) menuScene.style.display = "flex";
  if (createUsername) createUsername.innerText = username;
  if (joinUsername) joinUsername.innerText = username;
}

// ── Menu Navigation ───────────────────────────────────────────────────────────

createBtn?.addEventListener("click", () => {
  if (menuScene) menuScene.style.display = "none";
  if (createScene) createScene.style.display = "flex";

  inviteCode = genInviteCode();
  if (inviteCodeInput) inviteCodeInput.value = inviteCode;

  players = [];
  if (currentUser) {
    players.push({
      name: currentProfile?.username || "Player",
      id: currentUser.id,
    });
  } else {
    players.push({ name: "Player_1", id: "me" });
  }

  renderPlayersCreate();
  updateStartButton();
});

joinBtn?.addEventListener("click", () => {
  if (menuScene) menuScene.style.display = "none";
  if (joinScene) joinScene.style.display = "flex";
});

logoutBtn?.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn("[auth] signOut error:", error.message);
});

createBackBtn?.addEventListener("click", () => {
  if (createScene) createScene.style.display = "none";
  if (menuScene) menuScene.style.display = "flex";
});

joinBackBtn?.addEventListener("click", () => {
  if (joinScene) joinScene.style.display = "none";
  if (menuScene) menuScene.style.display = "flex";
});

// ── Lobby Start ───────────────────────────────────────────────────────────────

createStartBtn?.addEventListener("click", () => {
  if (players.length < 2) {
    players.push({ name: "CPU", id: "cpu" });
  }

  const p1 = players[0]?.name || "Player 1";
  const p2 = players[1]?.name || "Player 2";
  const disp1 = document.getElementById("display-p1-name");
  const disp2 = document.getElementById("display-p2-name");
  if (disp1) disp1.innerText = p1;
  if (disp2) disp2.innerText = p2;

  if (createScene) createScene.style.display = "none";
  if (battleScene) battleScene.style.display = "flex";

  if (window.startGame) window.startGame();
});

joinRoomBtn?.addEventListener("click", () => {
  const code = joinCodeInput?.value?.trim();
  if (!code) return alert("Enter invite code");
  alert("Joined room: " + code + " (UI mock)");
  const btn = document.getElementById("join-ready-btn");
  if (btn) btn.disabled = false;
});

// ── Invite code system ────────────────────────────────────────────────────────

function genInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function renderPlayersCreate() {
  if (!createPlayers) return;
  createPlayers.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    const suffix = p.id === currentUser?.id ? " (you)" : "";
    li.innerText = p.name + suffix;
    createPlayers.appendChild(li);
  });
}

function updateStartButton() {
  if (createStartBtn) createStartBtn.disabled = players.length < 2;
}

copyInviteBtn?.addEventListener("click", () => {
  if (!inviteCode) return;
  navigator.clipboard?.writeText(inviteCode).then(() => {
    alert("Invite code copied: " + inviteCode);
  });
});

simulateJoinBtn?.addEventListener("click", () => {
  const other = {
    name: "Player_" + Math.floor(Math.random() * 1000),
    id: "sim_" + Date.now(),
  };
  players.push(other);
  renderPlayersCreate();
  updateStartButton();
});

// ── Supabase auth state listener ──────────────────────────────────────────────

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session?.user && !currentUser) {
    await handleSession(session.user);
  }
  if (event === "SIGNED_OUT") {
    currentUser = null;
    currentProfile = null;
    players = [];
    inviteCode = null;
    if (menuScene) menuScene.style.display = "none";
    if (authScene) authScene.style.display = "flex";
    setAuthMode("login");
  }
});

export {};
