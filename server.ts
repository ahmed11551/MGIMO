import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("lingoflow.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    translation TEXT,
    transcription TEXT,
    example TEXT,
    example_translation TEXT,
    image_url TEXT,
    audio_url TEXT,
    category_id INTEGER REFERENCES categories(id),
    level INTEGER DEFAULT 0,
    next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE,
    words_learned INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0
  );
`);

// Migrations for existing DB
try { db.exec("ALTER TABLE words ADD COLUMN example_translation TEXT"); } catch {}
try { db.exec("ALTER TABLE words ADD COLUMN category_id INTEGER"); } catch {}

// Seed categories
const catCount = db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number };
if (catCount.c === 0) {
  db.exec(`
    INSERT INTO categories (name, sort_order) VALUES 
    ('Международное право', 1), ('Дипломатия', 2), ('Макроэкономика', 3), ('Политология', 4),
    ('Общая лексика', 5), ('Бизнес', 6), ('Медиа', 7);
  `);
}

// Seed MGIMO Vocabulary if empty
const wordCount = db.prepare("SELECT COUNT(*) as count FROM words").get() as { count: number };
if (wordCount.count === 0) {
  const mgimoWords = [
    { word: "Bilateral", translation: "Двусторонний", transcription: "/ˌbaɪˈlætərəl/", example: "The two countries signed a bilateral agreement on trade.", example_translation: "Две страны подписали двустороннее соглашение о торговле." },
    { word: "Jurisdiction", translation: "Юрисдикция", transcription: "/ˌdʒʊərɪsˈdɪkʃən/", example: "The court has no jurisdiction over cases outside the country.", example_translation: "Суд не имеет юрисдикции по делам за пределами страны." },
    { word: "Sovereignty", translation: "Суверенитет", transcription: "/ˈsɒvrɪnti/", example: "The nation fought hard to maintain its political sovereignty.", example_translation: "Нация боролась за сохранение своего политического суверенитета." },
    { word: "Consensus", translation: "Консенсус", transcription: "/kənˈsɛnsəs/", example: "The committee was unable to reach a consensus on the new policy.", example_translation: "Комитету не удалось достичь консенсуса по новой политике." },
    { word: "Mitigate", translation: "Смягчать, уменьшать", transcription: "/ˈmɪtɪɡeɪt/", example: "New measures were introduced to mitigate the economic crisis.", example_translation: "Были введены новые меры для смягчения экономического кризиса." },
    { word: "Paradigm", translation: "Парадигма, модель", transcription: "/ˈpærədaɪm/", example: "The discovery caused a paradigm shift in scientific thinking.", example_translation: "Открытие вызвало смену парадигмы в научном мышлении." },
    { word: "Leverage", translation: "Рычаг влияния, использовать", transcription: "/ˈliːvərɪdʒ/", example: "They have significant leverage in the negotiations.", example_translation: "У них значительный рычаг влияния на переговорах." },
    { word: "Ambiguous", translation: "Двусмысленный", transcription: "/æmˈbɪɡjuəs/", example: "The wording of the treaty is highly ambiguous.", example_translation: "Формулировки договора весьма двусмысленны." },
    { word: "Ratification", translation: "Ратификация", transcription: "/ˌrætɪfɪˈkeɪʃən/", example: "The treaty is awaiting ratification by the Senate.", example_translation: "Договор ожидает ратификации Сенатом." },
    { word: "Embargo", translation: "Эмбарго, запрет", transcription: "/ɪmˈbɑːɡəʊ/", example: "The UN imposed an arms embargo on the country.", example_translation: "ООН ввела эмбарго на поставки оружия в страну." }
  ];

  const insert = db.prepare("INSERT INTO words (word, translation, transcription, example, example_translation, level) VALUES (?, ?, ?, ?, ?, 1)");
  db.transaction(() => {
    for (const w of mgimoWords) {
      insert.run(w.word, w.translation, w.transcription, w.example, w.example_translation);
    }
  })();
}

async function startServer() {
  const app = express();
  // CORS for Vercel frontend (split deployment)
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
  app.use(express.json());
  const PORT = Number(process.env.PORT) || 3000;

  // API Routes
  app.get("/api/categories", (req, res) => {
    const cats = db.prepare("SELECT * FROM categories ORDER BY sort_order, name").all();
    res.json(cats);
  });

  app.get("/api/words", (req, res) => {
    const categoryId = req.query.category as string | undefined;
    const words = categoryId
      ? db.prepare("SELECT w.*, c.name as category_name FROM words w LEFT JOIN categories c ON w.category_id = c.id WHERE w.category_id = ? ORDER BY w.next_review ASC").all(categoryId)
      : db.prepare("SELECT w.*, c.name as category_name FROM words w LEFT JOIN categories c ON w.category_id = c.id ORDER BY w.next_review ASC").all();
    res.json(words);
  });

  app.post("/api/words", (req, res) => {
    const { word, translation, transcription, example, example_translation, image_url, category_id } = req.body;
    const info = db.prepare(
      "INSERT INTO words (word, translation, transcription, example, example_translation, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(word, translation, transcription, example, example_translation, image_url, category_id || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/words/:id", (req, res) => {
    db.prepare("DELETE FROM words WHERE id = ?").run(req.params.id);
    res.sendStatus(200);
  });

  // Random words for Telegram bot
  app.get("/api/words/random", (req, res) => {
    const count = Math.min(10, Math.max(1, parseInt(String(req.query.count || 3), 10) || 3));
    const categoryId = req.query.category_id as string | undefined;
    let rows: any[];
    if (categoryId) {
      rows = db.prepare(
        "SELECT w.id, w.word, w.translation, w.transcription, w.example, w.example_translation, c.name as category_name FROM words w LEFT JOIN categories c ON w.category_id = c.id WHERE w.category_id = ? ORDER BY RANDOM() LIMIT ?"
      ).all(categoryId, count);
    } else {
      rows = db.prepare(
        "SELECT w.id, w.word, w.translation, w.transcription, w.example, w.example_translation, c.name as category_name FROM words w LEFT JOIN categories c ON w.category_id = c.id ORDER BY RANDOM() LIMIT ?"
      ).all(count);
    }
    res.json({ words: rows });
  });

  // Bulk import (CSV, JSON, MGIMO bot format)
  app.post("/api/words/import", (req, res) => {
    try {
      const { format, data } = req.body;
      if (!data) return res.status(400).json({ error: "data required" });

      let items: { word: string; translation?: string; transcription?: string; example?: string; example_translation?: string; audio_url?: string; category_id?: number }[] = [];

      if (format === "json" && Array.isArray(data)) {
        items = data.map((w: any) => ({
          word: String(w.word || w.en || w.english || "").trim(),
          translation: String(w.translation || w.ru || w.russian || "").trim() || undefined,
          transcription: String(w.transcription || w.ipa || "").trim() || undefined,
          example: String(w.example || w.sentence || "").trim() || undefined,
          example_translation: String(w.example_translation || w.sentence_translation || "").trim() || undefined,
          audio_url: String(w.audio_url || w.url_audio || "").trim() || undefined,
          category_id: w.category_id != null ? Number(w.category_id) : undefined,
        })).filter((w) => w.word);
      } else if (format === "csv" && typeof data === "string") {
        const lines = data.trim().split(/\r?\n/);
        const header = lines[0]?.toLowerCase() || "";
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
          const word = parts[0] || "";
          if (!word) continue;
          const idx = (s: string) => header.includes(s) ? header.split(",").indexOf(s) : -1;
          items.push({
            word,
            translation: parts[idx("translation")] || parts[idx("ru")] || parts[1] || undefined,
            transcription: parts[idx("transcription")] || parts[idx("ipa")] || parts[2] || undefined,
            example: parts[idx("example")] || parts[idx("sentence")] || parts[3] || undefined,
            example_translation: parts[idx("example_translation")] || parts[idx("sentence_translation")] || parts[4] || undefined,
          });
        }
      } else if (format === "text" && typeof data === "string") {
        items = data
          .split(/\r?\n/)
          .map((line) => {
            // Поддержка: слово — перевод, слово - перевод, слово;перевод, слово\tперевод
            const [word, translation] = line.split(/\s*[—\-;]\s*|\t/).map((s) => s.trim());
            return { word: word || "", translation: translation || undefined };
          })
          .filter((w) => w.word);
      } else {
        return res.status(400).json({ error: "format must be json, csv, or text" });
      }

      const insert = db.prepare(
        "INSERT INTO words (word, translation, transcription, example, example_translation, audio_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      let imported = 0;
      db.transaction(() => {
        for (const w of items) {
          if (!w.word) continue;
          insert.run(w.word, w.translation || null, w.transcription || null, w.example || null, w.example_translation || null, w.audio_url || null, w.category_id || null);
          imported++;
        }
      })();

      res.json({ imported });
    } catch (e) {
      console.error("import error:", e);
      res.status(500).json({ error: "Import failed" });
    }
  });

  // Export words
  app.get("/api/words/export", (req, res) => {
    const format = (req.query.format as string) || "json";
    const words = db.prepare("SELECT w.*, c.name as category_name FROM words w LEFT JOIN categories c ON w.category_id = c.id ORDER BY w.word ASC").all() as any[];

    if (format === "csv") {
      const header = "word,translation,transcription,example,example_translation,category_name,level";
      const rows = words.map((w) =>
        [w.word, w.translation, w.transcription, w.example, w.example_translation, w.category_name, w.level]
          .map((v) => (v != null ? `"${String(v).replace(/"/g, '""')}"` : ""))
          .join(",")
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=mgimo-words.csv");
      res.send("\uFEFF" + header + "\n" + rows.join("\n"));
      return;
    }

    res.json(words);
  });

  app.post("/api/words/:id/review", (req, res) => {
    const { id } = req.params;
    const { quality } = req.body; // 0: Again, 1: Hard, 2: Good, 3: Easy
    
    const word = db.prepare("SELECT * FROM words WHERE id = ?").get(id) as { level: number } | undefined;
    if (!word) return res.status(404).send("Word not found");

    let nextLevel = word.level;
    if (quality === 0) nextLevel = 0;
    else if (quality === 1) nextLevel = Math.max(1, word.level);
    else if (quality === 2) nextLevel = word.level + 1;
    else if (quality === 3) nextLevel = word.level + 2;

    // SRS Intervals based on level
    const intervals = [1, 2, 4, 7, 14, 30, 60, 90, 180];
    const days = intervals[Math.min(nextLevel, intervals.length - 1)];
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + days);

    db.prepare("UPDATE words SET level = ?, next_review = ? WHERE id = ?").run(
      nextLevel,
      nextReview.toISOString(),
      id
    );

    // Update daily stats for streaks
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO stats (date, words_learned, streak) 
      VALUES (?, 1, 1) 
      ON CONFLICT(date) DO UPDATE SET words_learned = words_learned + 1
    `).run(today);

    res.json({ nextLevel, nextReview });
  });

  // AI API routes (lazy load to avoid crash when GEMINI_API_KEY is missing)
  app.post("/api/ai/word-details", async (req, res) => {
    try {
      const { getWordDetails } = await import("./src/services/geminiService");
      const { word } = req.body;
      if (!word) return res.status(400).json({ error: "word required" });
      const details = await getWordDetails(word);
      res.json(details);
    } catch (e) {
      console.error("word-details error:", e);
      res.status(500).json({ error: "AI service error" });
    }
  });

  app.post("/api/ai/word-image", async (req, res) => {
    try {
      const { generateWordImage } = await import("./src/services/geminiService");
      const { word } = req.body;
      if (!word) return res.status(400).json({ error: "word required" });
      const image = await generateWordImage(word);
      res.json({ image });
    } catch (e) {
      console.error("word-image error:", e);
      res.status(500).json({ error: "AI service error" });
    }
  });

  app.post("/api/ai/speech", async (req, res) => {
    try {
      const { generateSpeech } = await import("./src/services/geminiService");
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "text required" });
      const base64 = await generateSpeech(text);
      res.json({ base64 });
    } catch (e) {
      console.error("speech error:", e);
      res.status(500).json({ error: "AI service error" });
    }
  });

  app.post("/api/ai/story", async (req, res) => {
    try {
      const { generateSmartStory } = await import("./src/services/geminiService");
      const { words } = req.body;
      if (!Array.isArray(words)) return res.status(400).json({ error: "words array required" });
      const story = await generateSmartStory(words);
      res.json({ story });
    } catch (e) {
      console.error("story error:", e);
      res.status(500).json({ error: "AI service error" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { getChatResponse } = await import("./src/services/geminiService");
      const { message, history, targetWords } = req.body;
      if (!message) return res.status(400).json({ error: "message required" });
      const response = await getChatResponse(message, history || [], targetWords || []);
      res.json({ response });
    } catch (e) {
      console.error("chat error:", e);
      res.status(500).json({ error: "AI service error" });
    }
  });

  app.post("/api/ai/words-by-topic", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY не задан. Добавьте в .env" });
      }
      const { generateWordsByTopic } = await import("./src/services/geminiService");
      const { topic, count } = req.body;
      if (!topic) return res.status(400).json({ error: "topic required" });
      const words = await generateWordsByTopic(topic, count || 5);
      res.json({ words });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("words-by-topic error:", e);
      res.status(500).json({ error: msg.includes("API key") ? "Неверный GEMINI_API_KEY" : "AI service error" });
    }
  });

  app.get("/api/stats", (req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM words").get() as any;
    const due = db.prepare("SELECT COUNT(*) as count FROM words WHERE next_review <= CURRENT_TIMESTAMP").get() as any;
    const todayStr = new Date().toISOString().split("T")[0];
    const todayRow = db.prepare("SELECT words_learned FROM stats WHERE date = ?").get(todayStr) as { words_learned: number } | undefined;
    const todayReviewed = todayRow?.words_learned ?? 0;

    // Calculate streak
    const stats = db.prepare("SELECT date FROM stats ORDER BY date DESC LIMIT 30").all() as any[];
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < stats.length; i++) {
      const statDate = new Date(stats[i].date);
      statDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - statDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === i || diffDays === i + 1) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({ total: total.count, due: due.count, streak: currentStreak, todayReviewed });
  });

  // Health check for Railway/Render
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (existsSync(path.join(__dirname, "dist"))) {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  } else {
    // API-only deployment (e.g. Railway) — frontend on Vercel
    app.use((_req, res) => res.status(404).json({ error: "Not found. API-only deployment." }));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
