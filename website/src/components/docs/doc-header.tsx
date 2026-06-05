export default function DocHeader({
  eyebrow,
  title,
  description,
  v0Note,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  v0Note?: string;
}) {
  return (
    <header className="mb-10 border-b border-default pb-8">
      {eyebrow && (
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
      )}
      <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-[2.25rem]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">{description}</p>
      {v0Note && (
        <p className="mt-4 rounded-lg border border-default bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-[var(--foreground)]">v0 scope: </span>
          {v0Note}
        </p>
      )}
    </header>
  );
}