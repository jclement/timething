/**
 * /privacy — a short, honest privacy page.
 *
 * The app is client-only. There's no backend doing anything clever, no
 * cookie, no analytics pixel, no pixel at all. The page exists mostly
 * because "we have a privacy policy" is a nicer link than "we don't."
 */
import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "../components/TopBar";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <>
      <TopBar variant="subpage" />
      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-5 py-6">
        <h1 className="text-xl font-semibold text-heading mb-1">Privacy</h1>
        <p className="text-xs text-muted mb-6">Short version: I don't want to know who you are.</p>

        <section className="text-sm text-body space-y-5 leading-relaxed">
          <p>
            timething is a single-page app that runs entirely in your browser. It has
            no login, no account, no database table with your name in it. There is no
            "server" doing anything interesting — just a static site delivered over the
            internet.
          </p>

          <Section title="What I collect">
            <p>
              Nothing. I mean it. There is no analytics script, no tracker, no
              session cookie, no telemetry beacon, no "anonymous usage statistics I
              promise." If you open the devtools Network panel you'll see exactly zero
              requests going to anywhere that could care who you are.
            </p>
          </Section>

          <Section title="What your browser remembers">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Your zones, labels, working hours, theme, and preset live in your
                browser's <code className="font-mono text-xs">localStorage</code>.
                They never leave your device. Clear your site data and they're gone.
              </li>
              <li>
                When you copy a shareable link, the URL hash (<code>#v1.…</code>)
                contains your zone list base64-encoded. Hash fragments are not sent
                to any server — not mine, not Cloudflare's, not your ISP's. They're
                browser-only.
              </li>
            </ul>
          </Section>

          <Section title="Cloudflare, because I have to say it">
            <p>
              The site is served by Cloudflare Workers. Cloudflare gets to see the
              usual edge-traffic stuff: your IP address, the path you requested, your
              user-agent — the kinds of things any web server sees when a browser
              connects to it. Cloudflare uses that for things like blocking
              denial-of-service attacks and serving you a cached asset from somewhere
              nearby. I don't have access to any of it individually. You can read
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] hover:underline"
              >
                {" "}
                their policy
              </a>
              {" "}if you're into that.
            </p>
          </Section>

          <Section title="Google Fonts">
            <p>
              The UI uses Inter and JetBrains Mono from Google Fonts, which means your
              browser fetches the font files from Google. Google sees the request. If
              this bothers you, an extension like uBlock or Decentraleyes will block
              it and the app still works fine with a fallback font.
            </p>
          </Section>

          <Section title="What I will never do">
            <ul className="list-disc pl-5 space-y-1">
              <li>Make you sign up.</li>
              <li>Ask for your email.</li>
              <li>Send you an email.</li>
              <li>Show you an ad.</li>
              <li>Sell anything about you, because there's nothing to sell.</li>
              <li>
                Build a newsletter, launch a Pro Plan, or add a "remember me" box.
              </li>
            </ul>
          </Section>

          <Section title="Questions">
            <p>
              If something here is unclear or you think I missed a privacy edge case,
              email jeffrey.clement@gmail.com. I'll actually read it.
            </p>
          </Section>

          <p className="text-xs text-muted pt-4 border-t border-app">
            Last updated 2026-04-19. This page is the source of truth — if it changes,
            the date at the bottom changes with it.
          </p>
        </section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-heading mt-4 mb-2">{title}</h2>
      {children}
    </div>
  );
}
