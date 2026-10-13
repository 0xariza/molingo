/** Hidden from people (off-screen, not focusable, not announced); bots that fill every field trip it. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}
