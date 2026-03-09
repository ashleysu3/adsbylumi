/**
 * Opens a new window with a clean, print-optimised Creative Brief.
 * Works from any dashboard that has access to production items + angles + copy.
 */

interface BriefAngle {
  id: string;
  name: string;
  description?: string;
}

interface BriefProductionItem {
  id: string;
  format: string;
  hook: string;
  angleName?: string;
  script_lines?: string[];
  text_overlays?: { type?: string; text: string; timing?: string }[];
  visual_hook?: string;
  guidance?: string;
  why_this_works?: string;
  verbal_hook?: string;
  written_hook?: string;
  delivery_style?: string;
}

interface BriefCopySet {
  headlines?: string[];
  descriptions?: string[];
  primary_copy?: (string | { label?: string; text?: string; content?: string })[];
}

export interface PrintBriefData {
  brandName: string;
  offerName?: string;
  offerDescription?: string;
  offerPrice?: string;
  offerUrl?: string;
  productPsychology?: Record<string, any>;
  audiencePsychology?: Record<string, any>;
  angles: BriefAngle[];
  productionItems: BriefProductionItem[];
  angleCopy: Record<string, BriefCopySet>;
}

const FORMAT_LABELS: Record<string, string> = {
  talking_head: "Talking Head",
  talking_head_broll: "Talking Head + B-Roll",
  broll_voiceover: "B-Roll + Voiceover",
  broll: "B-Roll",
  ugc_testimonial: "UGC Testimonial",
  static_image: "Static Image",
  graphic: "Graphic",
  carousel: "Carousel",
  motion_graphic: "Motion Graphic",
};

function esc(val: any): string {
  if (val == null) return "";
  return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPsychology(data: Record<string, any> | undefined, title: string): string {
  if (!data || Object.keys(data).length === 0) return "";
  const cards = Object.entries(data)
    .filter(([, v]) => v != null)
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      let body = "";
      if (Array.isArray(value)) {
        body = `<ul>${value.map(v => `<li>${esc(v)}</li>`).join("")}</ul>`;
      } else if (typeof value === "object") {
        body = `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
      } else {
        body = `<p>${esc(String(value))}</p>`;
      }
      return `<div class="card"><h4>${esc(label)}</h4>${body}</div>`;
    })
    .join("");
  return `<div class="section"><h2>${esc(title)}</h2><div class="grid">${cards}</div></div>`;
}

export function printCreativeBrief(data: PrintBriefData) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Group items by angle
  const angleMap = new Map<string, BriefProductionItem[]>();
  data.productionItems.forEach(item => {
    const key = item.angleName || "Unassigned";
    if (!angleMap.has(key)) angleMap.set(key, []);
    angleMap.get(key)!.push(item);
  });

  const conceptSections = Array.from(angleMap.entries())
    .map(([angleName, items]) => {
      const concepts = items
        .map(
          (item, i) => `
        <div class="card concept">
          <div class="concept-meta">
            <span class="format-badge">${esc(FORMAT_LABELS[item.format] || item.format)}</span>
            <span class="concept-num">#${i + 1}</span>
          </div>
          <p class="hook">${esc(item.hook)}</p>
          ${item.guidance ? `<p class="guidance">${esc(item.guidance)}</p>` : ""}
          ${item.verbal_hook ? `<p class="sub"><strong>Verbal Hook:</strong> ${esc(item.verbal_hook)}</p>` : ""}
          ${item.written_hook ? `<p class="sub"><strong>Written Hook:</strong> ${esc(item.written_hook)}</p>` : ""}
          ${item.visual_hook ? `<p class="sub"><strong>Visual Direction:</strong> ${esc(item.visual_hook)}</p>` : ""}
          ${item.delivery_style ? `<p class="sub"><strong>Delivery:</strong> ${esc(item.delivery_style)}</p>` : ""}
          ${
            item.script_lines?.length
              ? `<div class="script"><h5>Script</h5><ol>${item.script_lines.map(l => `<li>${esc(l)}</li>`).join("")}</ol></div>`
              : ""
          }
          ${
            item.text_overlays?.length
              ? `<div class="overlays"><h5>Text Overlays</h5><ul>${item.text_overlays.map(t => `<li><em>[${esc(t.timing || "")}]</em> ${esc(t.type ? t.type.toUpperCase() + ": " : "")}${esc(t.text)}</li>`).join("")}</ul></div>`
              : ""
          }
          ${item.why_this_works ? `<p class="why">💡 ${esc(item.why_this_works)}</p>` : ""}
        </div>`
        )
        .join("");
      return `<div class="section"><h2>Concepts — ${esc(angleName)}</h2>${concepts}</div>`;
    })
    .join("");

  // Ad copy sections
  const copySections = data.angles
    .map(angle => {
      const copy = data.angleCopy[angle.id] as BriefCopySet | undefined;
      if (!copy) return "";
      const hasContent = (copy.headlines?.length || 0) + (copy.descriptions?.length || 0) + (copy.primary_copy?.length || 0) > 0;
      if (!hasContent) return "";

      let html = `<div class="section"><h2>Ad Copy — ${esc(angle.name)}</h2>`;
      if (copy.headlines?.length) {
        html += `<div class="card"><h4>Headlines</h4><ul>${copy.headlines.map(h => `<li>${esc(h)}</li>`).join("")}</ul></div>`;
      }
      if (copy.descriptions?.length) {
        html += `<div class="card"><h4>Descriptions</h4><ul>${copy.descriptions.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>`;
      }
      if (copy.primary_copy?.length) {
        html += `<div class="card"><h4>Primary Copy</h4>`;
        copy.primary_copy.forEach(pc => {
          if (typeof pc === "string") {
            html += `<p class="copy-block">${esc(pc)}</p>`;
          } else {
            if (pc.label) html += `<p class="copy-label">${esc(pc.label)}</p>`;
            html += `<p class="copy-block">${esc(pc.text || pc.content || JSON.stringify(pc))}</p>`;
          }
        });
        html += `</div>`;
      }
      html += `</div>`;
      return html;
    })
    .join("");

  const anglesSection =
    data.angles.length > 0
      ? `<div class="section"><h2>Creative Angles (${data.angles.length})</h2>${data.angles
          .map(
            (a, i) =>
              `<div class="card angle-card"><span class="angle-num">${i + 1}</span><div><h4>${esc(a.name)}</h4>${a.description ? `<p>${esc(a.description)}</p>` : ""}</div></div>`
          )
          .join("")}</div>`
      : "";

  const offerSection = `
    <div class="section">
      <h2>Offer Overview</h2>
      <div class="grid">
        ${data.offerName ? `<div class="card"><h4>Offer</h4><p>${esc(data.offerName)}</p></div>` : ""}
        ${data.offerPrice ? `<div class="card"><h4>Price</h4><p>${esc(data.offerPrice)}</p></div>` : ""}
        ${data.offerUrl ? `<div class="card full"><h4>URL</h4><p>${esc(data.offerUrl)}</p></div>` : ""}
        ${data.offerDescription ? `<div class="card full"><h4>Description</h4><p>${esc(data.offerDescription)}</p></div>` : ""}
      </div>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Creative Brief — ${esc(data.brandName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 28px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; font-size: 16px; }
  .date { text-align: center; color: #999; font-size: 13px; margin-bottom: 32px; }
  .header-line { border-bottom: 3px solid #8b5cf6; margin: 16px auto 32px; width: 80px; }
  .section { margin-bottom: 32px; page-break-inside: avoid; }
  h2 { font-size: 18px; font-weight: 700; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px; color: #1a1a2e; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
  .card.full { grid-column: 1 / -1; }
  .card h4 { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #374151; }
  .card p { font-size: 13px; color: #6b7280; }
  .card ul { list-style: disc; padding-left: 20px; font-size: 13px; color: #6b7280; }
  .card ul li { margin-bottom: 3px; }
  .card pre { font-size: 11px; color: #6b7280; white-space: pre-wrap; }
  .angle-card { display: flex; align-items: flex-start; gap: 12px; }
  .angle-num { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #ede9fe; color: #7c3aed; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .concept { margin-bottom: 12px; }
  .concept-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .format-badge { display: inline-block; background: #ede9fe; color: #7c3aed; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 4px; }
  .concept-num { font-size: 12px; color: #9ca3af; }
  .hook { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
  .guidance { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
  .sub { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
  .script { margin-top: 8px; }
  .script h5, .overlays h5 { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
  .script ol { padding-left: 20px; font-size: 13px; color: #374151; }
  .script ol li { margin-bottom: 4px; }
  .overlays ul { list-style: none; padding: 0; font-size: 12px; color: #6b7280; }
  .overlays ul li { margin-bottom: 3px; }
  .overlays em { color: #9ca3af; }
  .why { font-size: 12px; color: #7c3aed; font-style: italic; margin-top: 8px; }
  .copy-label { font-size: 12px; font-weight: 600; color: #7c3aed; margin-bottom: 2px; margin-top: 10px; }
  .copy-block { font-size: 13px; color: #6b7280; white-space: pre-wrap; margin-bottom: 8px; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 40px; }
  @media print {
    body { padding: 20px; }
    .section { page-break-inside: avoid; }
    .concept { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Creative Brief</h1>
  <p class="subtitle">${esc(data.brandName)}</p>
  <p class="date">${esc(date)}</p>
  <div class="header-line"></div>
  ${offerSection}
  ${renderPsychology(data.productPsychology, "Product Psychology")}
  ${renderPsychology(data.audiencePsychology, "Audience Psychology")}
  ${anglesSection}
  ${conceptSections}
  ${copySections}
  <div class="footer">Generated by Your Ad Assistant &bull; ${esc(date)}</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to export your Creative Brief.");
    return;
  }
  win.document.write(html);
  win.document.close();
  // Give the browser a moment to render, then trigger print
  setTimeout(() => win.print(), 400);
}
