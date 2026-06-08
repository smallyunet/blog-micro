const state = {
  sources: [],
  manifest: null,
  years: [],
  activeYear: null,
  loaded: new Map(),
  query: "",
};

const els = {
  tabs: document.getElementById("year-tabs"),
  timeline: document.getElementById("timeline"),
  status: document.getElementById("status-text"),
  issueLink: document.getElementById("issue-link"),
  total: document.getElementById("total-count"),
  loadingTemplate: document.getElementById("loading-template"),
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

const legacySiteOrigin = "https://crazy.smallyu.net";
let markdownConfigured = false;

function issueUrl(source) {
  return `https://github.com/${source.owner}/${source.repo}/issues/${source.issue}`;
}

function normalizeHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const match = hash.match(/^(20\d{2})(?:-(\d+))?$/);
  return match ? { year: Number(match[1]), item: match[2] ? Number(match[2]) : null } : null;
}

function setHash(year, item = null) {
  const next = `#${year}${item ? `-${item}` : ""}`;
  if (window.location.hash !== next) {
    history.pushState(null, "", next);
  }
}

function formatDate(value) {
  const date = new Date(value);
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}时${parts.minute}分`;
}

function renderMarkdown(markdown) {
  if (!window.marked) return markdown || "";
  if (!markdownConfigured) {
    marked.setOptions({
      breaks: false,
      gfm: true,
      headerIds: false,
      mangle: false,
    });
    markdownConfigured = true;
  }

  const template = document.createElement("template");
  template.innerHTML = marked.parse(markdown || "");

  for (const link of template.content.querySelectorAll('a[href^="/"]')) {
    link.href = `${legacySiteOrigin}${link.getAttribute("href")}`;
  }

  for (const image of template.content.querySelectorAll('img[src^="/"]')) {
    image.src = `${legacySiteOrigin}${image.getAttribute("src")}`;
  }

  return template.innerHTML;
}

function renderTabs() {
  els.tabs.innerHTML = "";
  for (const year of state.years) {
    const source = state.sources.find((item) => item.year === year);
    const count = state.manifest?.years?.find((item) => item.year === year)?.count;
    const button = document.createElement("button");
    button.className = "tab";
    button.type = "button";
    button.role = "tab";
    button.ariaSelected = String(year === state.activeYear);
    button.textContent = count == null ? `${year}年` : `${year}年 · ${count}`;
    button.addEventListener("click", () => {
      setHash(year);
      activateYear(year);
    });
    button.title = source ? issueUrl(source) : "";
    els.tabs.append(button);
  }
}

function renderLoading() {
  els.timeline.innerHTML = "";
  els.timeline.append(els.loadingTemplate.content.cloneNode(true));
}

function renderError(message) {
  els.timeline.innerHTML = `<li class="error">${message}</li>`;
}

function renderItems(year, comments) {
  const query = state.query.trim().toLowerCase();
  const filtered = query
    ? comments.filter((item) => (item.body || "").toLowerCase().includes(query))
    : comments;

  els.timeline.innerHTML = "";

  if (filtered.length === 0) {
    els.timeline.innerHTML = `<li class="empty">${query ? "没有匹配的记录。" : "这一年还没有记录。"}</li>`;
    return;
  }

  filtered.forEach((item) => {
    const originalIndex = comments.findIndex((candidate) => candidate.id === item.id);
    const ordinal = comments.length - originalIndex;
    const li = document.createElement("li");
    li.className = "timeline-item";
    li.id = `${year}-${ordinal}`;
    li.innerHTML = `
      <div class="item-date">
        <time datetime="${item.created_at}">${formatDate(item.created_at)}</time>
        <a href="#${year}-${ordinal}" aria-label="复制该条记录链接">#${ordinal}</a>
      </div>
      <div class="content">${renderMarkdown(item.body || "")}</div>
    `;
    els.timeline.append(li);
  });
}

function scrollToHashTarget() {
  const parsed = normalizeHash();
  if (!parsed?.item) return;
  const target = document.getElementById(`${parsed.year}-${parsed.item}`);
  if (!target) return;

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("highlight");
    window.setTimeout(() => target.classList.remove("highlight"), 1600);
  });
}

async function loadYear(year) {
  if (state.loaded.has(year)) return state.loaded.get(year);

  const response = await fetch(`./data/${year}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load ${year}.json`);
  const comments = await response.json();
  comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  state.loaded.set(year, comments);
  return comments;
}

async function activateYear(year) {
  state.activeYear = year;
  renderTabs();
  renderLoading();

  const source = state.sources.find((item) => item.year === year);
  if (source) {
    els.issueLink.hidden = false;
    els.issueLink.href = issueUrl(source);
  } else {
    els.issueLink.hidden = true;
  }

  try {
    const comments = await loadYear(year);
    els.status.textContent = `${year} 年 · ${comments.length} 条记录`;
    renderItems(year, comments);
    scrollToHashTarget();
  } catch (error) {
    els.status.textContent = `当前 ${year} 年`;
    renderError("数据加载失败，请刷新页面重试。");
    console.error(error);
  }
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

async function init() {
  try {
    const [sources, manifest] = await Promise.all([
      loadJson("./data/sources.json"),
      loadJson("./data/manifest.json"),
    ]);
    state.sources = sources.sources || [];
    state.manifest = manifest;
    state.years = state.sources.map((item) => item.year).sort((a, b) => b - a);

    const total = manifest.years?.reduce((sum, item) => sum + (item.count || 0), 0) ?? 0;
    els.total.textContent = String(total);

    const parsed = normalizeHash();
    const defaultYear = parsed?.year && state.years.includes(parsed.year) ? parsed.year : state.years[0];
    if (!window.location.hash && defaultYear) history.replaceState(null, "", `#${defaultYear}`);
    await activateYear(defaultYear);
  } catch (error) {
    els.status.textContent = "初始化失败";
    renderError("配置加载失败，请稍后重试。");
    console.error(error);
  }
}



els.timeline.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const parsed = normalizeHashFromHref(link.getAttribute("href"));
  if (!parsed) return;
  event.preventDefault();
  setHash(parsed.year, parsed.item);
  if (parsed.year !== state.activeYear) {
    activateYear(parsed.year);
  } else {
    scrollToHashTarget();
  }
});

function normalizeHashFromHref(href) {
  const match = href.replace(/^#/, "").match(/^(20\d{2})(?:-(\d+))?$/);
  return match ? { year: Number(match[1]), item: match[2] ? Number(match[2]) : null } : null;
}

function handleLocationChange() {
  const parsed = normalizeHash();
  if (parsed?.year && parsed.year !== state.activeYear) {
    activateYear(parsed.year);
  } else {
    scrollToHashTarget();
  }
}

window.addEventListener("popstate", handleLocationChange);
window.addEventListener("hashchange", handleLocationChange);

init();
