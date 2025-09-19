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
  const { bulan, tahun } = req.query;

  if (!tahun) {
    return res.status(400).json({ error: "Parameter tahun wajib diisi" });
  }

  const bulanMap = {
    Januari: 1,
    Februari: 2,
    Maret: 3,
    April: 4,
    Mei: 5,
    Juni: 6,
    Juli: 7,
    Agustus: 8,
    September: 9,
    Oktober: 10,
    November: 11,
    Desember: 12,
  };

  let bulanNum = null;
  if (bulan && bulanMap[bulan]) {
    bulanNum = bulanMap[bulan];
  }

  let sql = `
    SELECT 
      p.*, 
      COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pekerjaan.id,
            'name', pekerjaan.name
          )
        ), JSON_ARRAY()
      ) AS pekerjaan 
    FROM project p
    LEFT JOIN project_pekerjaan pp ON p.id = pp.project_id
    LEFT JOIN pekerjaan ON pp.pekerjaan_id = pekerjaan.id
    WHERE YEAR(p.start_date) = ? OR YEAR(p.end_date) = ?
  `;

  const params = [tahun, tahun];

  if (bulanNum) {
    sql += `
      AND (
        MONTH(p.start_date) = ?
        OR MONTH(p.end_date) = ?
      )
    `;
    params.push(bulanNum, bulanNum);
  }

  sql += " GROUP BY p.id";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
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

app.post("/simpanproduct",(req, res) =>{

  const {keterangan, product_id, project_id} = req.body;

  if (!product_id || !project_id )
    return res
      .status(400)
      .json({ error: "Semua field wajib diisi" });

  db.query(
    "INSERT INTO project_product (keterangan, product_id, project_id) VALUES (?, ?, ?)",
    [keterangan, product_id, project_id],
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


app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get("/projectpekerjaan", (req, res) => {
  const { project_id } = req.query;

  let query = `
    SELECT 
        p.id,
        p.name AS project_name,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', pj.id,
                'pekerjaan_name', pkj.name,
                'detail', (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', d.id,
                            'tambahan', d.tambahan,
                            'estimasi_price', d.estimasi_price,
                            'jumlah', d.jumlah,
                            'satuan', d.satuan,
                            'rab', d.rab
                        )
                    )
                    FROM project_detail d
                    WHERE d.project_id = p.id
                      AND d.pekerjaan_id = pj.pekerjaan_id
                )
            )
        ) AS pekerjaan_list
    FROM project p
    LEFT JOIN project_pekerjaan pj ON pj.project_id = p.id
    LEFT JOIN pekerjaan pkj ON pkj.id = pj.pekerjaan_id
  `;

  const params = [];
  if (project_id) {
    query += " WHERE p.id = ? ";
    params.push(project_id);
  }

  query += " GROUP BY p.id, p.name;";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const formatted = results.map(row => {
      let pekerjaanList = [];
      if (row.pekerjaan_list) {
        try {
          pekerjaanList = JSON.parse(row.pekerjaan_list);
        } catch (e) {
          console.error("JSON parse error:", e.message);
        }
      }
      return { ...row, pekerjaan_list: pekerjaanList };
    });

    res.json(formatted);
  });
});



app.get("/projectgambar", (req, res) => {
  const { project_id } = req.query;

  let query = "SELECT a.*, b.name AS project_name FROM project_gambar a LEFT JOIN project b ON a.project_id = b.id";
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Jalankan server
app.listen(PORT, () =>
  console.log(`🚀 Server jalan di http://localhost:${PORT}`)
);
