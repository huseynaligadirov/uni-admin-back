import express from "express";
import multer from "multer";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });
const db = new Low(new JSONFile("news.json"), { posts: [] });

// ✅ Enable CORS
app.use(cors());
app.use("/uploads", express.static("uploads"));

await db.read();

// ✅ POST — create new post
app.post(
  "/posts",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  async (req, res) => {
    const newPost = {
      id: nanoid(),
      title: req.body.title,
      slug: req.body.slug,
      category: req.body.category,
      language: req.body.language,
      htmlContent: req.body.htmlContent,
      coverImageLabel: req.body.coverImageLabel,
      coverImage: req.files["coverImage"]?.[0]?.path || null,
      galleryImages: req.files["galleryImages"]?.map((f) => f.path) || [],

      // Defaults
      status: "active",
      publishStatus: "public",
      author: "khayalmdli",
      createdAt: new Date().toISOString(),
    };

    db.data.posts.push(newPost);
    await db.write();

    res.status(201).json(newPost);
  }
);

// ✅ PUT — update existing post by ID
app.put(
  "/posts/:id",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    await db.read();

    const post = db.data.posts.find((p) => p.id === id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 🧩 Update fields conditionally
    post.title = req.body.title || post.title;
    post.slug = req.body.slug || post.slug;
    post.category = req.body.category || post.category;
    post.language = req.body.language || post.language;
    post.htmlContent = req.body.htmlContent || post.htmlContent;
    post.coverImageLabel = req.body.coverImageLabel || post.coverImageLabel;

    // 🖼 Update images only if re-uploaded
    if (req.files["coverImage"]?.length) {
      post.coverImage = req.files["coverImage"][0].path;
    }
    if (req.files["galleryImages"]?.length) {
      post.galleryImages = req.files["galleryImages"].map((f) => f.path);
    }

    // 🕒 Add updatedAt timestamp
    post.updatedAt = new Date().toISOString();

    await db.write();
    res.status(200).json(post);
  }
);

// GET — all posts with pagination
// GET — all posts with pagination and optional category filter
app.get("/posts", async (req, res) => {
  await db.read();

  // Parse query params
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category?.toLowerCase(); // "news" or "announcement"

  // Filter by category if provided
  let filteredPosts = db.data.posts;
  if (category === "news" || category === "announcement") {
    filteredPosts = filteredPosts.filter((post) => post.category.toLowerCase() === category);
  }

  const totalPosts = filteredPosts.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

  res.json({
    page,
    limit,
    total: totalPosts,
    totalPages: Math.ceil(totalPosts / limit),
    posts: paginatedPosts,
  });
});




const removeFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// DELETE — delete post by ID
app.delete("/posts/:id", async (req, res) => {
  const { id } = req.params;
  await db.read();
  const postIndex = db.data.posts.findIndex((p) => p.id === id);
  if (postIndex === -1) return res.status(404).json({ message: "Post not found" });

  const [removedPost] = db.data.posts.splice(postIndex, 1);

  // Remove associated files
  removeFile(removedPost.coverImage);
  removedPost.galleryImages.forEach(removeFile);

  await db.write();
  res.json({ message: "Post deleted successfully", post: removedPost });
});

// DELETE — delete all posts
app.delete("/posts", async (req, res) => {
  await db.read();
  db.data.posts.forEach((post) => {
    removeFile(post.coverImage);
    post.galleryImages.forEach(removeFile);
  });
  db.data.posts = [];
  await db.write();
  res.json({ message: "All posts deleted successfully" });
});


// ✅ GET — get single post
app.get("/posts/:id", async (req, res) => {
  await db.read();
  const post = db.data.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json(post);
});

app.listen(3000, () =>
  console.log("✅ Server running on http://localhost:3000")
);
