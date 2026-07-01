import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "yaml";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const writingDir = path.join(repoRoot, "writing");
const configPath = path.join(repoRoot, "writings.config.json");
const imagesDir = path.join(writingDir, "images");

function extractPageId(url) {
  const normalized = url.replace(/-/g, "");
  const match = /([a-f0-9]{32})$/i.exec(normalized);

  if (!match) {
    throw new Error(`Unable to extract Notion page id from ${url}`);
  }

  return match[1];
}

function toFrontmatter(entry) {
  return {
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    type: entry.type,
    publishedAt: entry.publishedAt,
    source: entry.source,
    externalUrl: entry.externalUrl,
    notionUrl: entry.notionUrl,
    openInNewTab: entry.openInNewTab,
    tags: entry.tags ?? [],
  };
}

function buildDocument(frontmatter, markdown) {
  return `---\n${yaml.stringify(frontmatter)}---\n\n${markdown.trim()}\n`;
}

async function writeIndexFile(config) {
  const indexFrontmatter = {
    title: config.title,
    description: config.description,
    tabs: config.tabs,
    entries: config.entries.map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      summary: entry.summary,
      type: entry.type,
      publishedAt: entry.publishedAt,
      source: entry.source,
      externalUrl: entry.externalUrl,
      openInNewTab: entry.openInNewTab,
      tags: entry.tags ?? [],
    })),
  };

  const body = [
    "# Writing",
    "",
    "This registry is consumed by the frontend to build the writing listing and resolve local detail pages.",
  ].join("\n");

  await fs.writeFile(
    path.join(writingDir, "index.mdx"),
    buildDocument(indexFrontmatter, body),
    "utf8",
  );
}

async function downloadImage(url, destPath) {
  // 1. Send an HTTP request to Notion's private AWS link to request the image file
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch image: ${response.statusText}`);

  // 2. Read the incoming image data as raw, unformatted binary data (zeros and ones)
  const arrayBuffer = await response.arrayBuffer();

  // 3. Convert that raw data into a Node.js "Buffer" so the computer recognizes it as an actual file
  const buffer = Buffer.from(arrayBuffer);

  // 4. Physically write and save that file onto your hard drive at the 'destPath'
  // (e.g., saving it permanently as "writing/images/my-first-post-0.png")
  await fs.writeFile(destPath, buffer);
}

async function main() {
  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) {
    throw new Error(
      "Missing NOTION_TOKEN. Copy .env.example to .env and set the token.",
    );
  }

  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const notion = new Client({ auth: notionToken });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  await fs.mkdir(writingDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  await writeIndexFile(config);

  for (const entry of config.entries) {
    if (entry.source !== "notion" || !entry.notionUrl) {
      continue;
    }

    const pageId = extractPageId(entry.notionUrl);
    let imgCounter = 0;

    n2m.setCustomTransformer("image", async (block) => {
      const { image } = block;
      if (!image) return "";

      const imgUrl =
        image.type === "file" ? image.file.url : image.external.url;
      const caption =
        image.caption?.map((c) => c.plain_text).join(" ") ?? "Notion Image";

      try {
        const urlWithoutQuerystring = imgUrl.split("?")[0] || "";
        const ext = path.extname(urlWithoutQuerystring) || ".png";

        const filename = `${entry.slug}-${imgCounter}${ext}`;
        const localImagePath = path.join(imagesDir, filename);

        await downloadImage(imgUrl, localImagePath);
        imgCounter++;

        return `![${caption}](./images/${filename})`;
      } catch (error) {
        console.error(`Failed to process image in block ${block.id}:`, error);
        return `![${caption}](${imgUrl})`;
      }
    });
    const mdBlocks = await n2m.pageToMarkdown(pageId);
    const markdown = n2m.toMarkdownString(mdBlocks).parent;
    const document = buildDocument(toFrontmatter(entry), markdown);

    await fs.writeFile(
      path.join(writingDir, `${entry.slug}.mdx`),
      document,
      "utf8",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
