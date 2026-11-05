import type { CSSProperties } from "react";

// Decorative vocabulary. Exact declared type only; never infer identity or relations.
const glyphs: Record<string, [string, string]> = {
  command_and_data_handling: ["#2bd5a0", "M6 6h12v12H6z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"],
  power_management: ["#ffbd43", "M14 2L5 14h6l-1 8 9-13h-7z"],
  attitude_control: ["#b583ff", "M12 2v4m0 12v4M2 12h4m12 0h4 M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14 M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6"],
  low_rate_communications: ["#54aaff", "M12 7v14m-5 0 5-10 5 10 M8 5a6 6 0 0 0 0 9m8-9a6 6 0 0 1 0 9 M5 2a10 10 0 0 0 0 15m14-15a10 10 0 0 1 0 15"],
  high_rate_communications: ["#28d5e5", "M12 7v14m-5 0 5-10 5 10 M8 5a6 6 0 0 0 0 9m8-9a6 6 0 0 1 0 9 M5 2a10 10 0 0 0 0 15m14-15a10 10 0 0 1 0 15"],
  payload: ["#ff668b", "M2 12h5l3-8 4 16 3-8h5"],
  onboard_storage: ["#b583ff", "M4 6c0-5 16-5 16 0s-16 5-16 0v12c0 5 16 5 16 0V6 M4 12c0 5 16 5 16 0"],
};
const generic: [string,string] = ["#62b5ff", "M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5M12 12v10"];
export function entityDecoration(declaredType?: unknown) {
  const [color,path] = typeof declaredType === "string" ? glyphs[declaredType] ?? generic : generic;
  return { color, path };
}
export function EntityGlyph({ declaredType }: { declaredType?: unknown }) {
  const {color,path}=entityDecoration(declaredType);
  return <span className="entity-glyph" style={{"--entity-accent":color} as CSSProperties} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg></span>;
}
