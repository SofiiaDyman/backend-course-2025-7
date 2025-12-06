require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

console.log('Hot reload test');

const program = new Command();

program
  .requiredOption("--host <host>", "Server host")
  .requiredOption("--port <port>", "Server port")
  .requiredOption("--cache <path>", "Cache directory");

program.parse(process.argv);

const options = program.opts();
const HOST = options.host;
const PORT = parseInt(options.port);
const CACHE_DIR = path.resolve(options.cache);

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const app = express();

// Парсинг JSON та URL-кодування
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Директорія для фото
const PHOTO_DIR = path.join(CACHE_DIR, "photos");
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR);

// Підключення до PostgreSQL
const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Multer для фото
const upload = multer({ dest: PHOTO_DIR });

// HTML форми
/**
 * @swagger
 * /RegisterForm.html:
 *   get:
 *     summary: Відкрити HTML форму для реєстрації пристрою
 *     responses:
 *       200:
 *         description: Форма успішно відкрито
 */
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

/**
 * @swagger
 * /SearchForm.html:
 *   get:
 *     summary: Відкрити HTML форму для пошуку пристрою
 *     responses:
 *       200:
 *         description: Форма успішно відкрито
 */
app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

// POST /register
/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового пристрою
 *     description: Додає новий пристрій з можливістю завантажити фото
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Ім’я пристрою (обов'язково)
 *               description:
 *                 type: string
 *                 description: Опис пристрою
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фото пристрою
 *     responses:
 *       201:
 *         description: Пристрій створено
 *       400:
 *         description: Не задано ім’я пристрою
 */
app.post("/register", upload.single("photo"), async (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).json({ error: "Name is required" });
  try {
    const result = await pool.query(
      "INSERT INTO inventory (item_name, details, photo) VALUES ($1, $2, $3) RETURNING *",
      [inventory_name, description || "", req.file ? req.file.filename : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory
/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список усіх інвентаризованих речей
 *     responses:
 *       200:
 *         description: Повертає JSON список всіх пристроїв
 */

app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM inventory ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Повернути інформацію про конкретний пристрій
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Унікальний ID пристрою
 *     responses:
 *       200:
 *         description: JSON з інформацією про пристрій
 *       404:
 *         description: Пристрій не знайдено
 *   put:
 *     summary: Оновити ім’я або опис пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Річ оновлена
 *       404:
 *         description: Річ не знайдена
 *   delete:
 *     summary: Видалити пристрій
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Річ видалена
 *       404:
 *         description: Річ не знайдена
 */
// GET /inventory/:id
app.get("/inventory/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM inventory WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /inventory/:id
app.put("/inventory/:id", async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      "UPDATE inventory SET item_name = COALESCE($1, item_name), details = COALESCE($2, details) WHERE id = $3 RETURNING *",
      [name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /inventory/:id
app.delete("/inventory/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM inventory WHERE id = $1 RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ status: "deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Повертає фото
 *       404:
 *         description: Фото або пристрій не знайдено
 *   put:
 *     summary: Оновити фото пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Річ не знайдена
 */

// GET /inventory/:id/photo
app.get("/inventory/:id/photo", async (req, res) => {
  try {
    const result = await pool.query("SELECT photo FROM inventory WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0 || !result.rows[0].photo) return res.status(404).json({ error: "Photo not found" });
    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(path.join(PHOTO_DIR, result.rows[0].photo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /inventory/:id/photo
app.put("/inventory/:id/photo", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });
  try {
    const result = await pool.query(
      "UPDATE inventory SET photo = $1 WHERE id = $2 RETURNING *",
      [req.file.filename, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /search
/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук пристрою за ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID пристрою
 *               has_photo:
 *                 type: string
 *                 description: Include photo if value is "on"
 *     responses:
 *       200:
 *         description: Повертає HTML з інформацією про річ
 *       404:
 *         description: Річ не знайдена
 */
app.post("/search", async (req, res) => {
  const { id, has_photo } = req.body;
  try {
    const result = await pool.query("SELECT * FROM inventory WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).send("<h1>Not found</h1>");
    const item = result.rows[0];
    let html = `<h1>${item.item_name}</h1><p>${item.details}</p>`;
    if (has_photo === "on" && item.photo) {
      html += `<img src="/inventory/${id}/photo" width="200">`;
    }
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>${err.message}</h1>`);
  }
});

// 405 Method Not Allowed
app.all("/", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));

// Опції для swagger
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "API для управління інвентаризацією пристроїв",
    },
    servers: [
      {
        url: `http://${HOST}:${PORT}`,
      },
    ],
  },
  apis: ["./index.js"], // тут вказуємо файл, де будуть коментарі
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Роут для перегляду документації
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Запуск сервера з host та port
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
