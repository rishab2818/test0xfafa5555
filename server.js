const express = require("express");

const cors = require("cors");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
app.use(express.json());
app.use(cors());

const mongoose = require("mongoose");

mongoose
  .connect(
    "mongodb+srv://prorishab:prorishab@cluster0.0fmkg.mongodb.net/?retryWrites=true&tls=true"
  )
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Post Schema
const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  categories: { type: [String], required: true },
  author: { type: String, default: "Anonymous" },
  city: { type: String, default: "Anonymous" },
  likes: { type: Number, default: 0 },
  key: String,
  password: String,
  ctype: { type: String, default: "news" },
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model("Post", PostSchema);

// Answer Schema
const AnswerSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  content: { type: String, required: true },
  author: { type: String, default: "Anonymous" },
  likes: { type: Number, default: 0 }, // Add a likes field to the Answer Schema
  createdAt: { type: Date, default: Date.now },
});

const Answer = mongoose.model("Answer", AnswerSchema);

// Post routes
app.get("/posts", async (req, res) => {
  try {
    const { ctype } = req.query;
    let query = {};

    if (ctype) {
      query = { ctype };
    }

    const posts = await Post.find(query).sort({ _id: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Error fetching posts" });
  }
});

app.post("/post", async (req, res) => {
  try {
    const { title, content, categories, author, city, ctype } = req.body;
    if (
      !title ||
      !content ||
      !categories ||
      categories.length < 1 ||
      categories.length > 3
    ) {
      return res.status(400).json({ error: "Invalid post data" });
    }

    const key = Math.random().toString(36).slice(2);
    const password = Math.random().toString(36).slice(2);

    const post = new Post({
      title,
      content,
      categories,
      author: author?.trim() || "Anonymous",
      city: city?.trim() || "Anonymous",
      key,
      password,
      ctype: ctype || "news",
    });

    await post.save();
    res.status(201).json({ message: "Post created!", post });
  } catch (error) {
    res.status(500).json({ error: "Error creating post" });
  }
});

// Like Post
// Like Post
app.post("/like/:id", async (req, res) => {
  try {
    // Find the post by ID
    const post = await Post.findById(req.params.id);

    // Check if the post exists
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Increment the likes
    post.likes += 1;

    // Save the updated post to the database
    await post.save();

    // Send the updated likes count in the response
    res.json({ message: "Post liked!", likes: post.likes });
  } catch (error) {
    // Catch any errors and log them
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Error liking post" });
  }
});

// Like Answer
app.post("/like-answer/:id", async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer) return res.status(404).json({ error: "Answer not found" });

    answer.likes += 1;
    await answer.save();
    res.json({ message: "Answer liked!", likes: answer.likes });
  } catch (error) {
    res.status(500).json({ error: "Error liking answer" });
  }
});

// Claim Coins Route
app.post("/claim", async (req, res) => {
  const { key, password } = req.body;
  const post = await Post.findOne({ key, password });

  if (!post) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  if (post.likes < 10) {
    return res.status(400).json({ error: "Not enough likes to claim" });
  }

  const coinsToClaim = Math.floor(post.likes / 10);
  try {
    const response = await axios.post("http://localhost:5001/claim", {
      key,
      password,
      coins: coinsToClaim,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Blockchain error" });
  }
});

const GOOGLE_API_KEY = "AIzaSyDO6uao2tNI7d80H6ptzANqbGVkECcaS0I"; // Replace with your key

app.post("/generate-question", async (req, res) => {
  try {
    const { subject, topic, mergedTopics } = req.body;

    if (!subject) {
      return res.status(400).json({ error: "Subject is required" });
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Different question types
    const questionTypes = [
      "a current affairs-based question",
      "a thought-provoking question",
      "an analytical question",
      "a question inspired by previously asked UPSC Mains questions",
    ];

    // Randomly selecting a question type
    const selectedType =
      questionTypes[Math.floor(Math.random() * questionTypes.length)];

    // Constructing the AI prompt dynamically
    let prompt = `Generate ${selectedType} for UPSC Civil Services Mains on the subject '${subject}'`;

    if (topic) prompt += `, specifically related to the topic '${topic}'`;
    if (mergedTopics)
      prompt += `, while also incorporating '${mergedTopics}' for an interdisciplinary approach`;

    prompt += `. The question should be well-structured and suitable for a General Studies paper. Do NOT provide explanations or answers—only the question.`;

    const result = await model.generateContent(prompt);
    const question = result.response.text();

    res.json({ question });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Answer Routes
app.post("/answers", async (req, res) => {
  try {
    const { postId, content, author } = req.body;

    if (!postId || !content) {
      return res
        .status(400)
        .json({ error: "Post ID and content are required" });
    }

    const answer = new Answer({
      postId,
      content,
      author: author?.trim() || "Anonymous",
    });

    await answer.save();
    res.status(201).json({ message: "Answer submitted successfully", answer });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({ error: "Error submitting answer" });
  }
});

app.get("/answers", async (req, res) => {
  try {
    const { postId } = req.query;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    // Fetch and sort answers by likes in descending order
    const answers = await Answer.find({ postId }).sort({ likes: -1 });

    res.json(answers);
  } catch (error) {
    console.error("Error fetching answers:", error);
    res.status(500).json({ error: "Error fetching answers" });
  }
});

const PORT = 5000;
const HOST = "0.0.0.0"; // Allow access from all network devices

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
