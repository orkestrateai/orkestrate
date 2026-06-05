import { codeToHtml } from "shiki";
import CodeBlockClient from "./code-block-client";

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
  /** @deprecated ignored — theme follows site light/dark */
  theme?: string;
}

export default async function CodeBlock({ code, lang = "bash", filename }: CodeBlockProps) {
  const trimmed = code.trim();
  const [darkHtml, lightHtml] = await Promise.all([
    codeToHtml(trimmed, { lang, theme: "github-dark" }),
    codeToHtml(trimmed, { lang, theme: "github-light" }),
  ]);

  return (
    <CodeBlockClient
      code={trimmed}
      darkHtml={darkHtml}
      lightHtml={lightHtml}
      filename={filename}
    />
  );
}