export const GITHUB_REPO = "orkestrateai/orkestrate";
export const GITHUB_BRANCH = "main";
export const DOCS_APP_ROOT = "website/src/app/docs";

const REPO_URL = `https://github.com/${GITHUB_REPO}`;

export function docsSourcePath(pathname: string): string | null {
  if (!pathname.startsWith("/docs")) return null;
  if (pathname === "/docs") return `${DOCS_APP_ROOT}/page.tsx`;
  const segment = pathname.replace(/^\/docs\/?/, "");
  if (!segment) return `${DOCS_APP_ROOT}/page.tsx`;
  return `${DOCS_APP_ROOT}/${segment}/page.tsx`;
}

export function docsBlobUrl(pathname: string): string | null {
  const path = docsSourcePath(pathname);
  if (!path) return null;
  return `${REPO_URL}/blob/${GITHUB_BRANCH}/${path}`;
}

export function docsEditUrl(pathname: string): string | null {
  const path = docsSourcePath(pathname);
  if (!path) return null;
  return `${REPO_URL}/edit/${GITHUB_BRANCH}/${path}`;
}

export const docsTreeUrl = `${REPO_URL}/tree/${GITHUB_BRANCH}/${DOCS_APP_ROOT}`;
export const contributingUrl = `${REPO_URL}/blob/${GITHUB_BRANCH}/CONTRIBUTING.md`;
export const docsIssuesUrl = `${REPO_URL}/issues/new?labels=documentation&title=Docs:`;