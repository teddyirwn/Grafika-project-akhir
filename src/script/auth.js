// Minimal client-side flow handling for auth -> lobby -> start (no socket.io yet)

// Elements
const authScene = document.getElementById("auth-scene");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const authToggleLink = document.getElementById("auth-toggle-link");
const authModeLabel = document.getElementById("auth-mode");

const lobbyScene = document.getElementById("lobby-scene");
const lobbyPlayers = document.getElementById("lobby-players");
const inviteCodeInput = document.getElementById("invite-code");
const copyInviteBtn = document.getElementById("copy-invite");
const simulateJoinBtn = document.getElementById("simulate-join");
const lobbyStartBtn = document.getElementById("lobby-start-btn");

let currentUser = null;
let players = [];
let inviteCode = null;

function genInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Tab switches
function setAuthMode(mode) {
  if (mode === "signup") {
    loginForm.style.display = "none";
    signupForm.style.display = "block";
    if (authModeLabel) authModeLabel.innerText = "Sign up";
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
  const isSignupVisible = signupForm.style.display === "block";
  setAuthMode(isSignupVisible ? "login" : "signup");
});

// default
setAuthMode("login");

// Fake auth handlers
document.getElementById("login-btn")?.addEventListener("click", () => {
  const username = document.getElementById("login-username").value || "Player";
  loginSuccess(username);
});

document.getElementById("signup-btn")?.addEventListener("click", () => {
  const username = document.getElementById("signup-username").value || "Player";
  signupSuccess(username);
});

function loginSuccess(username) {
  currentUser = username;
  // hide auth scene, show lobby
  authScene.style.display = "none";
  lobbyScene.style.display = "flex";
  document.getElementById("lobby-username").innerText = currentUser;

  // create invite code and add current user to players
  inviteCode = genInviteCode();
  const icInput = document.getElementById("invite-code");
  if (icInput) icInput.value = inviteCode;

  players = [{ name: currentUser, id: "me" }];
  renderPlayers();
  updateStartButton();
}

function signupSuccess(username) {
  // For now same as login
  loginSuccess(username);
}

function renderPlayers() {
  if (!lobbyPlayers) return;
  lobbyPlayers.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.id === "me" ? " (you)" : "");
    lobbyPlayers.appendChild(li);
  });
}

copyInviteBtn?.addEventListener("click", () => {
  if (!inviteCode) return;
  navigator.clipboard?.writeText(inviteCode).then(() => {
    alert("Invite code copied: " + inviteCode);
  });
});

simulateJoinBtn?.addEventListener("click", () => {
  // create fake other player
  const other = { name: "Player_" + Math.floor(Math.random() * 1000), id: Date.now() };
  players.push(other);
  renderPlayers();
  updateStartButton();
});

function updateStartButton() {
  const btn = document.getElementById("lobby-start-btn");
  if (players.length >= 2) btn.disabled = false;
  else btn.disabled = true;
}

// Start game from lobby (for now transfer to start-scene and then battle)
document.getElementById("lobby-start-btn")?.addEventListener("click", () => {
  // store player names into inputs for local game start
  const p1Input = document.getElementById("p1-name-input");
  const p2Input = document.getElementById("p2-name-input");
  if (p1Input && p2Input) {
    p1Input.value = players[0].name || "Player 1";
    p2Input.value = players[1].name || "Player 2";
  }

  // show start scene and trigger start
  document.getElementById("lobby-scene").style.display = "none";
  document.getElementById("start-scene").style.display = "flex";
  // emulate pressing start
  document.getElementById("start-btn").click();
});

// Optional: join by code input
document.getElementById("join-code-btn")?.addEventListener("click", () => {
  const code = document.getElementById("join-code-input").value?.trim();
  if (!code) return alert("Enter invite code");
  // in this UI-only version, check against current inviteCode
  if (code === inviteCode) {
    const other = { name: "Friend", id: Date.now() };
    players.push(other);
    renderPlayers();
    updateStartButton();
  } else {
    alert("Invite code not found (UI-only demo)");
  }
});

// Leave lobby
document.getElementById("leave-lobby")?.addEventListener("click", () => {
  players = [];
  inviteCode = null;
  document.getElementById("lobby-scene").style.display = "none";
  document.getElementById("auth-scene").style.display = "block";
});

// Lightweight defensive export to avoid module-top-level errors when imported multiple times
export {};
