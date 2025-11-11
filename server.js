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

// ----------------------
// Multer Storage (keep extensions)
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

// ----------------------
// LowDB setup
// ----------------------
const db = new Low(new JSONFile("news.json"), { posts: [] });
await db.read();

// ----------------------
// Middleware
// ----------------------
app.use(cors());
app.use("/uploads", express.static("uploads"));
app.use(express.json());

// ----------------------
// Helper to remove files
// ----------------------
const removeFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// ----------------------
// Helper: extract plain text from Draft.js raw or HTML string
// ----------------------
const extractPlainText = (raw) => {
  if (!raw) return "";

  // If object: try Draft.js raw shape
  if (typeof raw === "object") {
    try {
      if (Array.isArray(raw.blocks)) {
        return raw.blocks.map(b => (b && b.text) ? String(b.text) : "").join(" ");
      }
    } catch (_) {
      // fall through
    }
    // Fallback stringify
    raw = JSON.stringify(raw);
  }

  if (typeof raw === "string") {
    // Try Draft.js JSON stored as string
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.blocks)) {
        return parsed.blocks.map(b => (b && b.text) ? String(b.text) : "").join(" ");
      }
    } catch (_) {
      // Not JSON; maybe HTML
    }
    // Strip HTML tags if present
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
};

// ----------------------
// POST — create new post
// ----------------------
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
      url: req.body.slug,
      category: req.body.category,
      language: req.body.language,
      htmlContent: req.body.htmlContent,
      coverImageLabel: req.body.coverImageLabel,
      coverImage: req.files["coverImage"]?.[0]?.path || null,
      galleryImages: req.files["galleryImages"]?.map((f) => f.path) || [],
      status: "active",
      publishStatus:
        req.body.publishStatus === "publish" || req.body.publishStatus === "draft"
          ? req.body.publishStatus
          : "draft",
      author: "khayalmdli",
      createdAt: new Date().toISOString(),
    };

    db.data.posts.push(newPost);
    await db.write();

    res.status(201).json(newPost);
  }
);

// ----------------------
// PUT — update existing post by ID
// ----------------------
app.put(
  "/posts/:id",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    await db.read();

    const posts = db.data.posts

    const post = posts.find((p) => p.id == id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.title = req.body.title || post.title;
    post.slug = req.body.slug || post.slug;
    post.category = req.body.category || post.category;
    post.language = req.body.language || post.language;
    post.htmlContent = req.body.htmlContent || post.htmlContent;
    post.coverImageLabel = req.body.coverImageLabel || post.coverImageLabel;
    if (req.body.publishStatus) {
      post.publishStatus =
        req.body.publishStatus === "publish" || req.body.publishStatus === "draft"
          ? req.body.publishStatus
          : post.publishStatus;
    }
    if (req.body.activeStatus) {
      post.activeStatus =
        req.body.activeStatus === "active" || req.body.activeStatus === "inactive"
          ? req.body.activeStatus
          : post.activeStatus;
    }

    if (req.files["coverImage"]?.length) {
      removeFile(post.coverImage);
      post.coverImage = req.files["coverImage"][0].path;
    }

    if (req.files["galleryImages"]?.length) {
      post.galleryImages.forEach(removeFile);
      post.galleryImages = req.files["galleryImages"].map((f) => f.path);
    }

    post.updatedAt = new Date().toISOString();
    await db.write();

    res.json(post);
  }
);

// ----------------------
// GET — single post by ID
// ----------------------
app.get("/posts/:id", async (req, res) => {

  
  await db.read();
  const posts = db.data.posts
  const post_founded = posts.find(x => x.id == req.params.id);

  console.log(post_founded);
  
  
  if (!post_founded) return res.status(404).json({ message: "Post not found" });
  res.json(post_founded);
});

// ----------------------
// GET — all posts with pagination, category filter, search
// ----------------------
app.get("/posts", async (req, res) => {
  await db.read();

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category?.toLowerCase();
  const search = req.query.search?.toLowerCase();
  const activeStatus = req.query.activeStatus?.toLowerCase();

  let filteredPosts = db.data.posts;

  if (category === "news" || category === "announcement") {
    filteredPosts = filteredPosts.filter(
      (post) => post.category.toLowerCase() === category
    );
  }
  if (activeStatus === "active" || activeStatus === "inactive") {
    filteredPosts = filteredPosts.filter(
      (post) => post.activeStatus.toLowerCase() === activeStatus
    );
  }

  if (search) {
    filteredPosts = filteredPosts.filter((post) => {
      const title = (post.title || "").toString().toLowerCase();
      if (title.includes(search)) return true;

      const plain = extractPlainText(post.htmlContent).toLowerCase();
      return plain.includes(search);
    });
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

// ----------------------
// DELETE — single post by ID
// ----------------------
app.delete("/posts/:id", async (req, res) => {
  const { id } = req.params;
  await db.read();
  const posts = db.data.posts;
  const index = posts.findIndex((p) => p.id == id);
  if (index == -1) return res.status(404).json({ message: "Post not found" });

  const [removedPost] = posts.splice(index, 1);

  removeFile(removedPost.coverImage);
  console.log(index, removedPost);
  
  if (removedPost.galleryImages?.length) {
    removedPost.galleryImages.forEach(removeFile);
  }

  await db.write();
  res.json({ message: "Post deleted successfully", post: removedPost });
});

// ----------------------
// DELETE — all posts
// ----------------------
app.delete("/posts", async (req, res) => {
  await db.read();

  const posts = db.data.posts;
  posts
  .forEach((post) => {
    removeFile(post.coverImage);
    post.galleryImages.forEach(removeFile);
  });
  db.data.posts = [];
  await db.write();
  res.json({ message: "All posts deleted successfully" });
});

// ----------------------
// Start server
// ----------------------
app.listen(3000, () =>
  console.log("✅ Server running on http://localhost:3000")
);
