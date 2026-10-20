import { FamilyLabel } from "../presentation/FamilyLabel";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
// S1 materialization adapted from Lab Presentation.jsx. The caller owns exact identity.
export function InspectorFrame({
  identity,
  family,
  notice,
  title,
  children,
  onReturn,
  onClear,
}: {
  identity: string;
  family?: string | null;
  notice?: ReactNode;
  title: string;
  children: ReactNode;
  onReturn?: () => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(400);
  const [compact, setCompact] = useState(() => window.innerWidth <= 700);
  const [reading, setReading] = useState(true);
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = matchMedia("(max-width:700px)");
    const update = () => setCompact(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  const readingPosition = useRef(0);
  const restoringScroll = useRef(false);
  useLayoutEffect(() => {
    readingPosition.current = 0;
    opener.current = document.activeElement as HTMLElement;
    setReading(true);
    scroll.current?.scrollTo(0, 0);
  }, [identity]);
  const modal = expanded || (compact && reading);
  // Browser scroll anchoring can move the reader when the same body changes width.
  // Keep the current reading offset, including deliberate keyboard navigation.
  useLayoutEffect(() => {
    if (compact && !reading) return;
    const top=readingPosition.current;
    restoringScroll.current=true;
    scroll.current?.scrollTo(0,top);
    const frame=requestAnimationFrame(()=>{scroll.current?.scrollTo(0,top);restoringScroll.current=false;});
    return ()=>cancelAnimationFrame(frame);
  },[modal,compact,width,reading]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const background = [
      ...document.querySelectorAll<HTMLElement>(
        ".studio-topbar,.investigation-panel,.workspace-primary",
      ),
    ];
    background.forEach((el) => (el.inert = true));
    panel.current?.querySelector("button")?.focus();
    return () => {
      background.forEach((el) => (el.inert = false));
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [modal]);
  const closeDetail = () => {
    readingPosition.current = scroll.current?.scrollTop ?? readingPosition.current;
    setExpanded(false);
    setReading(false);
    requestAnimationFrame(
      () =>
        opener.current?.isConnected &&
        opener.current.focus({ preventScroll: true }),
    );
  };
  return (
    <aside
      className={`experience-inspector ${modal ? "is-expanded" : ""} ${compact && !reading ? "is-compact" : ""}`}
      style={{ width: modal || compact ? undefined : width }}
      ref={panel}
      role={modal ? "dialog" : "complementary"}
      aria-modal={modal || undefined}
      aria-label="Engineering Inspector"
      onKeyDown={(e) => {
        if (e.key === "Escape" && modal) {
          e.stopPropagation();
          closeDetail();
        }
        if (e.key === "Tab" && modal) {
          const all = [
            ...panel.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),summary,a[href],select,[tabindex="0"]',
            ),
          ].filter((el) => el.getClientRects().length);
          if (e.shiftKey && document.activeElement === all[0]) {
            e.preventDefault();
            all[all.length - 1]?.focus();
          }
          if (!e.shiftKey && document.activeElement === all[all.length - 1]) {
            e.preventDefault();
            all[0]?.focus();
          }
        }
      }}
    >
      <header>
        <p className="eyebrow">INSPECT · EXACT SUBJECT</p>
        <h2><FamilyLabel family={family ?? null}>{title}</FamilyLabel></h2>
        {notice && <p role="status" className="inspector-orientation">{notice}</p>}
        <div className="experience-tools">
          {modal ? (
            <button className="secondary-action" onClick={closeDetail}>
              Return to context
            </button>
          ) : (
            <button
              className="secondary-action"
              onClick={() => {
                setReading(true);
                setExpanded(!compact);
              }}
            >
              Read details
            </button>
          )}
          {onReturn && (
            <button className="secondary-action" onClick={onReturn}>
              Return to previous subject
            </button>
          )}
          <button className="secondary-action" onClick={onClear}>
            Clear inspection
          </button>
        </div>
        {!compact && !modal && (
          <label className="inspector-size">
            Width{" "}
            <input
              aria-label="Inspector width"
              type="range"
              min="320"
              max="560"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
        )}
      </header>
      <div
        ref={scroll}
        className="experience-inspector-body"
        onScroll={e=>{if(!restoringScroll.current && (!compact || reading))readingPosition.current=e.currentTarget.scrollTop;}}
        hidden={compact && !reading}
      >
        {children}
      </div>
    </aside>
  );
}
