// Minimal client-side flow handling for auth -> menu -> create/join room (UI-only)

// Elements
const authScene = document.getElementById("auth-scene");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const authToggleLink = document.getElementById("auth-toggle-link");
const authModeLabel = document.getElementById("auth-mode");

const menuScene = document.getElementById("menu-scene");
const createScene = document.getElementById("create-scene");
const joinScene = document.getElementById("join-scene");
const createPlayers = document.getElementById("create-players");
const joinPlayers = document.getElementById("join-players");
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

let currentUser = null;
let players = [];
let inviteCode = null;

function genInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

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

setAuthMode("login");

loginBtn?.addEventListener("click", () => {
  const username = document.getElementById("login-username").value || "Player";
  loginSuccess(username);
});

signupBtn?.addEventListener("click", () => {
  const username = document.getElementById("signup-username").value || "Player";
  signupSuccess(username);
});

createBtn?.addEventListener("click", () => {
  menuScene.style.display = "none";
  createScene.style.display = "flex";

  // generate invite code and set into input
  inviteCode = genInviteCode();
  if (inviteCodeInput) inviteCodeInput.value = inviteCode;

  // reset players and add current user as host
  players = [];
  if (currentUser) players.push({ name: currentUser, id: "me" });
  else players.push({ name: "Player_1", id: "me" });

  renderPlayers();
  updateStartButton();
});

joinBtn?.addEventListener("click", () => {
  menuScene.style.display = "none";
  joinScene.style.display = "flex";
});

logoutBtn?.addEventListener("click", () => {
  menuScene.style.display = "none";
  authScene.style.display = "flex";
  setAuthMode("login");
});

createBackBtn?.addEventListener("click", () => {
  createScene.style.display = "none";
  menuScene.style.display = "flex";
});

joinBackBtn?.addEventListener("click", () => {
  joinScene.style.display = "none";
  menuScene.style.display = "flex";
});

createStartBtn?.addEventListener("click", () => {
  // ensure at least two players (add CPU if needed for local start)
  if (players.length < 2) {
    players.push({ name: "CPU", id: "cpu" });
  }

  // set display names in battle scene
  const p1 = players[0]?.name || "Player 1";
  const p2 = players[1]?.name || "Player 2";
  const disp1 = document.getElementById("display-p1-name");
  const disp2 = document.getElementById("display-p2-name");
  if (disp1) disp1.innerText = p1;
  if (disp2) disp2.innerText = p2;

  // show battle scene
  createScene.style.display = "none";
  if (battleScene) battleScene.style.display = "flex";

  // trigger global startGame if available (starts animation/audio)
  if (window.startGame) window.startGame();
});

joinRoomBtn?.addEventListener("click", () => {
  const code = joinCodeInput?.value?.trim();
  if (!code) return alert("Enter invite code");
  alert("Joined room: " + code + " (UI mock)");
  document.getElementById("join-ready-btn").disabled = false;
});

function loginSuccess(username) {
  currentUser = username;
  authScene.style.display = "none";
  menuScene.style.display = "flex";
  if (createUsername) createUsername.innerText = currentUser;
  if (joinUsername) joinUsername.innerText = currentUser;
}

function signupSuccess(username) {
  loginSuccess(username);
}

function renderPlayers() {
  if (!createPlayers) return;
  createPlayers.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.id === "me" ? " (you)" : "");
    createPlayers.appendChild(li);
  });
}

copyInviteBtn?.addEventListener("click", () => {
  if (!inviteCode) return;
  navigator.clipboard?.writeText(inviteCode).then(() => {
    alert("Invite code copied: " + inviteCode);
  });
});

simulateJoinBtn?.addEventListener("click", () => {
  const other = { name: "Player_" + Math.floor(Math.random() * 1000), id: Date.now() };
  players.push(other);
  renderPlayers();
  updateStartButton();
});

function updateStartButton() {
  const btn = document.getElementById("create-start-btn");
  if (!btn) return;
  btn.disabled = players.length < 2;
}

export {};
