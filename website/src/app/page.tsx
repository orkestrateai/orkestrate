import { cookies } from "next/headers";
import Image from "next/image";
import { createWaitlistFormToken } from "@/lib/launch/form-token";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const flash = cookieStore.get("orky_flash")?.value;
  const { token, signature } = createWaitlistFormToken();

  return (
    <main className="orky-page">
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
    </main>
  );
}
