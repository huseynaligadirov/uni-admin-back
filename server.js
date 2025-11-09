import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import multer from "multer";

// Allow all origins
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(cors());
// Serve static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const DB_PATH = path.join(__dirname, "db.json");

// Read db.json
function readData() {
  return JSON.parse(fs.readFileSync(DB_PATH));
}

// Write db.json
function writeData(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---------- Posts Endpoints ----------

// GET all posts
app.get("/api/posts", (req, res) => {
  const data = readData();
  res.json(data.posts);
});

// GET post by ID
app.get("/api/posts/:id", (req, res) => {
  const data = readData();
  const post = data.posts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json(post);
});

// POST new post with image upload
app.post("/api/posts", upload.single('image'), (req, res) => {
  const data = readData();
  
  // If there's an uploaded file, add the file path to the post
  const newPost = {
    id: Date.now(),
    ...req.body,
    image: req.file ? `/uploads/${req.file.filename}` : null  // store the image path
  };

  data.posts.push(newPost);
  writeData(data);
  res.status(201).json(newPost);
});

// PUT update post
app.put("/api/posts/:id", (req, res) => {
  const data = readData();
  const index = data.posts.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: "Post not found" });
  data.posts[index] = { ...data.posts[index], ...req.body };
  writeData(data);
  res.json(data.posts[index]);
});

// DELETE post
app.delete("/api/posts/:id", (req, res) => {
  const data = readData();
  const index = data.posts.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: "Post not found" });
  const deleted = data.posts.splice(index, 1);
  writeData(data);
  res.json(deleted[0]);
});

// ---------- Authors Endpoints ----------
app.get("/api/authors", (req, res) => {
  const data = readData();
  res.json(data.authors);
});

app.get("/api/authors/:username", (req, res) => {
  const data = readData();
  const author = data.authors.find(a => a.username === req.params.username);
  if (!author) return res.status(404).json({ message: "Author not found" });
  res.json(author);
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
