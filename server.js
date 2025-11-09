import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import multer from "multer";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

// Create uploads directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

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

// Add file filter for images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only image files.'), false);
  }
};

// Configure multer with storage and file filter
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const DB_PATH = path.join(__dirname, "db.json");

// Database functions
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH));
  } catch (error) {
    return { posts: [], authors: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Image Upload Endpoint
app.post("/api/upload", upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ imageUrl });
  } catch (error) {
    res.status(500).json({ message: "Error uploading file: " + error.message });
  }
});

// Posts Endpoints
app.get("/api/posts", (req, res) => {
  const data = readData();
  res.json(data.posts);
});

app.get("/api/posts/:id", (req, res) => {
  const data = readData();
  const post = data.posts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json(post);
});

app.post("/api/posts", (req, res) => {
  try {
    const data = readData();
    
    if (!req.body.title || !req.body.content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const slug = req.body.title
      .toLowerCase()
      .replace(/[əğıüçşö]/g, char => {
        const map = { ə: 'e', ğ: 'g', ı: 'i', ü: 'u', ç: 'c', ş: 's', ö: 'o' };
        return map[char];
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newPost = {
      id: Date.now(),
      title: req.body.title,
      slug: slug,
      category: req.body.category || 'News',
      status: req.body.status || 'Active',
      publishStatus: req.body.publishStatus || 'Draft',
      sharingTime: new Date().toLocaleString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      author: req.body.author,
      coverImage: req.body.coverImage || null,
      gallery: req.body.gallery || [],
      content: req.body.content
    };

    data.posts.push(newPost);
    writeData(data);
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ message: "Error creating post: " + error.message });
  }
});

app.put("/api/posts/:id", (req, res) => {
  try {
    const data = readData();
    const index = data.posts.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ message: "Post not found" });
    
    const updatedPost = {
      ...data.posts[index],
      ...req.body,
      updatedAt: new Date().toLocaleString()
    };
    
    data.posts[index] = updatedPost;
    writeData(data);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Error updating post: " + error.message });
  }
});

app.delete("/api/posts/:id", (req, res) => {
  try {
    const data = readData();
    const index = data.posts.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ message: "Post not found" });
    
    const deleted = data.posts.splice(index, 1)[0];
    writeData(data);
    res.json(deleted);
  } catch (error) {
    res.status(500).json({ message: "Error deleting post: " + error.message });
  }
});

// Authors Endpoints
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

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size is too large. Max size is 5MB.' });
    }
    return res.status(400).json({ message: "File upload error: " + error.message });
  } else if (error) {
    return res.status(500).json({ message: error.message });
  }
  next();
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));