import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function CliReferencePage() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="CLI reference"
        description="Every subcommand that ships in v0, flags, and examples. No subcommand opens the OpenTUI workbench."
      />
      <div className="doc-prose">
        <h2 id="invocation">Invocation</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate                    # OpenTUI workbench
orkestrate <command> [subcommand] [args] [--flags]`}
        />
        <p>
          Runtime: Bun. Version string from package metadata (<code>orkestrate doctor</code> header).
        </p>

        <h2 id="doctor">doctor</h2>
        <CodeBlock lang="bash" code="orkestrate doctor" />
        <p>
          Lists installed packs and harness driver detection (OpenCode on PATH). Use after install and
          before debugging launch.
        </p>

        <h2 id="pack">pack</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack list
orkestrate pack install <slug> [--global]
orkestrate pack create <id> [--from coding] [--description "..."] [--global]
orkestrate pack validate <id>`}
        />
        <table>
          <thead>
            <tr>
              <th>Subcommand</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>list</code>
              </td>
              <td>Installed packs visible from cwd (workspace + global).</td>
            </tr>
            <tr>
              <td>
                <code>install</code>
              </td>
              <td>Copy from <strong>bundled</strong> catalog in npm package only.</td>
            </tr>
            <tr>
              <td>
                <code>create</code>
              </td>
              <td>
                Scaffold from <code>--from</code> template (<code>coding</code>,{" "}
                <code>extension-builder</code>, …).
              </td>
            </tr>
            <tr>
              <td>
                <code>validate</code>
              </td>
              <td>Layout + harness checks for pack id or path.</td>
            </tr>
          </tbody>
        </table>
        <Callout kind="note" title="Not shipped">
          <code>pack submit</code> — use <Link href="/submit">web publish</Link>.
        </Callout>

        <h2 id="run">run</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate run launch <pack-id>
orkestrate run spawn <pack-id>    # alias of launch
orkestrate run list
orkestrate run status <run-id>
orkestrate run stop <run-id>`}
        />
        <p>
          <code>launch</code> / <code>spawn</code> sync harness slice, open new terminal with OpenCode,
          print <code>runId</code>. <code>status</code> requires a run id (JSON dump). <code>list</code>{" "}
          reconciles stale processes then prints all runs.
        </p>

        <h2 id="registry">registry</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate registry list
orkestrate registry search <query>
orkestrate registry install <slug> [--global] [--overwrite]`}
        />
        <p>
          Merges bundled + remote API catalog for list/search. Install clones GitHub per registry manifest.
        </p>

        <h2 id="extension">extension</h2>
        <CodeBlock lang="bash" code="orkestrate extension validate <path>" />
        <p>
          Loads extension module and prints id/version. OpenCode driver lives at{" "}
          <code>extensions/opencode-adapter/</code> in the monorepo.
        </p>

        <h2 id="profile-legacy">profile (legacy)</h2>
        <CodeBlock lang="bash" code="orkestrate profile validate <pack-id>" />
        <p>
          Deprecated alias for <code>pack validate</code>. Other profile subcommands redirect to pack/run
          with an error message.
        </p>

        <h2 id="env">Environment</h2>
        <ul>
          <li>
            <code>ORKESTRATE_REGISTRY_URL</code> — registry API base (default production URL).
          </li>
        </ul>

        <h2 id="data-dirs">Data directories (per repo)</h2>
        <CodeBlock
          lang="text"
          code={`.orkestrate/packs/<id>/           # installed pack trees
.orkestrate/pack-homes/<id>/home/   # OpenCode runtime homes
.orkestrate/runs/<run-id>/         # launch metadata`}
        />

        <h2 id="exit">Exit codes</h2>
        <p>
          Non-zero on usage errors, validation failures, missing packs, or launch/driver errors. Messages
          are printed to stderr; workbench shows the same error string in the footer briefly.
        </p>
      </div>
      <DocPrevNext href="/docs/reference/cli" />
    </>
  );
}