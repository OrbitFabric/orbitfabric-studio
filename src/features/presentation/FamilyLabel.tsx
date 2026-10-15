import type { ReactNode } from "react";
import { familyMarker } from "./familyMarkers";

// Decoration is deliberately inseparable from the caller's existing visible text.
// No identity, status, selection, event handler or navigation state enters here.
export function FamilyLabel({ family, children }: {
  family: string | null;
  children: ReactNode;
}) {
  const marker = familyMarker(family);
  if (!marker) return <>{children}</>;
  return <span className="family-label">
    <svg className={`family-marker family-accent-${marker.accent}`} data-family={family}
      width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"><path d={marker.path} /></svg>
    {children}
  </span>;
}
