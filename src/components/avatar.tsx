const SIZES = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-24 w-24 text-2xl" } as const;

/** Profile picture, or the person's initials when they haven't added one. */
export function Avatar({
  name,
  avatarKey,
  size = "sm",
}: {
  name: string;
  avatarKey?: string | null;
  size?: keyof typeof SIZES;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  const cls = `${SIZES[size]} shrink-0 rounded-full object-cover`;
  if (avatarKey) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${avatarKey}`} alt="" className={`${cls} bg-surface-2`} />;
  }
  return (
    <span aria-hidden className={`${cls} flex items-center justify-center bg-accent-soft font-semibold text-accent`}>
      {initials}
    </span>
  );
}
