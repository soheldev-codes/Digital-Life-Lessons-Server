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

    // --- ADMIN ROUTES ---

    app.get("/admin/lessons", async (req, res) => {
      try {
        const lessons = await lessonsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.send(lessons);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.patch("/admin/lessons/feature/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const lesson = await lessonsCollection.findOne({
          _id: new ObjectId(id),
        });

        const result = await lessonsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              isFeatured: !lesson.isFeatured,
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.patch("/admin/lessons/review/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const lesson = await lessonsCollection.findOne({
          _id: new ObjectId(id),
        });

        const result = await lessonsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              isReviewed: !lesson.isReviewed,
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.delete("/admin/lessons/:id", async (req, res) => {
      try {
        const result = await lessonsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // --- USER ROUTES ---

    app.patch("/users/:id/role", async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        // validation
        if (!role) {
          return res.status(400).send({
            success: false,
            message: "Role is required",
          });
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role,
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        res.send({
          success: true,
          message: "Role updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/all-lessons", async (req, res) => {
      try {
        const lessons = await lessonsCollection.find().toArray();
        res.send(lessons);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/reports", async (req, res) => {
      try {
        const reports = await reportsCollection.find().toArray();
        res.send(reports);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;

        const amount = parseInt(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "bdt",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.patch("/users/premium/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const allUsers = await usersCollection.find().toArray();
        console.log("ALL USERS:", allUsers);

        const user = await usersCollection.findOne({ email });

        const result = await usersCollection.updateOne(
          { email },
          {
            $set: {
              isPremium: true,
            },
          },
        );

        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/reports", async (req, res) => {
      try {
        const reportData = req.body;

        const result = await reportsCollection.insertOne({
          ...reportData,
          createdAt: new Date(),
        });

        res.status(201).send({
          success: true,
          message: "Report submitted successfully",
          reportId: result.insertedId,
        });
      } catch (error) {
        console.error("Error submitting report:", error);
        res.status(500).send({
          success: false,
          message: "Failed to submit report",
        });
      }
    });

    //

    app.get("/dashboard/:email", async (req, res) => {
      try {
        const { email } = req.params;

        // user's created lessons
        const lessons = await lessonsCollection
          .find({ creatorEmail: email })
          .toArray();

        // favorite count
        const favoritesCount = await favoritesCollection.countDocuments({
          userEmail: email,
        });

        // total likes of all lessons
        const totalLikes = lessons.reduce((sum, lesson) => {
          return sum + (lesson.likes_count || 0);
        }, 0);

        res.send({
          totalLessons: lessons.length,
          favorites: favoritesCount,
          totalLikes,
        });
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    // --- LESSON ROUTES ---
    // ১. (Search, Filter, Sort)
    app.get("/lessons", async (req, res) => {
      const { category, emotionalTone, search } = req.query;
      let query = { visibility: "Public", isReviewed: true };
      if (category) query.category = category;
      if (emotionalTone) query.emotionalTone = emotionalTone;
      if (search) query.title = { $regex: search, $options: "i" };
      res.send(await lessonsCollection.find(query).toArray());
    });

    app.get("/lessons/featured", async (req, res) => {
      try {
        const result = await lessonsCollection
          .find({
            isFeatured: true,
            visibility: "Public",
          })
          .limit(6)
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.get("/lessons/most-saved", async (req, res) => {
      try {
        const lessons = await lessonsCollection
          .find({ visibility: "Public" })
          .sort({ saves_count: -1 })
          .limit(5)
          .toArray();

        res.send(lessons);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    //
    app.post("/add-lesson", async (req, res) => {
      const data = req.body;
      res.send(
        await lessonsCollection.insertOne({ ...data, createdAt: new Date() }),
      );
    });

    // Lession Details Page api

    app.get("/lessons/:id", async (req, res) => {
      const { id } = req.params;

      const lesson = await lessonsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(lesson);
    });

    //
    app.patch("/lessons/like/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { email } = req.body;

        const lesson = await lessonsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!lesson) {
          return res
            .status(404)
            .send({ success: false, message: "Lesson not found" });
        }

        //
        const likes = lesson.likes || [];

        let updatedLikes;
        if (likes.includes(email)) {
          updatedLikes = likes.filter((item) => item !== email);
        } else {
          updatedLikes = [...likes, email];
        }

        await lessonsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              likes: updatedLikes,
              reactionCount: updatedLikes.length,
            },
          },
        );

        res.send({
          success: true,
          likes: updatedLikes,
          reactionCount: updatedLikes.length,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });
    //

    app.post("/lessons/favorite/:lessonId", async (req, res) => {
      const { lessonId } = req.params;
      const email = req?.body?.email;
      console.log(email);

      const existing = await favoritesCollection.findOne({
        lessonId,
        userEmail: email,
      });

      if (existing) {
        await favoritesCollection.deleteOne({ _id: existing._id });

        await lessonsCollection.updateOne(
          { _id: new ObjectId(lessonId) },
          {
            $inc: {
              saves_count: -1,
            },
          },
        );

        return res.send({ removed: true });
      }

      await favoritesCollection.insertOne({
        lessonId,
        userEmail: email,
        createdAt: new Date(),
      });

      await lessonsCollection.updateOne(
        { _id: new ObjectId(lessonId) },
        {
          $inc: {
            saves_count: 1,
          },
        },
      );

      res.send({ added: true });
    });

    //

    app.get("/comments/:lessonId", async (req, res) => {
      const { lessonId } = req.params;

      const comments = await commentsCollection
        .find({ lesson_id: lessonId })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(comments);
    });

    app.post("/comments", async (req, res) => {
      try {
        const { lesson_id, text, user_name, user_photo, user_email } = req.body;

        const doc = {
          lesson_id,
          text,
          user_name,
          user_photo,
          user_email,
          createdAt: new Date(),
        };

        const result = await commentsCollection.insertOne(doc);

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: error.message });
      }
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

    //
    app.patch("/lessons/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.send(result);
    });

    //
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

    //
    app.patch("/admin/lesson/feature/:id", verifyToken, async (req, res) => {
      res.send(
        await lessonsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { isFeatured: true } },
        ),
      );
    });

    //
    // app.get("/admin/reports", verifyToken, async (req, res) => {
    //   res.send(await reportsCollection.find().toArray());
    // });

    app.get("/admin/reports", async (req, res) => {
      try {
        const reports = await reportsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.send(reports);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.delete("/admin/reports/lesson/:lessonId", async (req, res) => {
      try {
        const { lessonId } = req.params;

        const result = await reportsCollection.deleteMany({
          lesson_id: lessonId,
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.delete("/admin/reported-lessons/:lessonId", async (req, res) => {
      try {
        const { lessonId } = req.params;

        await lessonsCollection.deleteOne({
          _id: new ObjectId(lessonId),
        });

        await reportsCollection.deleteMany({
          lesson_id: lessonId,
        });

        res.send({
          success: true,
          message: "Lesson deleted",
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
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
