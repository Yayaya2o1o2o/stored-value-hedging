import fs from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export const metadata = {
  title: "Paper: Hedge-Ratio Optimization Under Uncertain Redemption Demand",
};

export default function PaperPage() {
  const md = fs.readFileSync(
    path.join(process.cwd(), "content", "paper.md"),
    "utf8"
  );

  return (
    <main className="mx-auto max-w-3xl px-5">
      <section className="pt-12 pb-6">
        <p className="eyebrow">Full text · APA 7 · figures and raw output in the repository</p>
      </section>
      <article className="paper-body pb-16">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {md}
        </ReactMarkdown>
      </article>
    </main>
  );
}
