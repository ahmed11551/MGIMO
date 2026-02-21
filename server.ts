import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("lingoflow.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    translation TEXT,
    transcription TEXT,
    example TEXT,
    image_url TEXT,
    audio_url TEXT,
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

// Seed MGIMO Vocabulary if empty
const wordCount = db.prepare("SELECT COUNT(*) as count FROM words").get() as { count: number };
if (wordCount.count === 0) {
  const mgimoWords = [
    { word: "Bilateral", translation: "Двусторонний", transcription: "/ˌbaɪˈlætərəl/", example: "The two countries signed a bilateral agreement on trade." },
    { word: "Jurisdiction", translation: "Юрисдикция", transcription: "/ˌdʒʊərɪsˈdɪkʃən/", example: "The court has no jurisdiction over cases outside the country." },
    { word: "Sovereignty", translation: "Суверенитет", transcription: "/ˈsɒvrɪnti/", example: "The nation fought hard to maintain its political sovereignty." },
    { word: "Consensus", translation: "Консенсус", transcription: "/kənˈsɛnsəs/", example: "The committee was unable to reach a consensus on the new policy." },
    { word: "Mitigate", translation: "Смягчать, уменьшать", transcription: "/ˈmɪtɪɡeɪt/", example: "New measures were introduced to mitigate the economic crisis." },
    { word: "Paradigm", translation: "Парадигма, модель", transcription: "/ˈpærədaɪm/", example: "The discovery caused a paradigm shift in scientific thinking." },
    { word: "Leverage", translation: "Рычаг влияния, использовать", transcription: "/ˈliːvərɪdʒ/", example: "They have significant leverage in the negotiations." },
    { word: "Ambiguous", translation: "Двусмысленный", transcription: "/æmˈbɪɡjuəs/", example: "The wording of the treaty is highly ambiguous." },
    { word: "Ratification", translation: "Ратификация", transcription: "/ˌrætɪfɪˈkeɪʃən/", example: "The treaty is awaiting ratification by the Senate." },
    { word: "Embargo", translation: "Эмбарго, запрет", transcription: "/ɪmˈbɑːɡəʊ/", example: "The UN imposed an arms embargo on the country." }
  ];

  const insert = db.prepare("INSERT INTO words (word, translation, transcription, example, level) VALUES (?, ?, ?, ?, 1)");
  db.transaction(() => {
    for (const w of mgimoWords) {
      insert.run(w.word, w.translation, w.transcription, w.example);
    }
  })();
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/words", (req, res) => {
    const words = db.prepare("SELECT * FROM words ORDER BY next_review ASC").all();
    res.json(words);
  });

  app.post("/api/words", (req, res) => {
    const { word, translation, transcription, example, image_url } = req.body;
    const info = db.prepare(
      "INSERT INTO words (word, translation, transcription, example, image_url) VALUES (?, ?, ?, ?, ?)"
    ).run(word, translation, transcription, example, image_url);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/words/:id", (req, res) => {
    db.prepare("DELETE FROM words WHERE id = ?").run(req.params.id);
    res.sendStatus(200);
  });

  app.post("/api/words/:id/review", (req, res) => {
    const { id } = req.params;
    const { quality } = req.body; // 0: Again, 1: Hard, 2: Good, 3: Easy
    
    const word = db.prepare("SELECT * FROM words WHERE id = ?").get() as any;
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

  app.get("/api/stats", (req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM words").get() as any;
    const due = db.prepare("SELECT COUNT(*) as count FROM words WHERE next_review <= CURRENT_TIMESTAMP").get() as any;
    
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

    res.json({ total: total.count, due: due.count, streak: currentStreak });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
