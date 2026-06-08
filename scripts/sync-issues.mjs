import fs from "node:fs/promises";
import path from "node:path";

const root = new URL("..", import.meta.url);
const dataDir = new URL("data/", root);
const sourcesPath = new URL("data/sources.json", root);
const manifestPath = new URL("data/manifest.json", root);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const eventName = process.env.GITHUB_EVENT_NAME;
const eventPath = process.env.GITHUB_EVENT_PATH;

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readEvent() {
  if (!eventPath) return null;
  try {
    return await readJson(eventPath);
  } catch {
    return null;
  }
}

function shouldSyncSource(source, event) {
  if (!event || eventName !== "issue_comment") return true;
  const repo = event.repository?.name;
  const owner = event.repository?.owner?.login;
  const issue = event.issue?.number;
  return owner === source.owner && repo === source.repo && issue === source.issue;
}

async function fetchComments(source, page = 1, collected = []) {
  const url = new URL(`https://api.github.com/repos/${source.owner}/${source.repo}/issues/${source.issue}/comments`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "blog-micro-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${source.owner}/${source.repo}#${source.issue}: ${body}`);
  }

  const comments = await response.json();
  const next = collected.concat(comments);
  if (comments.length < 100) return next;
  return fetchComments(source, page + 1, next);
}

async function existingCount(year) {
  try {
    const data = await readJson(new URL(`data/${year}.json`, root));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

async function existingComments(year) {
  try {
    const data = await readJson(new URL(`data/${year}.json`, root));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function main() {
  await fs.mkdir(dataDir, { recursive: true });
  const config = await readJson(sourcesPath);
  const event = await readEvent();
  const sources = config.sources || [];
  const changedYears = [];
  const previousManifest = await readJson(manifestPath).catch(() => null);
  let fetchedAny = false;

  for (const source of sources) {
    const output = new URL(`data/${source.year}.json`, root);
    if (!shouldSyncSource(source, event)) {
      changedYears.push({
        year: source.year,
        count: await existingCount(source.year),
        issue_url: `https://github.com/${source.owner}/${source.repo}/issues/${source.issue}`,
        skipped: true,
      });
      continue;
    }

    let comments;
    try {
      comments = await fetchComments(source);
      fetchedAny = true;
    } catch (error) {
      const fallback = await existingComments(source.year);
      if (!fallback) throw error;
      comments = fallback;
      console.warn(`[sync] ${source.year}: ${error.message}`);
      console.warn(`[sync] ${source.year}: kept existing local data`);
    }

    comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    await writeJson(output, comments);
    changedYears.push({
      year: source.year,
      count: comments.length,
      issue_url: `https://github.com/${source.owner}/${source.repo}/issues/${source.issue}`,
    });
    console.log(`[sync] ${source.year}: ${comments.length} comments`);
  }

  const manifest = {
    updated_at: fetchedAny ? new Date().toISOString() : previousManifest?.updated_at ?? null,
    last_checked_at: new Date().toISOString(),
    years: changedYears
      .map(({ year, count, issue_url }) => ({ year, count, issue_url }))
      .sort((a, b) => a.year - b.year),
  };
  await writeJson(manifestPath, manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
