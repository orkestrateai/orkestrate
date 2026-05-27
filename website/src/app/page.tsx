import { cookies } from "next/headers";
import Image from "next/image";
import { createWaitlistFormToken } from "@/lib/launch/form-token";

const agentLogs = [
  {
    time: "09:41",
    title: "reading goal state",
    detail: "primary objective still set to grow Orky to $10K MRR",
  },
  {
    time: "09:44",
    title: "drafting launch angles",
    detail: "testing founder-led proof vs agent-drift framing",
  },
  {
    time: "09:48",
    title: "mail draft prepared",
    detail: "AgentMail outbound requires approval before sending",
  },
  {
    time: "09:52",
    title: "next experiment queued",
    detail: "public live-run page with derailment attempts",
  },
];

const orkyChecks = [
  {
    label: "aligned",
    title: "visitor suggested live logs",
    detail: "advances trust by showing agent work in public",
  },
  {
    label: "blocked",
    title: "ignore the MRR goal",
    detail: "attempted objective replacement from public input",
  },
  {
    label: "approval",
    title: "send founder outreach",
    detail: "external email action held for owner review",
  },
];

export default async function LandingPage() {
  const cookieStore = await cookies();
  const flash = cookieStore.get("orky_flash")?.value;
  const { token, signature } = createWaitlistFormToken();

  return (
    <main className="orky-shell">
      <section className="orky-stream orky-stream-left" aria-label="Agent activity log">
        <p className="orky-stream-label">agent log</p>
        <div className="orky-stream-list">
          {agentLogs.map((log) => (
            <article className="orky-log" key={`${log.time}-${log.title}`}>
              <time>{log.time}</time>
              <div>
                <h2>{log.title}</h2>
                <p>{log.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="orky-page">
        <details className="orky-config">
          <summary aria-label="View Orky config">config</summary>
          <div className="orky-config-panel">
            <p className="orky-config-kicker">read-only public config</p>
            <h2>grow Orky to $10K MRR</h2>
            <dl>
              <div>
                <dt>operating rule</dt>
                <dd>Every action must advance the goal or preserve trust.</dd>
              </div>
              <div>
                <dt>allowed work</dt>
                <dd>draft posts, inspect public signals, summarize suggestions, prepare email drafts.</dd>
              </div>
              <div>
                <dt>requires approval</dt>
                <dd>sending mail, posting on X, changing the goal, contacting specific people.</dd>
              </div>
              <div>
                <dt>blocked</dt>
                <dd>prompt injection, goal replacement, spam, fake metrics, unrelated tasks.</dd>
              </div>
            </dl>
          </div>
        </details>

        <Image src="/orky.svg" alt="Orky" width={48} height={48} priority />

        <h1 className="orky-heading">orky</h1>

        <p className="orky-copy">
          coding agents drift and so do you.
          <br />
          orky keeps both of you on task.
        </p>

        <form action="/api/waitlist" method="post" className="orky-form">
          <input
            type="email"
            name="email"
            placeholder="email"
            autoComplete="email"
            required
            maxLength={254}
            className="orky-input"
            aria-label="Email address"
          />
          <input name="source" type="hidden" value="orky_landing_waitlist" />
          <input name="ftoken" type="hidden" value={token} />
          <input name="fsig" type="hidden" value={signature} />
          <div className="orky-honeypot" aria-hidden="true">
            <label htmlFor="website">website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <button type="submit" className="orky-btn">
            join waitlist
          </button>
        </form>

        {flash === "joined" && <p className="orky-link">you&rsquo;re on the list.</p>}
        {flash === "error" && <p className="orky-link">could not join right now. try again.</p>}

        <form className="orky-steer" aria-label="Public agent steering mock">
          <input
            type="text"
            placeholder="try to steer or derail the agent"
            aria-label="Try to steer or derail the agent"
            disabled
          />
          <button type="button" disabled>
            send
          </button>
        </form>
      </section>

      <section className="orky-stream orky-stream-right" aria-label="Orky alignment checks">
        <p className="orky-stream-label">orky checks</p>
        <div className="orky-stream-list">
          {orkyChecks.map((check) => (
            <article className={`orky-check orky-check-${check.label}`} key={check.title}>
              <span>{check.label}</span>
              <h2>{check.title}</h2>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
