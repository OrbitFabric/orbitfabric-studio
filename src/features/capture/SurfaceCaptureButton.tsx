import { CAPTURE_SURFACE_SELECTOR, preserveCaptureReadingPosition } from "./captureComposition";
import { useCallback, useEffect, useRef, useState } from "react";

import type { EntityRef } from "../../mission/entityRef";
import { captureCurrentStudioSurface } from "./offscreenGraphCapture";

interface SurfaceCaptureButtonProps {
  missionId: string;
  view: string;
  selection: EntityRef | null;
  disabled?: boolean;
}

type CapturePhase = "idle" | "capturing" | "saved" | "failed";

interface CaptureState {
  phase: CapturePhase;
  detail: string;
}

const DEFAULT_TITLE = "Capture the full current Studio surface as PNG. Shortcut: Ctrl/Cmd+Shift+C";

export function SurfaceCaptureButton({
  missionId,
  view,
  selection,
  disabled = false,
}: SurfaceCaptureButtonProps) {
  const [captureState, setCaptureState] = useState<CaptureState>({
    phase: "idle",
    detail: DEFAULT_TITLE,
  });
  const resetTimerRef = useRef<number | null>(null);

  const resetLater = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCaptureState({ phase: "idle", detail: DEFAULT_TITLE });
      resetTimerRef.current = null;
    }, 3200);
  }, []);

  const handleCapture = useCallback(async () => {
    if (disabled || captureState.phase === "capturing") {
      return;
    }

    const restoreReadingPosition = preserveCaptureReadingPosition(
      document.querySelector<HTMLElement>(CAPTURE_SURFACE_SELECTOR),
    );

    // Capture layout must be active before the renderer performs any measurement.
    // React state updates are asynchronous, so the body attribute is the synchronous
    // source of truth for capture-only CSS expansion.
    if (!document.querySelector(`${CAPTURE_SURFACE_SELECTOR} .scenario-layout`)) {
      document.body.setAttribute("data-studio-capture", "active");
    }

    setCaptureState({
      phase: "capturing",
      detail: "Rendering the complete current Studio surface…",
    });

    try {
      const result = await captureCurrentStudioSurface({
        missionId,
        view,
        selection,
      });
      const clipboardNote = result.copiedToClipboard ? " PNG copied to clipboard." : "";

      setCaptureState({
        phase: "saved",
        detail: `Saved ${result.width}×${result.height} surface to ${result.path}.${clipboardNote}`,
      });
      resetLater();
    } catch (error) {
      console.error("[surface-capture] Capture failed", error);
      setCaptureState({
        phase: "failed",
        detail: captureErrorDetail(error),
      });
      resetLater();
    } finally {
      document.body.removeAttribute("data-studio-capture");
      restoreReadingPosition();
    }
  }, [captureState.phase, disabled, missionId, resetLater, selection, view]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isEditing = target?.closest("input, textarea, select, [contenteditable='true']");

      if (isEditing) {
        return;
      }

      const usesPrimaryModifier = event.ctrlKey || event.metaKey;
      if (!usesPrimaryModifier || !event.shiftKey || event.altKey || event.key.toLowerCase() !== "c") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleCapture();
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleCapture]);

  useEffect(
    () => () => {
      document.body.removeAttribute("data-studio-capture");
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  return (
    <button
      className="secondary-action capture-action"
      type="button"
      disabled={disabled || captureState.phase === "capturing"}
      title={captureState.detail}
      aria-label="Capture full current Studio surface as PNG"
      data-capture-phase={captureState.phase}
      onClick={() => void handleCapture()}
    >
      {captureLabel(captureState.phase)}
    </button>
  );
}

function captureErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error instanceof Event) {
    const eventType = error.type || "error";
    const target = error.target;
    const targetDescription =
      target instanceof Element ? ` from <${target.tagName.toLowerCase()}>` : "";
    return `Capture renderer emitted an ${eventType} event${targetDescription}.`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // Fall through to the stable generic message below.
  }

  return "Capture failed with an unrecognized renderer error.";
}

function captureLabel(phase: CapturePhase): string {
  switch (phase) {
    case "capturing":
      return "Capturing…";
    case "saved":
      return "Captured ✓";
    case "failed":
      return "Capture failed";
    default:
      return "Capture";
  }
}
