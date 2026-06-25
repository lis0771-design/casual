const MD_PATH = "자기소개서_로템.md";

const SECTION_IMAGES = {
  "지원-동기": {
    src: "images/motivation.jpg",
    alt: "한국인 남성 캐주얼 스트리트 스타일 룩",
    caption: "일상 속에서도 완성도 있는 남성 캐주얼",
    position: "center 15%",
  },
  "경력-및-핵심-역량": {
    src: "images/fabric.jpg",
    alt: "원단과 패턴을 검토하는 디자이너",
    caption: "원단·패턴 선정과 라인 개발 역량",
    position: "center center",
  },
  "주요-경력-및-성과": {
    src: "images/hero.jpg",
    alt: "재단용 마네킹과 디자인 도구",
    caption: "실루엣과 디테일을 다듬는 하이엔드 감각",
    position: "center 35%",
  },
  "입사-후-포부": {
    src: "images/motivation.jpg",
    alt: "세련된 한국인 남성 캐주얼 스타일링",
    caption: "고객이 매일 손이 가는 남성복을 목표로",
    position: "center 20%",
  },
};

const contentEl = document.getElementById("content");
const heroMetaEl = document.getElementById("hero-meta");
const sectionNavEl = document.getElementById("section-nav");
const printBtn = document.getElementById("print-btn");

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function slugify(text) {
  return text
    .replace(/^\d+\.\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u3131-\uD79D]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTable(lines) {
  const rows = lines.filter((line) => line.trim().startsWith("|"));
  if (rows.length < 2) return "";

  const bodyRows = rows.filter((row) => !/^\|[\s\-:|]+\|$/.test(row.trim()));
  const cells = bodyRows.map((row) =>
    row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim())
  );

  const body = cells.slice(1);

  let html = '<div class="table-wrap"><table class="data-table"><tbody>';
  body.forEach((row) => {
    html += "<tr>";
    html += `<th scope="row">${inlineFormat(row[0] || "")}</th>`;
    html += `<td>${inlineFormat(row[1] || "")}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  return html;
}

function parseCompetencyBlocks(text) {
  const blocks = text.split(/\n(?=\*\*①)/).filter(Boolean);
  if (blocks.length <= 1) return null;

  return blocks
    .map((block) => {
      const match = block.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)/);
      if (!match) return "";
      const title = match[1];
      const body = match[2].trim();
      return `<div class="competency-item"><strong>${inlineFormat(title)}</strong><p>${inlineFormat(body)}</p></div>`;
    })
    .join("");
}

function parseList(lines) {
  const items = lines
    .filter((line) => /^-\s+/.test(line.trim()))
    .map((line) => line.trim().replace(/^-\s+/, ""));
  if (!items.length) return "";

  return `<ul class="md-list">${items.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ul>`;
}

function parseMarkdown(md) {
  const sections = [];
  const normalized = md.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n---\n/).map((b) => b.trim()).filter(Boolean);

  blocks.forEach((block) => {
    const lines = block.split("\n");
    const h2Index = lines.findIndex((line) => /^##\s+/.test(line));

    if (h2Index === -1) {
      const meta = extractMeta(block);
      if (meta.length) sections.push({ type: "meta", items: meta });

      if (/지원자:|연락처:|이메일:/.test(block)) {
        sections.push({ type: "contact", id: "contact", title: "연락처", body: block });
      }
      return;
    }

    const title = lines[h2Index].replace(/^##\s+/, "").trim();
    const id = slugify(title) || `section-${sections.length}`;
    const bodyLines = lines.slice(h2Index + 1);
    const bodyText = bodyLines.join("\n").trim();

    if (/자기소개/.test(title) && bodyText.startsWith(">")) {
      const quote = bodyText.replace(/^>\s*/, "").trim();
      sections.push({ type: "quote", id, title, quote });
      return;
    }

    if (/연락처/.test(title)) {
      sections.push({ type: "contact", id, title, body: bodyText });
      return;
    }

    sections.push({
      type: "section",
      id,
      title,
      html: renderSectionBody(bodyText),
    });
  });

  return sections;
}

function extractMeta(block) {
  const items = [];
  const matches = block.matchAll(/\*\*(.+?):\*\*\s*(.+)/g);
  for (const match of matches) {
    items.push({ label: match[1], value: match[2].trim() });
  }
  return items;
}

function renderSectionBody(text) {
  let html = "";
  const parts = text.split(/\n(?=###\s+)/);

  parts.forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("### ")) {
      const nl = trimmed.indexOf("\n");
      const heading = trimmed.slice(4, nl > -1 ? nl : undefined).trim();
      const rest = nl > -1 ? trimmed.slice(nl + 1).trim() : "";

      html += `<h3>${inlineFormat(heading)}</h3>`;

      if (heading.includes("경력 요약") && rest.includes("|")) {
        html += parseTable(rest.split("\n"));
        return;
      }

      if (heading.includes("핵심 역량")) {
        const grid = parseCompetencyBlocks(rest);
        if (grid) {
          html += `<div class="competency-grid">${grid}</div>`;
          return;
        }
      }

      if (rest.includes("|")) {
        html += parseTable(rest.split("\n"));
      } else if (/^-\s+/m.test(rest)) {
        const paragraphs = rest.split(/\n(?=-\s+)/);
        paragraphs.forEach((chunk) => {
          if (chunk.trim().startsWith("-")) {
            html += parseList(chunk.split("\n"));
          } else if (chunk.trim()) {
            html += `<p>${inlineFormat(chunk.trim())}</p>`;
          }
        });
      } else {
        html += renderParagraphs(rest);
      }
      return;
    }

    if (index === 0) {
      html += renderParagraphs(trimmed);
    }
  });

  return html;
}

function renderParagraphs(text) {
  const chunks = text.split(/\n\n+/).filter(Boolean);
  let html = "";

  chunks.forEach((chunk) => {
    const trimmed = chunk.trim();
    if (/^-\s+/m.test(trimmed) && !trimmed.includes("\n\n")) {
      html += parseList(trimmed.split("\n"));
    } else if (trimmed.startsWith("|")) {
      html += parseTable(trimmed.split("\n"));
    } else {
      html += `<p>${inlineFormat(trimmed.replace(/\n/g, " "))}</p>`;
    }
  });

  return html;
}

function renderSectionImage(sectionId, layout = "wide") {
  const image = SECTION_IMAGES[sectionId];
  if (!image) return "";

  const position = image.position ? ` style="object-position: ${image.position};"` : "";

  return `
    <figure class="section-media section-media--${layout}">
      <img
        src="${escapeHtml(image.src)}"
        alt="${escapeHtml(image.alt)}"
        loading="lazy"
        decoding="async"${position}
      />
      <figcaption class="section-media-caption">${escapeHtml(image.caption)}</figcaption>
    </figure>`;
}

function renderSections(sections) {
  let html = "";
  let sectionIndex = 0;

  sections.forEach((section) => {
    if (section.type === "meta") return;

    if (section.type === "quote") {
      html += `
        <section class="card section-card quote-card" id="${section.id}">
          <p>${inlineFormat(section.quote.replace(/\*\*/g, ""))}</p>
        </section>`;
      return;
    }

    if (section.type === "contact") {
      const items = section.body
        .split("\n")
        .map((line) => line.trim().replace(/^\*+/, "").replace(/\*+$/, "").trim())
        .filter((line) => line.includes(":"));

      html += `
        <section class="card section-card contact-card" id="${section.id}">
          <h2>연락처</h2>
          ${items
            .map((line) => {
              const [label, ...rest] = line.split(":");
              return `<div class="contact-item"><span class="contact-label">${escapeHtml(label.trim())}</span><span class="contact-value">${inlineFormat(rest.join(":").trim())}</span></div>`;
            })
            .join("")}
        </section>`;
      return;
    }

    const layout = sectionIndex % 2 === 0 ? "left" : "right";
    sectionIndex += 1;

    html += `
      <section class="card section-card section-card--media" id="${section.id}">
        <div class="section-body">
          <h2>${inlineFormat(section.title)}</h2>
          ${section.html}
        </div>
        ${renderSectionImage(section.id, layout)}
      </section>`;
  });

  return html;
}

function renderHeroMeta(metaItems) {
  heroMetaEl.innerHTML = metaItems
    .map((item, i) => {
      const accent = i === 0 ? " meta-pill--accent" : "";
      return `<span class="meta-pill${accent}">${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>`;
    })
    .join("");
}

function renderNav(sections) {
  const navSections = sections.filter((s) => s.type === "section" || s.type === "quote" || s.type === "contact");
  sectionNavEl.innerHTML = navSections
    .map((section) => {
      const label = section.title.replace(/^\d+\.\s*/, "");
      return `<a class="nav-link" href="#${section.id}">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function setupNavClick() {
  sectionNavEl.addEventListener("click", (event) => {
    const link = event.target.closest(".nav-link");
    if (!link) return;

    const id = link.getAttribute("href")?.slice(1);
    if (!id) return;

    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  });
}

function setupScrollSpy() {
  const links = [...sectionNavEl.querySelectorAll(".nav-link")];
  const targets = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
        });
      });
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
  );

  targets.forEach((el) => observer.observe(el));
}

function showError(message) {
  contentEl.innerHTML = `
    <div class="card error-card">
      <p class="error-text">${escapeHtml(message)}</p>
      <p class="error-text">로컬 미리보기: <code>resume</code> 폴더에서 간단한 서버를 실행해 주세요.</p>
      <button type="button" class="btn btn-primary" id="retry-btn">다시 시도</button>
    </div>`;
  document.getElementById("retry-btn")?.addEventListener("click", init);
}

async function loadMarkdown() {
  const response = await fetch(MD_PATH);
  if (!response.ok) throw new Error(`마크다운 파일을 불러올 수 없습니다. (${response.status})`);
  return response.text();
}

async function init() {
  try {
    const md = await loadMarkdown();
    const sections = parseMarkdown(md);
    const meta = sections.find((s) => s.type === "meta");

    if (meta) renderHeroMeta(meta.items);
    contentEl.innerHTML = renderSections(sections);
    renderNav(sections);
    setupNavClick();
    setupScrollSpy();
  } catch (err) {
    showError(err.message || "알 수 없는 오류가 발생했습니다.");
  }
}

printBtn.addEventListener("click", () => window.print());

init();
