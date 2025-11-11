import fs from "fs";
import path from "path";

const filePath = path.resolve("news.json");

if (!fs.existsSync(filePath)) {
  console.error("news.json not found at:", filePath);
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf8");
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("Failed to parse news.json:", e.message);
  process.exit(1);
}

if (!data || !Array.isArray(data.posts)) {
  console.error("Invalid news.json format. Expected { posts: [] }");
  process.exit(1);
}

let updated = 0;
for (const post of data.posts) {
  const val = post.activeStatus;
  if (val !== "active" && val !== "inactive") {
    post.activeStatus = "active";
    updated += 1;
  }
}

if (updated === 0) {
  console.log("No changes needed. All posts already have valid publishStatus.");
  process.exit(0);
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
console.log(`Updated ${updated} post(s) with publishStatus: "publish".`);


