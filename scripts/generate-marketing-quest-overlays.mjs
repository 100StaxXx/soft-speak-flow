import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEFAULTS = {
  title: "Deep work block",
  description: "Protect uninterrupted time for your highest-value work.",
  xp: 16,
  category: "Work",
  difficulty: "Medium",
  duration: "90 min",
  outputDir: "output/marketing/quest-overlays",
};

const CHROMA_KEY = "#00ff00";

const THEME = {
  cardSurfaceTop: "#2c233f",
  cardSurfaceBottom: "#171322",
  cardStroke: "rgba(255,255,255,0.16)",
  cardInnerGlow: "rgba(255,255,255,0.08)",
  cosmicGlow: "rgba(151, 92, 255, 0.34)",
  cosmicGlowSecondary: "rgba(244, 161, 102, 0.34)",
  cosmicGlowTertiary: "rgba(255, 214, 114, 0.2)",
  eyebrowBg: "rgba(255,255,255,0.1)",
  eyebrowStroke: "rgba(255,255,255,0.14)",
  eyebrowText: "rgba(255,255,255,0.82)",
  titleText: "#ffffff",
  bodyText: "rgba(255,255,255,0.72)",
  chipText: "rgba(255,255,255,0.9)",
  chipBg: "rgba(255,255,255,0.08)",
  chipStroke: "rgba(255,255,255,0.14)",
  categoryChipBg: "rgba(139, 110, 255, 0.18)",
  categoryChipStroke: "rgba(170, 150, 255, 0.32)",
  difficultyChipBg: "rgba(243, 162, 100, 0.2)",
  difficultyChipStroke: "rgba(255, 213, 180, 0.38)",
  durationChipBg: "rgba(255,255,255,0.08)",
  durationChipStroke: "rgba(255,255,255,0.14)",
  xpTop: "#ffd5b4",
  xpMid: "#f4a166",
  xpBottom: "#df7f41",
  xpText: "#4d2309",
  xpStroke: "rgba(255, 232, 214, 0.56)",
  medalTop: "#ffe27d",
  medalBottom: "#f2a54e",
  medalStroke: "rgba(255,240,215,0.65)",
  medalText: "#5b2d0b",
  sparkle: "#ffd972",
  previewBgTop: "#0b1020",
  previewBgBottom: "#1a1130",
};

const LAYOUTS = {
  vertical: {
    width: 1080,
    height: 1920,
    groupX: 120,
    groupY: 1040,
    cardWidth: 840,
    cardHeight: 470,
    cardRadius: 42,
    xpX: 596,
    xpY: -48,
    xpWidth: 264,
    xpHeight: 112,
    xpRotation: -7,
    medalX: 56,
    medalY: 114,
    medalSize: 104,
    eyebrowX: 186,
    eyebrowY: 54,
    eyebrowWidth: 220,
    eyebrowHeight: 44,
    titleX: 186,
    titleY: 164,
    titleFontSize: 60,
    titleLineHeight: 68,
    titleMaxChars: 22,
    titleMaxLines: 2,
    bodyX: 186,
    bodyY: 252,
    bodyFontSize: 28,
    bodyLineHeight: 38,
    bodyMaxChars: 42,
    bodyMaxLines: 2,
    chipY: 360,
    chipHeight: 54,
    chipGap: 16,
    chipFontSize: 24,
    chipPaddingX: 24,
    footerLabelX: 186,
    footerLabelY: 436,
    footerFontSize: 20,
    footerGlowX: 420,
    footerGlowY: 232,
    footerGlowWidth: 680,
    footerGlowHeight: 360,
    sparkles: [
      { x: 770, y: 98, size: 22, opacity: 0.94, rotation: 12 },
      { x: 724, y: 68, size: 12, opacity: 0.82, rotation: 0 },
      { x: 116, y: 60, size: 16, opacity: 0.8, rotation: 18 },
      { x: 800, y: 372, size: 18, opacity: 0.8, rotation: 36 },
      { x: 164, y: 402, size: 10, opacity: 0.7, rotation: -12 },
    ],
  },
  horizontal: {
    width: 1920,
    height: 1080,
    groupX: 180,
    groupY: 628,
    cardWidth: 1240,
    cardHeight: 316,
    cardRadius: 36,
    xpX: 1004,
    xpY: -42,
    xpWidth: 238,
    xpHeight: 96,
    xpRotation: -5,
    medalX: 52,
    medalY: 98,
    medalSize: 88,
    eyebrowX: 164,
    eyebrowY: 42,
    eyebrowWidth: 204,
    eyebrowHeight: 40,
    titleX: 164,
    titleY: 138,
    titleFontSize: 58,
    titleLineHeight: 62,
    titleMaxChars: 28,
    titleMaxLines: 2,
    bodyX: 164,
    bodyY: 198,
    bodyFontSize: 25,
    bodyLineHeight: 34,
    bodyMaxChars: 56,
    bodyMaxLines: 2,
    chipY: 234,
    chipHeight: 48,
    chipGap: 14,
    chipFontSize: 20,
    chipPaddingX: 20,
    footerLabelX: 980,
    footerLabelY: 274,
    footerFontSize: 18,
    footerGlowX: 620,
    footerGlowY: 152,
    footerGlowWidth: 930,
    footerGlowHeight: 240,
    sparkles: [
      { x: 1152, y: 56, size: 18, opacity: 0.94, rotation: 12 },
      { x: 1108, y: 24, size: 10, opacity: 0.82, rotation: 0 },
      { x: 120, y: 32, size: 14, opacity: 0.8, rotation: 18 },
      { x: 1160, y: 258, size: 16, opacity: 0.8, rotation: 36 },
      { x: 154, y: 270, size: 10, opacity: 0.7, rotation: -12 },
    ],
  },
};

function parseArgs(argv) {
  const parsed = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (!arg.startsWith("--")) continue;

    switch (arg) {
      case "--title":
        parsed.title = next ?? parsed.title;
        index += 1;
        break;
      case "--description":
        parsed.description = next ?? parsed.description;
        index += 1;
        break;
      case "--xp":
        parsed.xp = Number(next ?? parsed.xp);
        index += 1;
        break;
      case "--category":
        parsed.category = next ?? parsed.category;
        index += 1;
        break;
      case "--difficulty":
        parsed.difficulty = next ?? parsed.difficulty;
        index += 1;
        break;
      case "--duration":
        parsed.duration = next ?? parsed.duration;
        index += 1;
        break;
      case "--output-dir":
        parsed.outputDir = next ?? parsed.outputDir;
        index += 1;
        break;
      default:
        break;
    }
  }

  return parsed;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function wrapText(text, maxChars, maxLines) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return [];

  const lines = [];
  let current = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    lines.push(current);
    current = words[index];

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines) {
    const remainingWords = words.slice(lines.join(" ").split(/\s+/).filter(Boolean).length);
    const tail = remainingWords.length > 0 ? remainingWords.join(" ") : current;
    lines.push(tail);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines) {
    const totalWordsUsed = lines.join(" ").split(/\s+/).filter(Boolean).length;
    if (totalWordsUsed < words.length) {
      lines[maxLines - 1] = truncateWithEllipsis(lines[maxLines - 1], maxChars);
    }
  }

  return lines.map((line, index) => {
    if (index === lines.length - 1) {
      const consumed = lines
        .slice(0, index)
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
      if (consumed < words.length - line.split(/\s+/).filter(Boolean).length) {
        return truncateWithEllipsis(line, maxChars);
      }
    }
    return line;
  });
}

function truncateWithEllipsis(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

function renderMultilineText({ x, y, fontSize, lineHeight, lines, fill, fontWeight }) {
  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="'Avenir Next', 'Helvetica Neue', Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}">
      ${lines
        .map((line, index) => {
          const dy = index === 0 ? 0 : lineHeight;
          return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
        })
        .join("")}
    </text>
  `;
}

function renderChip({ x, y, text, bg, stroke, textColor, height, fontSize, paddingX }) {
  const width = Math.max(116, Math.ceil(text.length * (fontSize * 0.64) + paddingX * 2));

  return {
    width,
    svg: `
      <g transform="translate(${x} ${y})">
        <rect width="${width}" height="${height}" rx="${height / 2}" fill="${bg}" stroke="${stroke}" />
        <text
          x="${width / 2}"
          y="${height / 2 + fontSize * 0.35}"
          fill="${textColor}"
          font-family="'Avenir Next', 'Helvetica Neue', Arial, sans-serif"
          font-size="${fontSize}"
          font-weight="700"
          text-anchor="middle"
        >${escapeXml(text)}</text>
      </g>
    `,
  };
}

function renderSparkle({ x, y, size, opacity, rotation }) {
  const half = size / 2;
  const points = [
    [0, -half],
    [half * 0.28, -half * 0.28],
    [half, 0],
    [half * 0.28, half * 0.28],
    [0, half],
    [-half * 0.28, half * 0.28],
    [-half, 0],
    [-half * 0.28, -half * 0.28],
  ]
    .map(([px, py]) => `${px},${py}`)
    .join(" ");

  return `
    <g transform="translate(${x} ${y}) rotate(${rotation})" opacity="${opacity}">
      <polygon points="${points}" fill="${THEME.sparkle}" />
      <circle r="${Math.max(1.5, size * 0.08)}" fill="white" opacity="0.85" />
    </g>
  `;
}

function buildSvg({ layoutName, backgroundMode, options }) {
  const layout = LAYOUTS[layoutName];
  const titleLines = wrapText(options.title, layout.titleMaxChars, layout.titleMaxLines);
  const bodyLines = wrapText(options.description, layout.bodyMaxChars, layout.bodyMaxLines);

  const chips = [
    { text: options.category.toUpperCase(), bg: THEME.categoryChipBg, stroke: THEME.categoryChipStroke },
    { text: options.difficulty.toUpperCase(), bg: THEME.difficultyChipBg, stroke: THEME.difficultyChipStroke },
    { text: options.duration.toUpperCase(), bg: THEME.durationChipBg, stroke: THEME.durationChipStroke },
  ];

  let chipX = layout.titleX;
  const chipsSvg = chips
    .map((chip) => {
      const rendered = renderChip({
        x: chipX,
        y: layout.chipY,
        text: chip.text,
        bg: chip.bg,
        stroke: chip.stroke,
        textColor: THEME.chipText,
        height: layout.chipHeight,
        fontSize: layout.chipFontSize,
        paddingX: layout.chipPaddingX,
      });
      chipX += rendered.width + layout.chipGap;
      return rendered.svg;
    })
    .join("");

  const sparkles = layout.sparkles.map(renderSparkle).join("");
  const backgroundRect = backgroundMode === "chroma"
    ? `<rect width="${layout.width}" height="${layout.height}" fill="${CHROMA_KEY}" />`
    : backgroundMode === "preview"
      ? `<rect width="${layout.width}" height="${layout.height}" fill="url(#previewBg)" />`
      : "";

  const previewExtras = backgroundMode === "preview"
    ? `
      <g opacity="0.85">
        <circle cx="${layout.width * 0.16}" cy="${layout.height * 0.2}" r="${Math.min(layout.width, layout.height) * 0.14}" fill="rgba(106, 86, 255, 0.18)" filter="url(#ambientBlur)" />
        <circle cx="${layout.width * 0.82}" cy="${layout.height * 0.76}" r="${Math.min(layout.width, layout.height) * 0.18}" fill="rgba(244, 161, 102, 0.14)" filter="url(#ambientBlur)" />
        <circle cx="${layout.width * 0.74}" cy="${layout.height * 0.18}" r="${Math.min(layout.width, layout.height) * 0.08}" fill="rgba(255, 214, 114, 0.08)" filter="url(#ambientBlur)" />
      </g>
    `
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" fill="none">
      <defs>
        <linearGradient id="previewBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${THEME.previewBgTop}" />
          <stop offset="100%" stop-color="${THEME.previewBgBottom}" />
        </linearGradient>
        <linearGradient id="cardSurface" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stop-color="${THEME.cardSurfaceTop}" />
          <stop offset="100%" stop-color="${THEME.cardSurfaceBottom}" />
        </linearGradient>
        <linearGradient id="cardShine" x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0%" stop-color="rgba(255,255,255,0.16)" />
          <stop offset="45%" stop-color="rgba(255,255,255,0.06)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="xpGradient" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stop-color="${THEME.xpTop}" />
          <stop offset="52%" stop-color="${THEME.xpMid}" />
          <stop offset="100%" stop-color="${THEME.xpBottom}" />
        </linearGradient>
        <linearGradient id="medalGradient" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stop-color="${THEME.medalTop}" />
          <stop offset="100%" stop-color="${THEME.medalBottom}" />
        </linearGradient>
        <filter id="cardShadow" x="-20%" y="-24%" width="140%" height="170%">
          <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="rgba(3, 4, 10, 0.44)" />
          <feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="rgba(115, 82, 255, 0.12)" />
        </filter>
        <filter id="xpShadow" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="rgba(66, 27, 5, 0.34)" />
        </filter>
        <filter id="ambientBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="48" />
        </filter>
      </defs>
      ${backgroundRect}
      ${previewExtras}
      <g transform="translate(${layout.groupX} ${layout.groupY})">
        <ellipse
          cx="${layout.footerGlowX}"
          cy="${layout.footerGlowY}"
          rx="${layout.footerGlowWidth / 2}"
          ry="${layout.footerGlowHeight / 2}"
          fill="${THEME.cosmicGlow}"
          filter="url(#ambientBlur)"
        />
        <ellipse
          cx="${layout.footerGlowX + 90}"
          cy="${layout.footerGlowY - 12}"
          rx="${layout.footerGlowWidth * 0.32}"
          ry="${layout.footerGlowHeight * 0.34}"
          fill="${THEME.cosmicGlowSecondary}"
          filter="url(#ambientBlur)"
        />
        <ellipse
          cx="${layout.footerGlowX - 90}"
          cy="${layout.footerGlowY + 20}"
          rx="${layout.footerGlowWidth * 0.22}"
          ry="${layout.footerGlowHeight * 0.2}"
          fill="${THEME.cosmicGlowTertiary}"
          filter="url(#ambientBlur)"
        />
        <g transform="translate(${layout.xpX} ${layout.xpY}) rotate(${layout.xpRotation})" filter="url(#xpShadow)">
          <rect width="${layout.xpWidth}" height="${layout.xpHeight}" rx="${layout.xpHeight / 2}" fill="url(#xpGradient)" stroke="${THEME.xpStroke}" />
          <text
            x="${layout.xpWidth / 2}"
            y="${layout.xpHeight * 0.58}"
            fill="${THEME.xpText}"
            font-family="'Avenir Next', 'Helvetica Neue', Arial, sans-serif"
            font-size="${layoutName === "vertical" ? 42 : 36}"
            font-weight="800"
            text-anchor="middle"
          >+${escapeXml(String(options.xp))} XP</text>
        </g>
        <g filter="url(#cardShadow)">
          <rect
            width="${layout.cardWidth}"
            height="${layout.cardHeight}"
            rx="${layout.cardRadius}"
            fill="url(#cardSurface)"
            stroke="${THEME.cardStroke}"
          />
          <rect
            x="1"
            y="1"
            width="${layout.cardWidth - 2}"
            height="${Math.round(layout.cardHeight * 0.42)}"
            rx="${layout.cardRadius - 1}"
            fill="url(#cardShine)"
            opacity="0.82"
          />
          <rect
            x="12"
            y="12"
            width="${layout.cardWidth - 24}"
            height="${layout.cardHeight - 24}"
            rx="${layout.cardRadius - 10}"
            stroke="${THEME.cardInnerGlow}"
          />
        </g>
        <g transform="translate(${layout.medalX} ${layout.medalY})">
          <circle cx="${layout.medalSize / 2}" cy="${layout.medalSize / 2}" r="${layout.medalSize / 2}" fill="url(#medalGradient)" stroke="${THEME.medalStroke}" />
          <circle cx="${layout.medalSize / 2}" cy="${layout.medalSize / 2}" r="${layout.medalSize * 0.34}" fill="rgba(255,255,255,0.16)" />
          <path
            d="M${layout.medalSize * 0.3} ${layout.medalSize * 0.54} L${layout.medalSize * 0.45} ${layout.medalSize * 0.68} L${layout.medalSize * 0.72} ${layout.medalSize * 0.38}"
            stroke="${THEME.medalText}"
            stroke-width="${layoutName === "vertical" ? 10 : 8}"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>
        <g transform="translate(${layout.eyebrowX} ${layout.eyebrowY})">
          <rect width="${layout.eyebrowWidth}" height="${layout.eyebrowHeight}" rx="${layout.eyebrowHeight / 2}" fill="${THEME.eyebrowBg}" stroke="${THEME.eyebrowStroke}" />
          <text
            x="${layout.eyebrowWidth / 2}"
            y="${layout.eyebrowHeight / 2 + 7}"
            fill="${THEME.eyebrowText}"
            font-family="'Avenir Next', 'Helvetica Neue', Arial, sans-serif"
            font-size="${layoutName === "vertical" ? 20 : 18}"
            font-weight="800"
            letter-spacing="2"
            text-anchor="middle"
          >QUEST COMPLETE</text>
        </g>
        ${renderMultilineText({
          x: layout.titleX,
          y: layout.titleY,
          fontSize: layout.titleFontSize,
          lineHeight: layout.titleLineHeight,
          lines: titleLines,
          fill: THEME.titleText,
          fontWeight: 800,
        })}
        ${renderMultilineText({
          x: layout.bodyX,
          y: layout.bodyY,
          fontSize: layout.bodyFontSize,
          lineHeight: layout.bodyLineHeight,
          lines: bodyLines,
          fill: THEME.bodyText,
          fontWeight: 500,
        })}
        ${chipsSvg}
        <text
          x="${layout.footerLabelX}"
          y="${layout.footerLabelY}"
          fill="${THEME.bodyText}"
          font-family="'Avenir Next', 'Helvetica Neue', Arial, sans-serif"
          font-size="${layout.footerFontSize}"
          font-weight="700"
          letter-spacing="0.6"
        >Featured template quest</text>
        ${sparkles}
      </g>
    </svg>
  `;

  return svg.replace(/>\s+</g, "><").trim();
}

async function writeAsset(svg, targetBasePath) {
  const svgPath = `${targetBasePath}.svg`;
  const pngPath = `${targetBasePath}.png`;

  await fs.writeFile(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);

  return { svgPath, pngPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const safeTitleSlug = slugify(options.title);
  const outputDir = path.resolve(process.cwd(), options.outputDir, safeTitleSlug);

  await fs.mkdir(outputDir, { recursive: true });

  const assets = [];

  for (const layoutName of Object.keys(LAYOUTS)) {
    const transparentSvg = buildSvg({ layoutName, backgroundMode: "transparent", options });
    const chromaSvg = buildSvg({ layoutName, backgroundMode: "chroma", options });
    const previewSvg = buildSvg({ layoutName, backgroundMode: "preview", options });

    assets.push(await writeAsset(transparentSvg, path.join(outputDir, `cosmiq-quest-complete-${layoutName}-transparent`)));
    assets.push(await writeAsset(chromaSvg, path.join(outputDir, `cosmiq-quest-complete-${layoutName}-chroma-key`)));
    assets.push(await writeAsset(previewSvg, path.join(outputDir, `cosmiq-quest-complete-${layoutName}-preview`)));
  }

  const readme = `# Cosmiq Quest Overlay Export

Source template:
- Title: ${options.title}
- Category: ${options.category}
- Difficulty: ${options.difficulty}
- Duration: ${options.duration}
- XP: +${options.xp}

Files:
- \`*-transparent.png\` and \`*-transparent.svg\`: best option when your editor supports alpha.
- \`*-chroma-key.png\` and \`*-chroma-key.svg\`: green-screen fallback. Key color is \`${CHROMA_KEY}\`.
- \`*-preview.png\` and \`*-preview.svg\`: visual mock preview only, not for direct overlay use.

Tip:
- Prefer the transparent PNG for cleaner edges and glow retention.
`;

  await fs.writeFile(path.join(outputDir, "README.md"), readme, "utf8");

  console.log(`Generated overlay assets in ${outputDir}`);
  for (const asset of assets) {
    console.log(asset.svgPath);
    console.log(asset.pngPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
