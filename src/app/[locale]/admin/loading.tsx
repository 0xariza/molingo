export default function Loading() {
  return (
    <div aria-hidden="true" className="animate-pulse space-y-4">
      <div className="h-10 w-1/2 rounded-full bg-mist" />
      <div className="h-32 w-full rounded-card bg-mist" />
    </div>
  );
}
