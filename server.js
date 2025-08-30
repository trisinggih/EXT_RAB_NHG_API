const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi koneksi MySQL
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "sususegar123?",
  database: "test_rab",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Secret key untuk JWT
const JWT_SECRET = "supersecretkey"; // sebaiknya taruh di .env

// ================= AUTH =================

// REGISTER
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username & password wajib diisi" });

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user ke DB
    db.query(
      "INSERT INTO user (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Username sudah digunakan" });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, userId: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username & password wajib diisi" });

  db.query("SELECT * FROM user WHERE username = ?", [username], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(401).json({ error: "User tidak ditemukan" });

    const user = rows[0];

    // Bandingkan password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Password salah" });

    // Generate JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ success: true, token });
  });
});

// Middleware proteksi route
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // simpan data user di req
    next();
  });
}

// Contoh route yang dilindungi
app.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "Halo, ini profil kamu!", user: req.user });
});

// Jalankan server
const PORT = 3111;
app.listen(PORT, () => console.log(`🚀 Server jalan di http://localhost:${PORT}`));
