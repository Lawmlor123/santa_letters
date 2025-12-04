// server.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// 🔍 Diagnostic logger – shows every request
app.use((req, _res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

// 📄 Path to letters.csv
const CSV_PATH = path.join(__dirname, "letters.csv");

// ✨ Create CSV file if missing
if (!fs.existsSync(CSV_PATH)) {
  fs.writeFileSync(CSV_PATH, "Date,Name,Country,Email,Letter\n");
  console.log("✨ Created new letters.csv at:", CSV_PATH);
}

// 🎁 --- ROUTE 1: /save-letter ---
app.post("/save-letter", (req, res) => {
  try {
    const { name, country, email, letter } = req.body;
    console.log("📬 Letter endpoint hit; body:", req.body);

    if (!name || !country || !email || !letter) {
      console.warn("⚠️ Missing fields");
      return res.status(400).send({ status: "error", message: "Missing fields" });
    }

    const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
    const safeLetter = letter.replace(/"/g, '""');
    const line = `"${timestamp}","${name}","${country}","${email}","${safeLetter}"\n`;

    fs.appendFile(CSV_PATH, line, (err) => {
      if (err) {
        console.error("❌ Error writing letter:", err);
        return res
          .status(500)
          .send({ status: "error", message: "Could not save letter" });
      }
      console.log("✅ Letter saved to:", CSV_PATH);
      res.send({ status: "ok" });
    });
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    res.status(500).send({ status: "error" });
  }
});

// 🎅 --- ROUTE 2: /admin --- FINAL VERSION ---
app.get("/admin", (_req, res) => {
  if (!fs.existsSync(CSV_PATH)) return res.send("<h2>No letters yet!</h2>");

  const raw = fs.readFileSync(CSV_PATH, "utf-8").trim();
  const lines = [];
  let current = "";
  let inQuotes = false;

  // 🔍 Keep multi-line quoted records intact
  for (const line of raw.split(/\r?\n/)) {
    if (!inQuotes) current = line;
    else current += "\n" + line;
    const quoteCount = (current.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      lines.push(current);
      current = "";
      inQuotes = false;
    } else {
      inQuotes = true;
    }
  }

  const records = lines.slice(1); // skip header line
  const letters = records
    .filter((r) => r.trim().length)
    .map((r) => {
      const [Date, Name, Country, Email, Letter] = parseCSVLine(r);
      return { Date, Name, Country, Email, Letter };
    });

  const esc = (t) =>
    t?.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) || "";

  const rows = letters
    .map(
      (l) => `
        <tr>
          <td>${esc(l.Date)}</td>
          <td>${esc(l.Name)}</td>
          <td>${esc(l.Country)}</td>
          <td>${esc(l.Email)}</td>
          <td>${esc(l.Letter).replace(/\r?\n/g, "<br>")}</td>
        </tr>`
    )
    .join("");

  const html = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>🎅 Santa’s Inbox</title>
      <style>
        body { font-family: Arial, sans-serif; background:#fffaef; padding:20px; }
        h1 { text-align:center; color:#d62828; }
        table { border-collapse: collapse; width:100%; margin-top:20px; table-layout: fixed; word-wrap: break-word; }
        th, td { border: 1px solid #ccc; padding:8px; vertical-align: top; }
        th { background:#fcd5ce; }
        tr:nth-child(even){background:#fff1e6;}
        td:last-child { white-space: pre-wrap; }
        .refresh { text-align:center; margin-top:10px; }
        button { padding:8px 16px; background:#d62828; color:#fff; border:none; border-radius:6px; cursor:pointer; }
        button:hover { background:#b91c1c; }
      </style>
    </head>
    <body>
      <h1>🎅 Santa’s Inbox</h1>
      <p>Total Letters: ${letters.length}</p>
      <div class="refresh"><button onclick="location.reload()">🔄 Refresh Inbox</button></div>
      <table>
        <tr><th>Date</th><th>Name</th><th>Country</th><th>Email</th><th>Letter</th></tr>
        ${rows || "<tr><td colspan='5'>No letters yet</td></tr>"}
      </table>
    </body>
  </html>`;
  res.send(html);
});

// 🧰 Helper to parse a CSV line correctly
function parseCSVLine(line) {
  const matches = line.match(/("([^"]*)"|[^,]+)(?=,|$)/g);
  return matches ? matches.map((v) => v.replace(/^"|"$/g, "")) : [];
}

// 🌍 --- ROUTE 3: Static files ---
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎅 Santa server running on port ${PORT}`);
  console.log(`🧭 Visit http://localhost:${PORT}/ to write a letter`);
  console.log(`📬 Visit http://localhost:${PORT}/admin to see the inbox`);
});
