/**
 * Whether the floating class window may open by itself. A shared whole screen (`monitor`) would
 * show that window to everyone, so it only opens on request for anything else.
 */
export const canAutoFloat = (displaySurface?: string) => displaySurface !== "monitor";
