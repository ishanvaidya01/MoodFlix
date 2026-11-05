/**
 * scripts/prepare-data.js — fetch and unpack the MovieLens dataset locally.
 *
 * ml-latest-small (~1 MB): 9742 movies / 100,836 ratings, community dataset
 * from the GroupLens project (terms permit redistribution & research use).
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib"); // (unused placeholder removal later)

const DATA_DIR = path.join(__dirname, "..", "data");
const TARGET = path.join(DATA_DIR, "ml-latest-small");
const URL = process.env.MOODLENS_URL || "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip";

async function fetchRedirected(url) {
  let current = url;
  const { verbs } = { verbs: 0 };
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${current}`);
    return res;
  }
  throw new Error("Too many redirects");
}

/** minimal zip reader: locate `movies.csv` & `ratings.csv` & `links.csv` entries and inflate */
function extractNeeded(buf, dest) {
  const entries = [];
  /* EOCD-based central directory walk */
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && eocd === -1; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) eocd = i;
  }
  if (eocd === -1) throw new Error("Invalid zip (no EOCD)");
  const centralCount = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < centralCount; i++) {
    if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error("Invalid central directory");
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.slice(cdOffset + 46, cdOffset + 46 + nameLen).toString();
    entries.push({ name, method, compSize, localOffset });
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  for (const e of entries) {
    if (!["movies.csv", "ratings.csv", "links.csv"].some((want) => e.name.endsWith(want))) continue;
    const base = path.basename(e.name);
    /* local header */
    const lh = e.localOffset;
    if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error("Invalid local header");
    const nameLenL = buf.readUInt16LE(lh + 26);
    const extraLenL = buf.readUInt16LE(lh + 28);
    const dataStart = lh + 30 + nameLenL + extraLenL;
    const raw = buf.slice(dataStart, dataStart + e.compSize);
    const out = e.method === 0 ? raw : raw.length ? zlib.inflateRawSync(raw) : Buffer.alloc(0);
    const outPath = path.join(dest, base);
    fs.writeFileSync(outPath, out);
    console.log(`extracted ${base} -> ${outPath} (${out.length} bytes)`);
  }
}

(async () => {
  fs.mkdirSync(TARGET, { recursive: true });

  if (fs.existsSync(path.join(TARGET, "movies.csv")) && fs.existsSync(path.join(TARGET, "ratings.csv"))) {
    console.log("Dataset already present — nothing to do.");
    process.exit(0);
  }

  console.log(`Downloading ${URL} ...`);
  const res = await fetchRedirected(URL);
  const zip = Buffer.from(await res.arrayBuffer());
  console.log(`zip: ${(zip.length / 1e6).toFixed(2)} MB`);
  extractNeeded(zip, TARGET);
  console.log("Done.");
})().catch((err) => {
  console.error(err.message);
  console.error("Fallback: download ml-latest-small.zip manually from https://grouplens.org/datasets/movielens/ and place movies.csv/ratings.csv/links.csv into data/ml-latest-small/");
  process.exit(1);
});
