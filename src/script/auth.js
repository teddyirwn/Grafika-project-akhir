import { supabase } from "../lib/supabase.js";
import { setupRoomChannel, sendStartGameSignal } from "./network.js";

const authScene = document.getElementById("auth-scene");
const menuScene = document.getElementById("menu-scene");
const createScene = document.getElementById("create-scene");
const joinScene = document.getElementById("join-scene");
const battleScene = document.getElementById("battle-scene");

const createPlayers = document.getElementById("create-players");
const joinPlayers = document.getElementById("join-players");
const inviteCodeInput = document.getElementById("invite-code");
const createStartBtn = document.getElementById("create-start-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const joinCodeInput = document.getElementById("join-code-input");
const logoutBtn = document.getElementById("logout-btn");

const createUsername = document.getElementById("create-username");
const joinUsername = document.getElementById("join-username");

const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const vsBotBtn = document.getElementById("vs-bot-btn");
const googleLoginBtn = document.getElementById("google-login-btn");

const registerConfirmModal = document.getElementById("register-confirm-modal");
const confirmRegisterBtn = document.getElementById("confirm-register-btn");
const oauthUsernameInput = document.getElementById("oauth-username");

let currentUser = null;
let currentProfile = null;
let sessionHandled = false; // Guard agar handleSession tidak dipanggil duplikat

googleLoginBtn?.addEventListener("click", async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/" },
  });
});

async function handleSession(user) {
  currentUser = user;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Auth] Failed to fetch profile:", error.message);
    return;
  }

  if (!profile) {
    if (authScene) authScene.style.display = "none";
    if (registerConfirmModal) registerConfirmModal.style.display = "flex";
    const googleName = user.user_metadata?.full_name?.split(" ")[0] || "User";
    if (oauthUsernameInput)
      oauthUsernameInput.value = googleName.substring(0, 12);
  } else {
    // Fetch points terpisah — agar tidak crash jika kolom belum ada
    let points = 0;
    try {
      const { data: pointsData } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", user.id)
        .single();
      if (pointsData?.points !== undefined) points = pointsData.points;
    } catch (_) {}

    currentProfile = { ...profile, points };

    // Cek apakah user sedang dalam pertarungan sebelum refresh
    const inBattle = sessionStorage.getItem("inBattle");
    const battleMode = sessionStorage.getItem("battleMode");
    const battleRole = sessionStorage.getItem("battleRole");

    if (inBattle === "true") {
      // Pulihkan state sebelum refresh
      window.isBotMode = battleMode === "bot";
      window.localRole = battleRole;

      // Sembunyikan semua scene UI
      if (authScene) authScene.style.display = "none";
      if (menuScene) menuScene.style.display = "none";
      if (createScene) createScene.style.display = "none";
      if (joinScene) joinScene.style.display = "none";

      // Langsung tampilkan battle scene dan mulai game
      if (battleScene) battleScene.style.display = "flex";
      if (window.startGame) {
        window.startGame();
      } else {
        // startGame belum siap, tunggu sebentar
        setTimeout(() => {
          if (window.startGame) window.startGame();
        }, 200);
      }
    } else {
      enterMainMenu(profile.username);
    }
  }
}

function enterMainMenu(username) {
  // Bersihkan flag battle saat masuk menu agar tidak terjebak loop ke battle
  sessionStorage.removeItem("inBattle");
  sessionStorage.removeItem("battleMode");
  sessionStorage.removeItem("battleRole");

  if (authScene) authScene.style.display = "none";
  if (registerConfirmModal) registerConfirmModal.style.display = "none";
  if (menuScene) menuScene.style.display = "flex";
  if (createUsername) createUsername.innerText = username;
  if (joinUsername) joinUsername.innerText = username;

  // Tampilkan username dan score di menu
  const menuUsernameEl = document.getElementById("menu-username-display");
  const menuScoreEl = document.getElementById("menu-score-display");
  if (menuUsernameEl) menuUsernameEl.innerText = username;
  if (menuScoreEl)
    menuScoreEl.innerText = `Points: ${currentProfile?.points ?? 0}`;
}

confirmRegisterBtn?.addEventListener("click", async () => {
  const username = oauthUsernameInput.value.trim();
  if (username.length < 2) return alert("Minimal 2 karakter");
  if (!currentUser) return alert("Sesi tidak valid, silakan login ulang.");

  const { error } = await supabase
    .from("profiles")
    .insert({ id: currentUser.id, username });
  if (error) {
    alert(error.message);
  } else {
    currentProfile = { username };
    enterMainMenu(username);
  }
});

// Tombol "Tidak" — tutup modal dan kembali ke halaman login
const cancelRegisterBtn = document.getElementById("cancel-register-btn");
cancelRegisterBtn?.addEventListener("click", async () => {
  // Sign out agar sesi OAuth tidak menggantung
  await supabase.auth.signOut();
  if (registerConfirmModal) registerConfirmModal.style.display = "none";
  showLoginPage();
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  // Langsung reset UI tanpa bergantung pada event SIGNED_OUT
  currentUser = null;
  currentProfile = null;
  sessionHandled = false;
  showLoginPage();
});

async function initAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    await handleSession(session.user);
  } else {
    showLoginPage();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      await handleSession(session.user);
    }
    if (event === "SIGNED_OUT") {
      currentUser = null;
      currentProfile = null;
      showLoginPage();
    }
  });
}

function showLoginPage() {
  // Bersihkan flag battle saat logout
  sessionStorage.removeItem("inBattle");
  sessionStorage.removeItem("battleMode");
  sessionStorage.removeItem("battleRole");

  if (menuScene) menuScene.style.display = "none";
  if (createScene) createScene.style.display = "none";
  if (joinScene) joinScene.style.display = "none";
  if (battleScene) battleScene.style.display = "none";
  if (registerConfirmModal) registerConfirmModal.style.display = "none";
  if (authScene) authScene.style.display = "flex";
}

// Copy invite code button
const copyInviteBtn = document.getElementById("copy-invite");
copyInviteBtn?.addEventListener("click", () => {
  const code = inviteCodeInput?.value;
  if (!code) return;
  navigator.clipboard
    .writeText(code)
    .then(() => {
      const feedback = document.getElementById("copy-feedback");
      if (feedback) {
        feedback.innerText = "✅ Code copied to clipboard!";
        setTimeout(() => {
          feedback.innerText = "";
        }, 2000);
      }
    })
    .catch(() => {
      // Fallback for browsers without clipboard API
      inviteCodeInput.select();
      document.execCommand("copy");
      const feedback = document.getElementById("copy-feedback");
      if (feedback) {
        feedback.innerText = "✅ Code copied!";
        setTimeout(() => {
          feedback.innerText = "";
        }, 2000);
      }
    });
});

// Leaderboard
const leaderboardBtn = document.getElementById("leaderboard-btn");
const leaderboardModal = document.getElementById("leaderboard-modal");
const closeLeaderboardBtn = document.getElementById("close-leaderboard-btn");

leaderboardBtn?.addEventListener("click", async () => {
  if (leaderboardModal) leaderboardModal.style.display = "flex";
  const listEl = document.getElementById("leaderboard-list");
  if (listEl)
    listEl.innerHTML =
      "<p style='text-align:center; color:#888'>Loading...</p>";

  // Try fetching with points, fallback to username only if points column missing
  let data, error;
  ({ data, error } = await supabase
    .from("profiles")
    .select("username, points")
    .order("points", { ascending: false })
    .limit(10));

  if (error) {
    // Fallback: fetch only username if points column doesn't exist yet
    ({ data, error } = await supabase
      .from("profiles")
      .select("username")
      .limit(10));
    if (data) data = data.map((p) => ({ ...p, points: 0 }));
  }

  if (error || !data) {
    if (listEl)
      listEl.innerHTML = `<p style='color:red; text-align:center'>Failed to load leaderboard.<br><small>${error?.message || ""}</small></p>`;
    return;
  }

  if (data.length === 0) {
    if (listEl)
      listEl.innerHTML =
        "<p style='text-align:center; color:#888'>No players yet.</p>";
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  listEl.innerHTML = data
    .map((p, i) => {
      const isCurrentUser = p.username === currentProfile?.username;
      const medal = medals[i] || `${i + 1}.`;
      return `<div class="leaderboard-row${isCurrentUser ? " leaderboard-row--me" : ""}">
      <span class="lb-rank">${medal}</span>
      <span class="lb-username">${p.username}${isCurrentUser ? " (You)" : ""}</span>
      <span class="lb-points">${p.points ?? 0} pts</span>
    </div>`;
    })
    .join("");
});

closeLeaderboardBtn?.addEventListener("click", () => {
  if (leaderboardModal) leaderboardModal.style.display = "none";
});

// Tombol Back dari create scene ke menu
const createBackBtn = document.getElementById("create-back-btn");
createBackBtn?.addEventListener("click", () => {
  sessionStorage.removeItem("inBattle");
  sessionStorage.removeItem("battleMode");
  sessionStorage.removeItem("battleRole");
  if (createScene) createScene.style.display = "none";
  if (menuScene) menuScene.style.display = "flex";
});

// Tombol Back dari join scene ke menu
const joinBackBtn = document.getElementById("join-back-btn");
joinBackBtn?.addEventListener("click", () => {
  sessionStorage.removeItem("inBattle");
  sessionStorage.removeItem("battleMode");
  sessionStorage.removeItem("battleRole");
  if (joinScene) joinScene.style.display = "none";
  if (menuScene) menuScene.style.display = "flex";
});

// Tombol tutup info/panduan
const closeInfoBtn = document.getElementById("close-info-btn");
const infoModal = document.getElementById("control-info-modal");
closeInfoBtn?.addEventListener("click", () => {
  if (infoModal) infoModal.style.display = "none";
});

// Tombol buka info/panduan dari berbagai scene
const infoMenuBtn = document.getElementById("info-menu-btn");
const infoP1Btn = document.getElementById("info-p1-btn");
const infoP2Btn = document.getElementById("info-p2-btn");

infoMenuBtn?.addEventListener("click", () => {
  if (infoModal) infoModal.style.display = "flex";
});

infoP1Btn?.addEventListener("click", () => {
  if (infoModal) infoModal.style.display = "flex";
});

infoP2Btn?.addEventListener("click", () => {
  if (infoModal) infoModal.style.display = "flex";
});

function genInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

createBtn?.addEventListener("click", () => {
  const namaAman =
    currentProfile?.username ||
    currentUser?.user_metadata?.full_name?.split(" ")[0] ||
    "Teddy";

  menuScene.style.display = "none";
  createScene.style.display = "flex";

  const code = genInviteCode();
  if (inviteCodeInput) inviteCodeInput.value = code;

  window.localRole = "p1";
  window.isBotMode = false;

  // Reset tombol start setiap kali room baru dibuat
  if (createStartBtn) createStartBtn.disabled = true;

  setupRoomChannel(
    code,
    namaAman,
    (players) => {
      if (createPlayers) {
        createPlayers.innerHTML = players
          .map(
            (p) =>
              `<li>⚔️ ${p.username} (${p.role === "p1" ? "Host" : "Player 2"})</li>`,
          )
          .join("");
      }
      if (createStartBtn) {
        createStartBtn.disabled = players.length < 2;
      }
      // Set username P1 dan P2 dari daftar players
      const p1 = players.find((p) => p.role === "p1");
      const p2 = players.find((p) => p.role === "p2");
      if (p1) window.player1Username = p1.username;
      if (p2) window.player2Username = p2.username;
    },
    () => {
      createScene.style.display = "none";
      if (battleScene) battleScene.style.display = "flex";
      if (window.startGame) window.startGame();
    },
  );
});

joinBtn?.addEventListener("click", () => {
  menuScene.style.display = "none";
  joinScene.style.display = "flex";
  window.localRole = "p2";
  window.isBotMode = false;
});

joinRoomBtn?.addEventListener("click", (e) => {
  e.preventDefault(); // Blokir pemuatan ulang halaman web bawaan browser
  const namaAman =
    currentProfile?.username ||
    currentUser?.user_metadata?.full_name?.split(" ")[0] ||
    "Kura";
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) return alert("Masukkan kode lobby!");

  setupRoomChannel(
    code,
    namaAman,
    (players) => {
      if (joinPlayers) {
        joinPlayers.innerHTML = players
          .map(
            (p) =>
              `<li>⚔️ ${p.username} (${p.role === "p1" ? "Host" : "Player 2"})</li>`,
          )
          .join("");
      }
      // Set username P1 dan P2 dari daftar players
      const p1 = players.find((p) => p.role === "p1");
      const p2 = players.find((p) => p.role === "p2");
      if (p1) window.player1Username = p1.username;
      if (p2) window.player2Username = p2.username;
    },
    () => {
      if (joinScene) joinScene.style.display = "none";
      if (battleScene) battleScene.style.display = "flex";
      if (window.startGame) window.startGame();
    },
  );
});

createStartBtn?.addEventListener("click", (e) => {
  e.preventDefault(); // Blokir pemuatan ulang halaman web bawaan browser
  if (window.players.length < 2) return alert("Menunggu Player 2 masuk!");

  sendStartGameSignal();

  setTimeout(() => {
    if (createScene) createScene.style.display = "none";
    if (battleScene) battleScene.style.display = "flex";
    if (window.startGame) window.startGame();
  }, 100);
});

vsBotBtn?.addEventListener("click", () => {
  window.isBotMode = true;
  window.localRole = "p1";
  // Set username untuk VS Bot mode
  window.player1Username = currentProfile?.username || "Player 1";
  window.player2Username = "BOT";
  menuScene.style.display = "none";
  if (battleScene) battleScene.style.display = "flex";
  if (window.startGame) window.startGame();
});

initAuth();
