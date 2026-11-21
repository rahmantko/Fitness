export function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        Checkpoint
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="mb-5 text-xl font-semibold">{title}</h1>
        {children}
      </div>
      <p className="mt-4 text-center text-sm text-muted">{footer}</p>
    </main>
  );
}
