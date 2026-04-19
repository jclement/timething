/**
 * /about — a short, slightly unhinged history of time zones + why this
 * app exists. Linked from the site footer.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Brand } from "../components/Brand";
import { TopBar } from "../components/TopBar";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <TopBar variant="subpage" />
      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-5 py-6">
        <h1 className="text-xl font-semibold text-heading mb-1">
          About <Brand />
        </h1>
        <p className="text-xs text-muted mb-6 italic">
          or: A Brief and Increasingly Angry History of Time
        </p>

        <section className="text-sm text-body space-y-5 leading-relaxed">
          <p>
            For most of human history, noon was simple: it was when the sun was
            directly overhead. If it was noon in your village and you walked three
            hours east to the next village, it was a little bit after noon there.
            This was fine. Everyone had their own time. Nobody was late for
            anything, because "late" was negotiable.
          </p>

          <Section title="Enter the railroad">
            <p>
              Then came trains, which is where our problems start. Trains insisted
              on running on schedules, and schedules insisted on time being the
              same in more than one place, which is genuinely unnatural. The
              British worked around this by pretending all of Britain was on
              London time, which is a tolerably British thing to do.
            </p>
            <p>
              North America had a harder time. At one point in the 1870s, the
              United States had something like 300 local times. A locomotive from
              Chicago to Pittsburgh would pass through six of them. This is not a
              joke.
            </p>
            <p>
              A Canadian engineer named <strong>Sandford Fleming</strong>{" "}
              allegedly got so annoyed by a missed train in Ireland (the printed
              schedule said "p.m." when it meant "a.m.", which, sure) that he
              decided the whole world should have 24 time zones, one per hour. In
              1884, in Washington D.C., a bunch of men in waistcoats voted to make
              this so, and called it the Prime Meridian Conference. France voted
              against it because the meridian went through Greenwich and not
              Paris, which is a tolerably French thing to do.
            </p>
          </Section>

          <Section title="What's wrong with the 24-zone plan">
            <p>Several things. Let me list a few:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                There are <strong>38 distinct UTC offsets in use today</strong>,
                not 24. Some places decided to be offset by thirty minutes or
                forty-five minutes. <strong>Nepal</strong> is UTC+5:45,
                reportedly so they could be 15 minutes different from India.{" "}
                <strong>Newfoundland</strong>, a Canadian island, is UTC-3:30 for
                reasons nobody alive can explain.
              </li>
              <li>
                <strong>China</strong> — a country that is geographically wide
                enough to have five time zones — decided in 1949 to have exactly
                one. If you are in Kashgar in the far west, the sun comes up at
                approximately lunch.
              </li>
              <li>
                <strong>Samoa</strong> skipped December 30, 2011 entirely.
                They went to bed on the 29th and woke up on the 31st because they
                decided to be on the western side of the International Date Line
                to better align with Australian business hours. There is no
                December 30, 2011 in Samoa. It simply did not occur.
              </li>
              <li>
                <strong>Kiribati</strong> did the opposite in 1995: their
                easternmost islands are now the first place on Earth to see each
                new day. <strong>American Samoa</strong>, roughly next door, is
                last. They are always 25 hours apart. Twenty-five. Because this
                is what the world is.
              </li>
            </ul>
          </Section>

          <Section title="And then there's daylight saving">
            <p>
              Daylight saving time is the practice of, twice a year, pretending
              the sun comes up at a different time. It was originally pushed hard
              during World War I to save coal. We are no longer fighting World
              War I. Most studies since have concluded it saves approximately no
              energy and causes a measurable spike in heart attacks the Monday
              after the spring transition.
            </p>
            <p>
              It is observed in about 70 countries. Most of Arizona does{" "}
              <em>not</em> observe it. The Navajo Nation,{" "}
              <em>inside</em> Arizona, does. There are parts of the Navajo
              Nation that cross into Utah, which also does DST. There exists, on
              a summer afternoon, a gas station in northern Arizona where two of
              the three clocks on the wall disagree by an hour and nobody working
              there can reliably tell you which is correct.
            </p>
            <p>
              Mexico stopped observing DST in 2022. Russia stopped in 2014.
              Türkiye stopped in 2016. The EU voted to abolish it in 2019 and
              then forgot. Every six months, the software industry loses roughly
              a week of collective productivity to bugs that boil down to "but we
              assumed March only has 31 days."
            </p>
          </Section>

          <Section title="Why this exists">
            <p>
              I routinely schedule meetings with colleagues in Calgary, Houston,
              Vancouver, and a handful of rather more exotic places. It hurts my
              brain — especially when my today is their tomorrow, or when one
              side of the call is about to spring forward and the other isn't.
            </p>
            <p>
              <Brand /> is the wall-chart I wanted: every zone I care about,
              lined up side by side, with the overlap of everyone's working
              hours darkened so I can pick a sane meeting time without opening
              a spreadsheet. It tells me when the next DST change will quietly
              break everything. It prints on a single landscape page. I can
              tape it to the wall.
            </p>
            <p>
              That's it. A printable schedule for people who have lost enough
              hours of their life to timezone math.
            </p>
          </Section>

          <Section title="Things that are genuinely hard">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                The Olson / IANA tz database has roughly{" "}
                <strong>600 zones</strong> and is updated several times a year
                because countries keep changing their minds. Your phone updates
                this quietly in the background, which is why your iPhone knows
                that Chile moved its DST transition.
              </li>
              <li>
                <strong>Etc/GMT+8</strong> is UTC<em>-</em>8, not UTC+8. The
                signs are inverted for reasons involving the POSIX specification
                and a man named Paul Eggert whose career has been heroic.
              </li>
              <li>
                Before 1883, the United States had no consistent noon at all.
                Cities like Detroit had three concurrent local times — solar,
                railroad-standard, and the one your grandmother insisted on.
              </li>
            </ul>
          </Section>

          <p className="text-xs text-muted pt-4 border-t border-app">
            Built by{" "}
            <a
              href="https://owg.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:underline"
            >
              the OneWheelGeek
            </a>
            . No cookies, no accounts, no server-side anything. See{" "}
            <a href="/privacy" className="text-[var(--color-primary)] hover:underline">
              privacy
            </a>{" "}
            if you're curious.
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
      <div className="space-y-3">{children}</div>
    </div>
  );
}
