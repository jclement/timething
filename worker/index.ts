/**
 * Worker entry for timething.
 *
 * Today this Worker primarily serves the Vite-built SPA via the ASSETS
 * binding (configured in wrangler.toml). Two API endpoints exist:
 *
 *   GET  /api/health  — liveness check, returns {status, version}
 *   POST /api/pdf     — server-side PDF export (requires BROWSER binding)
 *
 * The /api/pdf endpoint uses Cloudflare's Browser Rendering API to launch
 * a headless Chromium, navigate to the dashboard with the caller's
 * settings injected, and return a proper PDF blob. If the BROWSER binding
 * isn't configured (Workers Free plan or binding not added yet) the
 * endpoint responds 501 and the client falls back to window.print().
 *
 * Browser Rendering requires Workers Paid plan. To enable:
 *   1. Ensure your account is on Workers Paid
 *   2. Add to wrangler.toml:   browser = { binding = "BROWSER" }
 *   3. Redeploy. The client will pick up the new endpoint automatically.
 */

interface Env {
  ASSETS: Fetcher;
  BROWSER?: Fetcher; // Cloudflare Browser Rendering binding (optional)
  VERSION?: string;
}

interface PdfRequest {
  // Full settings payload serialized from localStorage. The browser
  // re-hydrates this via ?settings=<encoded> so the rendered page shows
  // exactly what the user sees.
  settings: unknown;
  title?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ status: "ok", version: env.VERSION ?? "dev" });
    }

    if (url.pathname === "/api/pdf" && request.method === "POST") {
      return handlePdf(request, env, url);
    }

    // Everything else: static assets (SPA fallback is configured in wrangler.toml).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

async function handlePdf(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.BROWSER) {
    return json(
      {
        error: "browser_rendering_unavailable",
        message:
          "Server-side PDF generation isn't configured on this deployment. " +
          "Client should fall back to window.print().",
      },
      501,
    );
  }

  let body: PdfRequest;
  try {
    body = (await request.json()) as PdfRequest;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  // Dynamic import so Free-plan deployments don't fail to build.
  // @cloudflare/puppeteer exposes a Puppeteer-like API on the BROWSER
  // binding. The package isn't a hard dep — it's installed by the user
  // when they enable Browser Rendering on a paid plan, so the import is
  // typed as `any` here and tolerated when missing.
  const puppeteer = await loadPuppeteer();
  if (!puppeteer) {
    return json(
      { error: "puppeteer_unavailable", message: "Install @cloudflare/puppeteer to enable PDFs." },
      501,
    );
  }

  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();

    // Build a URL that renders the dashboard in print-optimized mode with
    // the caller's settings. The frontend reads ?print=1 to hide toolbars
    // and apply print styles even when not strictly printing.
    const printUrl = new URL("/", url.origin);
    printUrl.searchParams.set("print", "1");
    printUrl.searchParams.set("settings", encodeURIComponent(JSON.stringify(body.settings)));

    await page.goto(printUrl.toString(), { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "letter",
      landscape: true,
      printBackground: true,
      margin: { top: "0.4in", bottom: "0.4in", left: "0.4in", right: "0.4in" },
    });

    const filename = `timething-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PuppeteerModule = { launch: (binding: Fetcher) => Promise<any> };

async function loadPuppeteer(): Promise<PuppeteerModule | null> {
  try {
    // Use a variable specifier so the bundler doesn't try to resolve it.
    const specifier = "@cloudflare/puppeteer";
    return (await import(/* @vite-ignore */ specifier)) as PuppeteerModule;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
