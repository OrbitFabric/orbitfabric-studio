import { CAPTURE_SURFACE_SELECTOR } from "./captureComposition";
import { invoke } from "@tauri-apps/api/core";

import type { EntityRef } from "../../mission/entityRef";

const MAX_CANVAS_EDGE = 16_384;
const MAX_CANVAS_PIXELS = 64_000_000;

interface CaptureRequest {
  missionId: string;
  view: string;
  selection: EntityRef | null;
}

interface SurfaceCaptureSaveResult {
  path: string;
}

interface MatrixSnapshot {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface PointSnapshot {
  x: number;
  y: number;
}

interface EdgePathSnapshot {
  d: string;
  matrix: MatrixSnapshot;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  dash: number[];
  dashOffset: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  arrow: {
    tip: PointSnapshot;
    previous: PointSnapshot;
  } | null;
}

interface EdgeLabelSnapshot {
  text: string;
  center: PointSnapshot;
  fontFamily: string;
  fontSize: number;
  fontStyle: string;
  fontWeight: string;
  fill: string;
  opacity: number;
  background: {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
  } | null;
}

interface ReactFlowEdgeSnapshot {
  path: EdgePathSnapshot;
  label: EdgeLabelSnapshot | null;
}

export interface SurfaceCaptureResult {
  path: string;
  copiedToClipboard: boolean;
  width: number;
  height: number;
}

export async function captureCurrentStudioSurface(
  request: CaptureRequest,
): Promise<SurfaceCaptureResult> {
  const target = document.querySelector<HTMLElement>(
    CAPTURE_SURFACE_SELECTOR,
  );

  if (!target) {
    throw new Error("No active Studio surface is available to capture.");
  }

  await waitForStableRendering(target);

  const restoreCaptureLayout = prepareCaptureLayout(target);
  let restoreEdgeVisibility: (() => void) | null = null;

  try {
    await nextAnimationFrame();
    await nextAnimationFrame();

    const rect = target.getBoundingClientRect();
    let descendantRight = rect.right;
    let descendantBottom = rect.bottom;

    for (const element of target.querySelectorAll<Element>("*")) {
      const childRect = element.getBoundingClientRect();
      if (
        !Number.isFinite(childRect.right) ||
        !Number.isFinite(childRect.bottom) ||
        (childRect.width === 0 && childRect.height === 0)
      ) {
        continue;
      }
      descendantRight = Math.max(descendantRight, childRect.right);
      descendantBottom = Math.max(descendantBottom, childRect.bottom);
    }

    const contentWidth = Math.ceil(
      Math.max(target.scrollWidth, rect.width, descendantRight - rect.left),
    );
    const contentHeight = Math.ceil(
      Math.max(target.scrollHeight, rect.height, descendantBottom - rect.top, 1),
    );
    const pixelRatio = captureScale(contentWidth, contentHeight);
    const background = captureBackgroundColor();
    const hasReactFlow = target.querySelector(".react-flow") !== null;

    let edgeSnapshots: ReactFlowEdgeSnapshot[] = [];
    if (hasReactFlow) {
      edgeSnapshots = snapshotReactFlowEdges(target, rect);
      restoreEdgeVisibility = hideReactFlowEdgeLayers(target);
      await nextAnimationFrame();
    }

    const dataUrl = hasReactFlow
      ? await renderGraphSurfaceWithCanvas(
          target,
          contentWidth,
          contentHeight,
          pixelRatio,
          background,
          edgeSnapshots,
        )
      : await renderSurfaceWithHtmlToImage(
          target,
          contentWidth,
          contentHeight,
          pixelRatio,
          background,
        );

    const filename = buildCaptureFilename(request);
    const saved = await invoke<SurfaceCaptureSaveResult>("save_surface_capture_png", {
      filename,
      dataUrl,
    });
    const copiedToClipboard = await copyDataUrlToClipboard(dataUrl);

    return {
      path: saved.path,
      copiedToClipboard,
      width: contentWidth,
      height: contentHeight,
    };
  } finally {
    restoreEdgeVisibility?.();
    restoreCaptureLayout();
  }
}

function prepareCaptureLayout(target: HTMLElement): () => void {
  const restorers: Array<() => void> = [];

  const studioSurface = target.closest<HTMLElement>(".studio-main-surface");
  if (studioSurface) {
    restorers.push(preserveScrollPosition(studioSurface));
    studioSurface.scrollTo({ top: 0, left: 0 });
  }

  restorers.push(
    applyTemporaryStyles(target, {
      height: "auto",
      "min-height": "0",
      "max-height": "none",
      overflow: "visible",
      transform: "none",
    }),
  );

  const nestedScrollers = Array.from(target.querySelectorAll<HTMLElement>("*"))
    .filter((element) => !element.closest(".react-flow"))
    .filter((element) => {
      const style = window.getComputedStyle(element);
      const scrollsVertically = style.overflowY === "auto" || style.overflowY === "scroll";
      return scrollsVertically && element.scrollHeight > element.clientHeight + 1;
    });

  for (const scroller of nestedScrollers) {
    restorers.push(preserveScrollPosition(scroller));
    restorers.push(
      applyTemporaryStyles(scroller, {
        height: "auto",
        "min-height": "0",
        "max-height": "none",
        overflow: "visible",
        "scrollbar-gutter": "auto",
        "align-self": "start",
      }),
    );
    scroller.scrollTo({ top: 0, left: scroller.scrollLeft });
  }

  const xray = target.querySelector<HTMLElement>(".entity-xray");
  if (xray) {
    restorers.push(
      applyTemporaryStyles(xray, {
        height: "auto",
        "min-height": "0",
        "max-height": "none",
        overflow: "visible",
        "grid-template-rows": "auto auto auto",
        "align-self": "start",
      }),
    );
  }

  restorers.push(replaceNativeSelectsForCapture(target));

  return () => {
    for (const restore of restorers.reverse()) {
      restore();
    }
  };
}

function replaceNativeSelectsForCapture(target: HTMLElement): () => void {
  const restorers: Array<() => void> = [];

  // WebKit can reject the SVG data URL produced by html-to-image when a
  // foreignObject contains a populated native select. Keep the selected text
  // visible in the capture while removing the native control from that SVG.
  for (const select of target.querySelectorAll<HTMLSelectElement>("select")) {
    const parent = select.parentNode;
    if (!parent) {
      continue;
    }

    const nextSibling = select.nextSibling;
    const rect = select.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(select);
    const surrogate = document.createElement("div");

    surrogate.dataset.surfaceCaptureControl = "select";
    surrogate.setAttribute("aria-hidden", "true");
    const selectedText = Array.from(select.selectedOptions)
      .map((option) => option.label || option.textContent?.trim() || option.value)
      .filter(Boolean)
      .join(", ");
    surrogate.textContent = selectedText || select.value;

    copyComputedStyle(computedStyle, surrogate);
    surrogate.style.setProperty("box-sizing", "border-box");
    surrogate.style.setProperty("display", "flex");
    surrogate.style.setProperty("align-items", "center");
    surrogate.style.setProperty("width", `${rect.width}px`);
    surrogate.style.setProperty("height", `${rect.height}px`);
    surrogate.style.setProperty("min-width", "0");
    surrogate.style.setProperty("overflow", "hidden");
    surrogate.style.setProperty("text-overflow", "ellipsis");
    surrogate.style.setProperty("white-space", "nowrap");
    surrogate.style.setProperty("appearance", "none");
    surrogate.style.setProperty("-webkit-appearance", "none");

    parent.replaceChild(surrogate, select);
    restorers.push(() => {
      if (surrogate.parentNode) {
        surrogate.parentNode.replaceChild(select, surrogate);
        return;
      }

      if (!select.isConnected && parent.isConnected) {
        parent.insertBefore(
          select,
          nextSibling?.parentNode === parent ? nextSibling : null,
        );
      }
    });
  }

  return () => {
    for (const restore of restorers.reverse()) {
      restore();
    }
  };
}

function copyComputedStyle(
  source: CSSStyleDeclaration,
  target: HTMLElement,
) {
  for (let index = 0; index < source.length; index += 1) {
    const property = source.item(index);
    if (!property) {
      continue;
    }
    target.style.setProperty(
      property,
      source.getPropertyValue(property),
      source.getPropertyPriority(property),
    );
  }
}

function snapshotReactFlowEdges(
  target: HTMLElement,
  targetRect: DOMRect,
): ReactFlowEdgeSnapshot[] {
  const snapshots: ReactFlowEdgeSnapshot[] = [];

  for (const path of target.querySelectorAll<SVGPathElement>(".react-flow__edge-path")) {
    const d = path.getAttribute("d");
    const matrix = path.getScreenCTM();
    if (!d || !matrix) {
      continue;
    }

    const style = window.getComputedStyle(path);
    const strokeOpacity = cssNumber(style.strokeOpacity, 1);
    const elementOpacity = cssNumber(style.opacity, 1);
    const markerEnd = path.getAttribute("marker-end") || style.markerEnd;
    const arrow = markerEnd && markerEnd !== "none"
      ? snapshotPathEnd(path, matrix, targetRect)
      : null;

    const edgeGroup = path.closest<SVGGElement>(".react-flow__edge");
    const text = edgeGroup?.querySelector<SVGTextElement>(".react-flow__edge-text") ?? null;
    const textBackground =
      edgeGroup?.querySelector<SVGElement>(".react-flow__edge-textbg") ?? null;

    snapshots.push({
      path: {
        d,
        matrix: {
          a: matrix.a,
          b: matrix.b,
          c: matrix.c,
          d: matrix.d,
          e: matrix.e - targetRect.left,
          f: matrix.f - targetRect.top,
        },
        stroke: visiblePaint(style.stroke, "#405064"),
        strokeWidth: cssNumber(style.strokeWidth, 1.45),
        opacity: strokeOpacity * elementOpacity,
        dash: parseDashArray(style.strokeDasharray),
        dashOffset: cssNumber(style.strokeDashoffset, 0),
        lineCap: canvasLineCap(style.strokeLinecap),
        lineJoin: canvasLineJoin(style.strokeLinejoin),
        arrow,
      },
      label: text
        ? snapshotEdgeLabel(text, textBackground, targetRect)
        : null,
    });
  }

  return snapshots;
}

function snapshotPathEnd(
  path: SVGPathElement,
  matrix: DOMMatrix,
  targetRect: DOMRect,
): { tip: PointSnapshot; previous: PointSnapshot } | null {
  try {
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) {
      return null;
    }

    const tip = transformSvgPoint(path.getPointAtLength(length), matrix, targetRect);
    const previous = transformSvgPoint(
      path.getPointAtLength(Math.max(0, length - 8)),
      matrix,
      targetRect,
    );

    return { tip, previous };
  } catch {
    return null;
  }
}

function transformSvgPoint(
  point: DOMPoint,
  matrix: DOMMatrix,
  targetRect: DOMRect,
): PointSnapshot {
  const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  return {
    x: transformed.x - targetRect.left,
    y: transformed.y - targetRect.top,
  };
}

function snapshotEdgeLabel(
  text: SVGTextElement,
  background: SVGElement | null,
  targetRect: DOMRect,
): EdgeLabelSnapshot | null {
  const value = text.textContent?.trim();
  if (!value) {
    return null;
  }

  const textRect = text.getBoundingClientRect();
  const style = window.getComputedStyle(text);
  const backgroundRect = background?.getBoundingClientRect() ?? null;
  const backgroundStyle = background ? window.getComputedStyle(background) : null;

  return {
    text: value,
    center: {
      x: textRect.left - targetRect.left + textRect.width / 2,
      y: textRect.top - targetRect.top + textRect.height / 2,
    },
    fontFamily: style.fontFamily || "sans-serif",
    fontSize: cssNumber(style.fontSize, 9),
    fontStyle: style.fontStyle || "normal",
    fontWeight: style.fontWeight || "400",
    fill: visiblePaint(style.fill, "#8090a5"),
    opacity: cssNumber(style.opacity, 1) * cssNumber(style.fillOpacity, 1),
    background:
      backgroundRect && backgroundStyle
        ? {
            x: backgroundRect.left - targetRect.left,
            y: backgroundRect.top - targetRect.top,
            width: backgroundRect.width,
            height: backgroundRect.height,
            fill: visiblePaint(backgroundStyle.fill, "rgba(11, 14, 19, 0.94)"),
            stroke: visiblePaint(backgroundStyle.stroke, "rgba(51, 67, 88, 0.85)"),
            strokeWidth: cssNumber(backgroundStyle.strokeWidth, 1),
            opacity:
              cssNumber(backgroundStyle.opacity, 1) *
              cssNumber(backgroundStyle.fillOpacity, 1),
          }
        : null,
  };
}

function hideReactFlowEdgeLayers(target: HTMLElement): () => void {
  const restorers: Array<() => void> = [];
  const seen = new Set<SVGSVGElement>();

  for (const path of target.querySelectorAll<SVGPathElement>(".react-flow__edge-path")) {
    const svg = path.closest("svg");
    if (!(svg instanceof SVGSVGElement) || seen.has(svg)) {
      continue;
    }
    seen.add(svg);
    const previousVisibility = svg.style.visibility;
    svg.style.visibility = "hidden";
    restorers.push(() => {
      svg.style.visibility = previousVisibility;
    });
  }

  return () => {
    for (const restore of restorers.reverse()) {
      restore();
    }
  };
}

async function renderSurfaceWithHtmlToImage(
  target: HTMLElement,
  width: number,
  height: number,
  pixelRatio: number,
  background: string,
): Promise<string> {
  try {
    const { toPng } = await import("html-to-image");
    return await toPng(target, {
      cacheBust: true,
      pixelRatio,
      width,
      height,
      backgroundColor: background,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        maxHeight: "none",
        overflow: "visible",
        transform: "none",
      },
    });
  } catch (error) {
    throw new Error(`Surface capture failed: ${describeCaptureError(error)}`);
  }
}

async function renderGraphSurfaceWithCanvas(
  target: HTMLElement,
  width: number,
  height: number,
  pixelRatio: number,
  background: string,
  edgeSnapshots: ReactFlowEdgeSnapshot[],
): Promise<string> {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const documentWidth = Math.max(
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      width,
    );
    const documentHeight = Math.max(
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      height,
    );

    const canvas = await html2canvas(target, {
      backgroundColor: background,
      scale: pixelRatio,
      width,
      height,
      windowWidth: documentWidth,
      windowHeight: documentHeight,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 5_000,
    });

    drawReactFlowEdges(canvas, edgeSnapshots, pixelRatio);
    return canvas.toDataURL("image/png");
  } catch (error) {
    throw new Error(`React Flow surface capture failed: ${describeCaptureError(error)}`);
  }
}

function drawReactFlowEdges(
  canvas: HTMLCanvasElement,
  snapshots: ReactFlowEdgeSnapshot[],
  pixelRatio: number,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Studio could not create a 2D context for React Flow edge compositing.");
  }

  for (const snapshot of snapshots) {
    drawEdgePath(context, snapshot.path, pixelRatio);
    if (snapshot.path.arrow) {
      drawEdgeArrow(context, snapshot.path, pixelRatio);
    }
    if (snapshot.label) {
      drawEdgeLabel(context, snapshot.label, pixelRatio);
    }
  }
}

function drawEdgePath(
  context: CanvasRenderingContext2D,
  snapshot: EdgePathSnapshot,
  pixelRatio: number,
) {
  const matrix = snapshot.matrix;
  context.save();
  context.setTransform(
    matrix.a * pixelRatio,
    matrix.b * pixelRatio,
    matrix.c * pixelRatio,
    matrix.d * pixelRatio,
    matrix.e * pixelRatio,
    matrix.f * pixelRatio,
  );
  context.strokeStyle = snapshot.stroke;
  context.lineWidth = snapshot.strokeWidth;
  context.lineCap = snapshot.lineCap;
  context.lineJoin = snapshot.lineJoin;
  context.globalAlpha = snapshot.opacity;
  context.setLineDash(snapshot.dash);
  context.lineDashOffset = snapshot.dashOffset;
  context.stroke(new Path2D(snapshot.d));
  context.restore();
}

function drawEdgeArrow(
  context: CanvasRenderingContext2D,
  snapshot: EdgePathSnapshot,
  pixelRatio: number,
) {
  const arrow = snapshot.arrow;
  if (!arrow) {
    return;
  }

  const angle = Math.atan2(
    arrow.tip.y - arrow.previous.y,
    arrow.tip.x - arrow.previous.x,
  );
  const size = Math.max(6.5, snapshot.strokeWidth * 4.5);

  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.translate(arrow.tip.x, arrow.tip.y);
  context.rotate(angle);
  context.globalAlpha = snapshot.opacity;
  context.fillStyle = snapshot.stroke;
  context.strokeStyle = snapshot.stroke;
  context.lineWidth = Math.max(1, snapshot.strokeWidth * 0.8);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-size, -size * 0.55);
  context.lineTo(-size, size * 0.55);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawEdgeLabel(
  context: CanvasRenderingContext2D,
  label: EdgeLabelSnapshot,
  pixelRatio: number,
) {
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  if (label.background) {
    context.globalAlpha = label.background.opacity;
    context.fillStyle = label.background.fill;
    context.strokeStyle = label.background.stroke;
    context.lineWidth = label.background.strokeWidth;
    context.beginPath();
    roundedRect(
      context,
      label.background.x,
      label.background.y,
      label.background.width,
      label.background.height,
      3,
    );
    context.fill();
    if (label.background.strokeWidth > 0) {
      context.stroke();
    }
  }

  context.globalAlpha = label.opacity;
  context.fillStyle = label.fill;
  context.font = `${label.fontStyle} ${label.fontWeight} ${label.fontSize}px ${label.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label.text, label.center.x, label.center.y);
  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}

function captureScale(width: number, height: number): number {
  let scale = Math.min(window.devicePixelRatio || 1, 2);
  scale = Math.min(scale, MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height);
  scale = Math.min(scale, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));

  if (!Number.isFinite(scale) || scale <= 0) {
    return 1;
  }

  return Math.min(2, scale);
}

function preserveScrollPosition(element: HTMLElement): () => void {
  const top = element.scrollTop;
  const left = element.scrollLeft;

  return () => {
    element.scrollTo({ top, left });
  };
}

function applyTemporaryStyles(
  element: HTMLElement,
  styles: Record<string, string>,
): () => void {
  const previous = Object.entries(styles).map(([property, value]) => {
    const previousValue = element.style.getPropertyValue(property);
    const previousPriority = element.style.getPropertyPriority(property);
    element.style.setProperty(property, value);
    return [property, previousValue, previousPriority] as const;
  });

  return () => {
    for (const [property, previousValue, previousPriority] of previous) {
      if (previousValue) {
        element.style.setProperty(property, previousValue, previousPriority);
      } else {
        element.style.removeProperty(property);
      }
    }
  };
}

async function copyDataUrlToClipboard(dataUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      return false;
    }

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type || "image/png"]: blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function waitForStableRendering(target: HTMLElement) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await waitForImages(target);
  await nextAnimationFrame();
  await nextAnimationFrame();
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img")).filter(
    (image) => !image.complete,
  );

  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function cssNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDashArray(value: string): number[] {
  if (!value || value === "none") {
    return [];
  }
  return value
    .split(/[ ,]+/)
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part));
}

function canvasLineCap(value: string): CanvasLineCap {
  return value === "round" || value === "square" ? value : "butt";
}

function canvasLineJoin(value: string): CanvasLineJoin {
  return value === "round" || value === "bevel" ? value : "miter";
}

function visiblePaint(value: string, fallback: string): string {
  if (!value || value === "none" || value === "transparent") {
    return fallback;
  }
  return value;
}

function describeCaptureError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error instanceof Event) {
    const target = error.target;
    if (target instanceof HTMLImageElement) {
      return "renderer emitted an error event from <img>";
    }
    return `renderer emitted an ${error.type || "unknown"} event`;
  }
  return String(error);
}

function captureBackgroundColor(): string {
  const surface = document.querySelector<HTMLElement>(".studio-main-surface");
  const candidate = surface ?? document.body;
  const background = window.getComputedStyle(candidate).backgroundColor;

  if (
    background &&
    background !== "rgba(0, 0, 0, 0)" &&
    background !== "transparent"
  ) {
    return background;
  }

  return window.getComputedStyle(document.body).backgroundColor || "#0b0e13";
}

function buildCaptureFilename(request: CaptureRequest): string {
  const parts = ["orbitfabric-studio", request.missionId, request.view];

  if (request.selection) {
    parts.push(request.selection.domain, request.selection.id);
  }

  parts.push(new Date().toISOString().replace(/[:.]/g, "-"));
  return `${parts.map(slug).filter(Boolean).join("__")}.png`;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
