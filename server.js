import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log(`[KONEKSI] User terhubung dengan ID: ${socket.id}`);

  // 1. Player Masuk Lobby
  socket.on("join_room", ({ code, username, role }) => {
    if (!code || !username) return;

    socket.join(code);
    if (!rooms[code]) rooms[code] = [];

    // Hapus data lama jika username ini sudah ada (untuk handle refresh page)
    rooms[code] = rooms[code].filter((p) => p.username !== username);

    // Masukkan player baru ke dalam database room server
    rooms[code].push({ id: socket.id, username, role });

    console.log(
      `[LOBBY SUKSES] ${username} masuk room [${code}] sebagai [${role}]`,
    );
    console.log(`Daftar Player Aktif di Room ${code}:`, rooms[code]);

    // Siarkan daftar pemain terbaru ke SEMUA orang di room tersebut
    io.to(code).emit("room_players", rooms[code]);
  });

  // 2. Host Memulai Game
  socket.on("start_game", ({ code }) => {
    console.log(`[GAME START] Room ${code} started!`);
    io.to(code).emit("game_started");
  });

  // 2b. Host Memulai Ronde Berikutnya
  socket.on("start_round", ({ code, round }) => {
    console.log(`[ROUND START] Room ${code} starting round ${round}`);
    io.to(code).emit("round_started", { round });
  });

  // 3. Sinkronisasi Gerakan/Posisi Realtime
  socket.on("sync_movement", ({ code, eventName, payload }) => {
    socket.to(code).emit(eventName, payload);
  });

  // 4. Player Keluar / Tutup Browser
  socket.on("disconnect", () => {
    for (const code in rooms) {
      const pId = rooms[code].findIndex((p) => p.id === socket.id);
      if (pId !== -1) {
        const disconnectedPlayer = rooms[code][pId];
        console.log(
          `[DISCONNECT] ${disconnectedPlayer.username} left room ${code}`,
        );
        rooms[code].splice(pId, 1);
        // Notify remaining players that opponent disconnected
        io.to(code).emit("opponent_disconnected", {
          username: disconnectedPlayer.username,
          role: disconnectedPlayer.role,
        });
        io.to(code).emit("room_players", rooms[code]);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("===================================================");
  console.log(`🚀 Socket.io server running on port ${PORT}`);
  console.log("===================================================");
});
