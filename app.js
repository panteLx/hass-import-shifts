// app.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const axios = require("axios");

const app = express();

// Middleware für JSON‑Parsing und statische Dateien
app.use(express.json());
app.use(express.static(path.join(__dirname, "static")));

// Environment Variablen
const HA_URL = process.env.HA_URL;
const HA_TOKEN = process.env.HA_TOKEN;
let CALENDAR_ENTITY_IDS;
try {
  CALENDAR_ENTITY_IDS = JSON.parse(process.env.CALENDAR_ENTITY_IDS);
} catch (error) {
  console.error("Fehler beim Parsen von CALENDAR_ENTITY_IDS:", error);
  process.exit(1);
}

let shifts = {};

// Asynchrones Laden der shifts-Konfiguration
async function loadShifts() {
  try {
    const data = await fs.readFile("shifts_config.json", "utf-8");
    shifts = JSON.parse(data);
    console.log("Shifts-Konfiguration erfolgreich geladen.");
  } catch (error) {
    console.error("Fehler beim Laden der shifts-Konfiguration:", error);
    shifts = {};
  }
}
loadShifts();

// Hilfsfunktionen zur Formatierung
function formatName(name) {
  // Erster Buchstabe groß, Rest klein
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatShiftType(shiftType) {
  return shiftType.charAt(0).toUpperCase() + shiftType.slice(1).toLowerCase();
}

// Route: Startseite (liefert index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// API: Optionen abrufen
app.get("/api/options", (req, res) => {
  const names = Object.keys(CALENDAR_ENTITY_IDS).map((name) =>
    formatName(name)
  );
  let shiftTypes = [];
  const firstKey = Object.keys(shifts)[0];
  if (firstKey) {
    shiftTypes = Object.keys(shifts[firstKey]).map((shiftType) =>
      formatShiftType(shiftType)
    );
  }
  res.json({ names, shift_types: shiftTypes });
});

// API: Schichttypen für einen bestimmten Namen abrufen
app.get("/api/shift_types/:name", (req, res) => {
  const rawName = req.params.name.toLowerCase();
  if (shifts[rawName]) {
    const shiftTypes = Object.keys(shifts[rawName]);
    res.json({ shift_types: shiftTypes });
  } else {
    res.status(404).json({ shift_types: [] });
  }
});

// API: Schichten hinzufügen
app.post("/add_shifts", async (req, res) => {
  const shiftsData = req.body;
  const results = [];

  for (const shift of shiftsData) {
    const rawName = shift.name.toLowerCase();
    const rawShiftType = shift.shift_type.toLowerCase();
    const formattedName = formatName(rawName);
    const formattedShiftType = formatShiftType(rawShiftType);
    const dateStr = shift.date;

    // Validierung: Existenz von Name und Schichttyp prüfen
    if (
      !CALENDAR_ENTITY_IDS[rawName] ||
      !shifts[rawName] ||
      !shifts[rawName][rawShiftType]
    ) {
      results.push(
        `Unbekannter Name oder Schichttyp: ${formattedName}, ${formattedShiftType}`
      );
      continue;
    }

    const { start, end } = shifts[rawName][rawShiftType];
    const startDateTime = `${dateStr} ${start}`;
    const endDateTime = `${dateStr} ${end}`;
    const summary = `${formattedName}: ${formattedShiftType}`;
    const description = `Schicht von ${start} bis ${end}`;

    const url = `${HA_URL}/api/services/calendar/create_event`;
    const headers = {
      Authorization: `Bearer ${HA_TOKEN}`,
      "Content-Type": "application/json",
    };
    const data = {
      entity_id: CALENDAR_ENTITY_IDS[rawName],
      summary,
      description,
      start_date_time: startDateTime,
      end_date_time: endDateTime,
    };

    try {
      const response = await axios.post(url, data, { headers });
      if (response.status === 200) {
        results.push(`Ereignis hinzugefügt: ${summary} am ${dateStr}`);
      } else {
        results.push(
          `Fehler beim Hinzufügen von ${summary} am ${dateStr}: ${response.statusText}`
        );
      }
    } catch (error) {
      results.push(
        `Fehler beim Hinzufügen von ${summary} am ${dateStr}: ${
          error.response ? error.response.data : error.message
        }`
      );
    }
  }
  res.json(results);
});

// Server starten

app.listen(process.env.PORT || 3000, process.env.HOST || "127.0.0.1", () => {
  console.log(
    "Server läuft unter http://" + process.env.HOST + ":" + process.env.PORT
  );
});
