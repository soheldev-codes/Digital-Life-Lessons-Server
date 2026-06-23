const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const Stripe = require("stripe");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// --- ROOT & START ---
app.get("/", (req, res) => res.send("Digital Life Lessons Server is Active!"));

app.listen(port, () => console.log(`Server running on port ${port}`));
