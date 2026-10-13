/** Non-interactive placeholder while a request-dependent form streams in. */
export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse space-y-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-1/3 rounded-full bg-mist" />
          <div className="h-11 w-full rounded-2xl bg-mist" />
        </div>
      ))}
      <div className="h-11 w-full rounded-pill bg-mist" />
    </div>
  );
}
