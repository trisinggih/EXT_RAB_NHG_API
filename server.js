const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = 3111;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
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

// Secret key dari .env
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ================= AUTH =================

// REGISTER
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res
      .status(400)
      .json({ error: "Username, email & password wajib diisi" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, 5)",
      [username, email, hashedPassword],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res
              .status(400)
              .json({ error: "Username atau email sudah digunakan" });
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
  const { email, password } = req.body;

  if (!email || !password)
    return res
      .status(400)
      .json({ error: "Email & password wajib diisi" });

  db.query(
    "SELECT * FROM users WHERE role_id = 5 AND email = ?",
    [email],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0)
        return res.status(401).json({ error: "Email tidak ditemukan" });

      const user = rows[0];

      // Ganti $2y$ ke $2b$ jika perlu (tergantung bcrypt hash-nya)
      const hash = user.password.replace(/^\$2y\$/, "$2b$");
      const isMatch = await bcrypt.compare(password, hash);

      if (!isMatch)
        return res.status(401).json({ error: "Password salah" });

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ success: true, token });
    }
  );
});

// Middleware: proteksi JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Protected Route
app.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Halo, ini profil kamu!",
    user: req.user,
  });
});

app.get("/project", (req, res) => {
  db.query(
    `SELECT 
      p.*, 
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', pekerjaan.id,
          'name', pekerjaan.name
        )
      ) AS pekerjaan 
    FROM project p
    LEFT JOIN project_pekerjaan pp ON p.id = pp.project_id
    LEFT JOIN pekerjaan ON pp.pekerjaan_id = pekerjaan.id
    GROUP BY p.id`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results.map(project => ({
        ...project,
        pekerjaan: typeof project.pekerjaan === 'string'
          ? JSON.parse(project.pekerjaan)
          : (project.pekerjaan || [])
      })));

    }
  );
});

app.post("/simpanproject",(req, res) =>{

  const {name, description, client_id, start_date, end_date} = req.body;

  if (!name || !description || !client_id || !start_date || !end_date)
    return res
      .status(400)
      .json({ error: "Semua field wajib diisi" });

  db.query(
    "INSERT INTO project (name, description, client_id, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
    [name, description, client_id, start_date, end_date],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, projectId: result.insertId });
    }
  );

})


app.get("/clients", (req, res) => {
  db.query("SELECT * FROM client", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get("/pekerjaan", (req, res) => {
  db.query("SELECT * FROM pekerjaan", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get("/projectpekerjaan", (req, res) => {
  const { project_id } = req.query;

  let query = "SELECT a.*, b.name AS project_name FROM pekerjaan a LEFT JOIN project b ON a.project_id = b.id";
  const params = [];

  if (project_id) {
    query += " WHERE a.project_id = ?";
    params.push(project_id);
  }

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Folder untuk menyimpan file
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nama file unik
  },
});

const upload = multer({ storage });

app.post("/uploadfoto", upload.single("gambar"), (req, res) => {
  const { project_id, keterangan } = req.body;

  if (!project_id || !req.file)
    return res.status(400).json({ error: "Project ID dan gambar wajib diisi" });

  const gambar = req.file.filename;

  db.query(
    "INSERT INTO project_gambar (project_id, gambar, keterangan) VALUES (?, ?, ?)",
    [project_id, gambar, keterangan],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, gambarId: result.insertId });
    }
  );
});

// Jalankan server
app.listen(PORT, () =>
  console.log(`🚀 Server jalan di http://localhost:${PORT}`)
);
