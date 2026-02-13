#!/usr/bin/env python3
"""Generate a one-page repo summary PDF without external dependencies."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Tuple


PAGE_WIDTH = 612.0   # US Letter
PAGE_HEIGHT = 792.0
MARGIN_X = 46.0
TOP_Y = 760.0
BOTTOM_Y = 48.0
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_X)


def escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def estimate_text_width(text: str, font_size: float) -> float:
    """Approximate width for Helvetica-like fonts, good enough for wrapping."""
    wide = set("MWQ@%&")
    narrow = set("ilIjtfr .,:;'`|!")
    width = 0.0
    for ch in text:
        if ch in wide:
            factor = 0.82
        elif ch in narrow:
            factor = 0.27
        elif ch.isupper():
            factor = 0.62
        else:
            factor = 0.53
        width += factor * font_size
    return width


def wrap_text(text: str, max_width: float, font_size: float) -> List[str]:
    words = text.split()
    if not words:
        return [""]
    lines: List[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if estimate_text_width(candidate, font_size) <= max_width:
            current = candidate
            continue
        lines.append(current)
        current = word
    lines.append(current)
    return lines


class PdfLayout:
    def __init__(self) -> None:
        self.ops: List[str] = []
        self.y = TOP_Y
        # Paint white page background to avoid transparent->black preview renderers.
        self.ops.append(f"1 1 1 rg 0 0 {PAGE_WIDTH:.0f} {PAGE_HEIGHT:.0f} re f")
        self.ops.append("0 0 0 rg")

    def line(self, text: str, x: float, font: str, size: float) -> None:
        safe = escape_pdf_text(text)
        self.ops.append(f"BT /{font} {size:.2f} Tf 1 0 0 1 {x:.2f} {self.y:.2f} Tm ({safe}) Tj ET")

    def move_down(self, points: float) -> None:
        self.y -= points


def build_layout(scale: float) -> Tuple[List[str], float]:
    title_size = 18.0 * scale
    subtitle_size = 8.7 * scale
    heading_size = 11.8 * scale
    body_size = 9.4 * scale
    title_lead = 22.0 * scale
    subtitle_lead = 13.0 * scale
    heading_lead = 14.0 * scale
    body_lead = 11.0 * scale
    section_gap = 7.0 * scale
    bullet_indent = 14.0

    layout = PdfLayout()

    def add_heading(text: str) -> None:
        layout.line(text, MARGIN_X, "F2", heading_size)
        layout.move_down(heading_lead)

    def add_paragraph(text: str) -> None:
        for row in wrap_text(text, CONTENT_WIDTH, body_size):
            layout.line(row, MARGIN_X, "F1", body_size)
            layout.move_down(body_lead)

    def add_bullets(items: Iterable[str]) -> None:
        for item in items:
            wrapped = wrap_text(item, CONTENT_WIDTH - bullet_indent, body_size)
            first = True
            for row in wrapped:
                prefix = "- " if first else "  "
                layout.line(f"{prefix}{row}", MARGIN_X, "F1", body_size)
                layout.move_down(body_lead)
                first = False
            layout.move_down(1.0 * scale)

    layout.line("Cosmiq App - One-Page Repo Summary", MARGIN_X, "F2", title_size)
    layout.move_down(title_lead)
    layout.line(
        "Evidence sources: README.md, index.html, src/App.tsx, src/hooks/*, src/pages/*, "
        "src/integrations/supabase/client.ts, supabase/function-manifest.json.",
        MARGIN_X,
        "F1",
        subtitle_size,
    )
    layout.move_down(subtitle_lead)
    layout.move_down(3.0 * scale)

    add_heading("What it is")
    add_paragraph(
        "Cosmiq is a Vite + React + TypeScript app described in repo metadata as a gamified "
        "self-improvement product for habits and quests with a celestial theme."
    )
    add_paragraph(
        "Repository code shows a web/PWA client plus a Capacitor iOS shell, backed by Supabase "
        "for auth, Postgres data, Edge Functions, and storage."
    )
    layout.move_down(section_gap)

    add_heading("Who it is for")
    add_paragraph(
        "Primary persona: people who want a gamified personal planning and growth app with "
        "coach-like guidance (inferred from quest, mentor, companion, and pep-talk flows)."
    )
    add_paragraph("Explicit primary persona statement in repository docs: Not found in repo.")
    layout.move_down(section_gap)

    add_heading("What it does")
    add_bullets(
        [
            "Manages daily quests with inbox capture, scheduling, recurring tasks, subtasks, and streak handling.",
            "Provides mentor experiences: mentor selection, chat, daily pep talks, and reflection/recap screens.",
            "Runs a companion system with XP progression, evolution, story generation, postcards, and collections.",
            "Supports epics/campaigns/journeys planning with AI-assisted planning endpoints and orchestration.",
            "Integrates calendars across Google, Outlook, and Apple with send-only or full-sync options.",
            "Includes contacts and interaction logging, plus multi-tab navigation across mentor/inbox/journeys/companion.",
        ]
    )
    layout.move_down(section_gap)

    add_heading("How it works (architecture)")
    add_bullets(
        [
            "Client: React app with React Router, React Query caching, and layered context providers in src/App.tsx.",
            "Data layer: supabase-js client handles auth/session and table access (for example daily_tasks, mentors, user_companion, contacts).",
            "Service layer: supabase.functions.invoke calls AI/service endpoints such as mentor-chat and ai-orchestrator.",
            "Backend surface: function-manifest allow-list contains 64 Edge Functions, including 3 scheduled functions.",
            "Realtime and runtime: RealtimeSyncProvider enables habits/epics/tasks sync; web uses service worker, iOS uses Capacitor plugins.",
            "Detailed production topology diagram and capacity/SLA metrics: Not found in repo.",
        ]
    )
    layout.move_down(section_gap)

    add_heading("How to run (minimal)")
    add_bullets(
        [
            "Install dependencies: npm install",
            "Create env file: cp .env.example .env",
            "Set required vars: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID, VITE_NATIVE_REDIRECT_BASE",
            "Start local app: npm run dev",
        ]
    )

    return layout.ops, layout.y


def build_pdf(content_stream: str) -> bytes:
    content_bytes = content_stream.encode("latin-1")

    objects: List[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH:.0f} {PAGE_HEIGHT:.0f}] "
            "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
        ).encode("ascii")
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    objects.append(
        b"<< /Length " + str(len(content_bytes)).encode("ascii") + b" >>\nstream\n" +
        content_bytes + b"\nendstream"
    )

    out = bytearray()
    out.extend(b"%PDF-1.4\n")
    offsets = [0]

    for index, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{index} 0 obj\n".encode("ascii"))
        out.extend(obj)
        out.extend(b"\nendobj\n")

    xref_start = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    out.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_start}\n"
            "%%EOF\n"
        ).encode("ascii")
    )
    return bytes(out)


def main() -> None:
    scales = [1.0, 0.96, 0.92, 0.88]
    chosen_stream = None
    final_y = None
    for scale in scales:
        ops, y = build_layout(scale)
        if y >= BOTTOM_Y:
            chosen_stream = "\n".join(ops)
            final_y = y
            break

    if chosen_stream is None or final_y is None:
        raise RuntimeError("Could not fit content on one page with configured scales.")

    out_path = Path("output/pdf/cosmiq-app-summary.pdf")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(build_pdf(chosen_stream))

    print(f"Wrote: {out_path}")
    print(f"Final baseline y: {final_y:.2f}")


if __name__ == "__main__":
    main()
