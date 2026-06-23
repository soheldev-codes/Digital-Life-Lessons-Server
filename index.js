const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true },
});

async function run() {
  try {
    const db = client.db("LifeLessonsDB");
    const lessonsCollection = db.collection("lessons");
    const usersCollection = db.collection("user");
    const reportsCollection = db.collection("lessonsReports");
    const favoritesCollection = db.collection("favorites");
    const commentsCollection = db.collection("comments");

    // --- MIDDLEWARES ---
    const verifyToken = async (req, res, next) => {
      try {
        const authorization = req.headers.authorization;
        const token = authorization?.split(" ")[1];

        if (!token) return res.status(401).send({ message: "Unauthorized" });

        const { payload } = await jwtVerify(token, JWKS);

        // কনসোল লগ করে দেখুন payload এর ভেতরে ইমেইলটি কোথায় আছে
        console.log("Token Payload:", payload);

        req.user = payload; // এখানে আপনার ইমেইল পাওয়ার কথা
        next();
      } catch (error) {
        return res.status(401).send({ message: "Unauthorized" });
      }
    };

    app.get("/comments/:lessonId", async (req, res) => {
      const { lessonId } = req.params;

      const comments = await commentsCollection
        .find({ lessonId })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(comments);
    });

    //

    app.post("/comments", async (req, res) => {
      const { lessonId, text } = req.body;
      const user = req.user;

      const doc = {
        lessonId,
        text,
        userName: user.name,
        userEmail: user.email,
        createdAt: new Date(),
      };

      const result = await commentsCollection.insertOne(doc);

      res.send(result);
    });

    //

    app.get("/lessons/related/:category", async (req, res) => {
      const { category } = req.params;
      const exclude = req.query.exclude;

      const lessons = await lessonsCollection
        .find({
          category,
          _id: {
            $ne: new ObjectId(exclude),
          },
          visibility: "Public",
        })
        .limit(6)
        .toArray();

      res.send(lessons);
    });

    //

    app.patch("/lessons/views/:id", async (req, res) => {
      const { id } = req.params;

      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $inc: {
            views: 1,
          },
        },
      );

      res.send(result);
    });

    // --- DASHBOARD & PROFILE ---
    app.get("/my-lessons/user/:email", async (req, res) => {
      res.send(
        await lessonsCollection
          .find({ creatorEmail: req.params.email })
          .toArray(),
      );
    });

    // ২. লেসন আপডেট করার রাউট (Patch)
    app.patch("/lessons/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.send(result);
    });

    // ৩. লেসন ডিলিট করার রাউট
    app.delete("/lessons/:id", async (req, res) => {
      const id = req.params.id;
      const result = await lessonsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/admin/manage-lessons", verifyToken, async (req, res) => {
      res.send(await lessonsCollection.find().toArray());
    });

    // লেসন ফিচার করা
    app.patch("/admin/lesson/feature/:id", verifyToken, async (req, res) => {
      res.send(
        await lessonsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { isFeatured: true } },
        ),
      );
    });

    // রিপোর্ট করা লেসন দেখা
    app.get("/admin/reports", verifyToken, async (req, res) => {
      res.send(await reportsCollection.find().toArray());
    });

    // --- ROOT & START ---
    app.get("/", (req, res) =>
      res.send("Digital Life Lessons Server is Active!"),
    );

    app.listen(port, () => console.log(`Server running on port ${port}`));
  } finally {
  }
}
run().catch(console.dir);
