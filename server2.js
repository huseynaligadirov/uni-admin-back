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

    



let list = [];


for (let i = 200; i <= 600; i++) {
    fetch(`https://naa.edu.az/api/website-app/v1/posts/${i}/language/1`).then(res => res.json()).then(async data => {
         if (data && data.id) { 
            db.data.posts.push(data)
            await db.write();
    
        
       }
    });
}