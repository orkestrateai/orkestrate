"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { confirmSubmitAction, inspectPackAction, type InspectPackResult } from "./actions";

type SubmitFlowProps = {
  userEmail: string | null;
  initialError?: string;
};

export default function SubmitFlow({ userEmail, initialError }: SubmitFlowProps) {
  const [inspectState, inspectAction, inspectPending] = useActionState<
    InspectPackResult | null,
    FormData
  >(inspectPackAction, null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [gitRef, setGitRef] = useState("main");
  const [packPath, setPackPath] = useState("");

  const confirmed = inspectState?.ok === true ? inspectState : null;
  const inspectError = inspectState?.ok === false ? inspectState.error : initialError;

  useEffect(() => {
    if (inspectState?.ok) {
      setGitRef(inspectState.inspected.github.ref);
      setPackPath(inspectState.inspected.github.packPath);
    }
  }, [inspectState]);

  return (
    <div className="grid gap-6">
      <div className="border-b border-default pb-5">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Submit a pack</h2>
        {userEmail && <p className="mt-1 text-[13px] text-muted">{userEmail}</p>}
      </div>

      {inspectError && (
        <div className="border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100 rounded-lg">
          {inspectError}
        </div>
      )}

      {!confirmed ? (
        <form action={inspectAction} className="grid gap-5">
          <label className="grid gap-1.5 text-[13px] text-muted font-medium">
            GitHub repository URL
            <input
              name="github_url"
              type="url"
              required
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/you/my-pack"
              className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
            />
          </label>
          <p className="-mt-2 text-[12px] leading-relaxed text-muted">
            Public repo with <code className="text-[11px] font-mono">pack.yaml</code> at the root, or paste
            a GitHub folder URL (tree/blob) pointing at your pack directory.
          </p>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-left text-[13px] text-muted hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            {showAdvanced ? "− Hide" : "+"} Monorepo options
          </button>

          {showAdvanced && (
            <div className="grid gap-4 rounded-lg border border-default bg-card p-4">
              <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                Branch or tag
                <input
                  name="git_ref"
                  value={gitRef}
                  onChange={(e) => setGitRef(e.target.value)}
                  placeholder="main"
                  className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                />
              </label>
              <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                Pack path in repo
                <input
                  name="pack_path"
                  value={packPath}
                  onChange={(e) => setPackPath(e.target.value)}
                  placeholder="orkestrate/packs/coding"
                  className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                />
              </label>
              <p className="text-[12px] text-muted">
                Directory containing <code className="font-mono text-[11px]">pack.yaml</code>, not the file
                itself.
              </p>
            </div>
          )}

          {!showAdvanced && (
            <>
              <input type="hidden" name="git_ref" value={gitRef} />
              <input type="hidden" name="pack_path" value={packPath} />
            </>
          )}

          <button
            type="submit"
            disabled={inspectPending}
            className="h-10 rounded-lg bg-[var(--foreground)] px-5 text-[13px] font-semibold text-[var(--background)] transition-all hover:bg-neutral-200 cursor-pointer disabled:opacity-60"
          >
            {inspectPending ? "Loading pack.yaml…" : "Load pack.yaml"}
          </button>
        </form>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-lg border border-default bg-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Confirm</p>
            <dl className="mt-4 grid gap-3 text-[14px]">
              <div className="flex justify-between gap-4 border-b border-default pb-2">
                <dt className="text-muted">Registry slug</dt>
                <dd className="font-mono text-[var(--foreground)]">{confirmed.slug}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-default pb-2">
                <dt className="text-muted">Name</dt>
                <dd className="text-[var(--foreground)]">{confirmed.inspected.pack.name}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-default pb-2">
                <dt className="text-muted">Version</dt>
                <dd className="font-mono text-[var(--foreground)]">{confirmed.inspected.pack.version}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-default pb-2">
                <dt className="text-muted">Harness</dt>
                <dd className="font-mono text-[var(--foreground)]">{confirmed.inspected.pack.harness}</dd>
              </div>
              <div>
                <dt className="text-muted">Description</dt>
                <dd className="mt-1 text-[var(--foreground)] leading-relaxed">
                  {confirmed.inspected.pack.description}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Repository</dt>
                <dd className="mt-1">
                  <a
                    href={confirmed.inspected.github.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--foreground)] underline underline-offset-2"
                  >
                    {confirmed.inspected.github.webUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted">pack.yaml</dt>
                <dd className="mt-1 font-mono text-[12px] text-muted break-all">
                  {confirmed.inspected.packYamlPath} @ {confirmed.inspected.github.ref}
                </dd>
              </div>
            </dl>
          </div>

          <form action={confirmSubmitAction} className="flex flex-wrap gap-3">
            <input type="hidden" name="github_url" value={githubUrl} />
            <input type="hidden" name="git_ref" value={confirmed.inspected.github.ref} />
            <input type="hidden" name="pack_path" value={confirmed.inspected.github.packPath} />
            <button
              type="submit"
              className="h-10 rounded-lg bg-[var(--foreground)] px-5 text-[13px] font-semibold text-[var(--background)] transition-all hover:bg-neutral-200 cursor-pointer"
            >
              Submit for review
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 rounded-lg border border-default px-5 text-[13px] font-medium text-muted hover:text-[var(--foreground)] cursor-pointer"
            >
              Back
            </button>
          </form>
        </div>
      )}

      <p className="text-[12px] text-muted leading-relaxed">
        Harness adapters and non-pack entries: see{" "}
        <Link href="/docs/publisher" className="underline underline-offset-2 hover:text-[var(--foreground)]">
          publisher guide
        </Link>{" "}
        and open a GitHub issue for now.
      </p>
    </div>
  );
}