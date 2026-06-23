const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- ROOT & START ---
app.get("/", (req, res) => res.send("Digital Life Lessons Server is Active!"));

app.listen(port, () => console.log(`Server running on port ${port}`));
