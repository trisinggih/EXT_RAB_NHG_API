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
  password: "sususegar123?",          
  database: "test_rab"     
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
  db.query("SELECT a.*, b.name FROM project_pekerjaan as a join pekerjaan as b on a.pekerjaan_id = b.id WHERE a.project_id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.length ? results : []);
  });
});

app.post("/project/:id", (req, res) => {
  const { id, pekerjaan_id } = req.body;
  db.query(
    "INSERT INTO project_pekerjaan (project_id, pekerjaan_id) VALUES (?, ?)",
    [id, pekerjaan_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: result.insertId });
    }
  );
});

app.post("/pekerjaan/:id", (req, res) => {
  const projectId = req.params.id;
  const { product_id } = req.body;

  // Step 1: Ambil semua material dari produk terkait
  const selectQuery = "SELECT material_id, jumlah, estimasi_price FROM product WHERE id = ?";
  db.query(selectQuery, [product_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (rows.length === 0) {
      return res.status(404).json({ error: "Produk tidak ditemukan atau tidak memiliki material." });
    }

    // Step 2: Siapkan data insert untuk semua material
    const insertValues = rows.map((row) => [
      projectId,
      row.material_id,
      row.jumlah,
      row.estimasi_price,
    ]);

    const insertQuery = `
      INSERT INTO project_detail (project_id, material_id, jumlah, estimasi_price)
      VALUES ?
    `;

    // Step 3: Lakukan insert sekaligus
    db.query(insertQuery, [insertValues], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, inserted: result.affectedRows });
    });
  });
});



// Jalankan server
const PORT = 3111;
app.listen(PORT, () => console.log(`🚀 Server jalan di http://localhost:${PORT}`));
