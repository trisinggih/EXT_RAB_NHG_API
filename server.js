const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
  host: "localhost",     
  user: "root",          
  password: "",          
  database: "rab_prod"     
});

// Tes koneksi
db.connect((err) => {
  if (err) {
    console.error("❌ Koneksi database gagal:", err);
  } else {
    console.log("✅ Terhubung ke MySQL");
  }
});

// ====== ROUTES ======

// GET semua data project dengan status 'Terbuka'
app.get("/project", (req, res) => {
  db.query("SELECT * FROM project WHERE status = 'Terbuka'", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.length ? results : []);
  });
});

// GET semua data pekerjaan
app.get("/pekerjaan", (req, res) => {
  db.query("SELECT * FROM pekerjaan", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.length ? results : []);
  });
});

// GET pekerjaan berdasarkan project_id
app.get("/project/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM project_pekerjaan WHERE project_id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.length ? results : []);
  });
});

// Jalankan server
const PORT = 3111;
app.listen(PORT, () => console.log(`🚀 Server jalan di http://localhost:${PORT}`));
