/**
 * Export — PDF download for the dashboard.
 *
 * Two paths:
 *   1. Server path (preferred when configured): POST /api/pdf, receive a
 *      headless-browser-rendered PDF. Requires Cloudflare Browser
 *      Rendering binding; feature-detected.
 *   2. Client path (default): render a real vector PDF with
 *      @react-pdf/renderer and download it. No third-party print
 *      dialog, proper text, color-coded rows, landscape letter.
 */

import type { Settings } from "./storage";

interface ExportArgs {
  settings: Settings;
  referenceDate: string;
  range: [number, number];
}

export async function exportPdf(args: ExportArgs): Promise<void> {
  try {
    const ok = await tryServerPdf(args);
    if (ok) return;
  } catch {
    // Ignore network failures and fall back to the client PDF.
  }
  await clientPdf(args);
}

async function tryServerPdf(args: ExportArgs): Promise<boolean> {
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (res.status === 501) return false; // binding not present
  if (!res.ok) return false;

  const blob = await res.blob();
  downloadBlob(blob, filename());
  return true;
}

async function clientPdf(args: ExportArgs): Promise<void> {
  // Lazy-loaded — @react-pdf/renderer is ~500kb gzipped. We don't want
  // to pay that cost until the user actually clicks Export.
  const [{ pdf }, { TimethingPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../pdf/TimethingPdf"),
  ]);
  const blob = await pdf(<TimethingPdf {...args} />).toBlob();
  downloadBlob(blob, filename());
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function filename(): string {
  return `timething-${new Date().toISOString().slice(0, 10)}.pdf`;
}
