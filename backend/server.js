// backend/server.js
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());

// Serve the CSV file
app.get("/api/brain-data", (req, res) => {
    res.sendFile(path.join(__dirname, "yunping_brain.csv"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
