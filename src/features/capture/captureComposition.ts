// Both rasterizers capture this composition, not window chrome. It contains the
// visible Investigation context and the workspace/Inspector as sibling regions.
export const CAPTURE_SURFACE_SELECTOR = '.studio-main-surface .studio-capture-surface';

// Read before capture-only CSS expands any scroll boundary. Restore only nodes
// still belonging to this live composition, including on render/save failure.
export function preserveCaptureReadingPosition(root: HTMLElement | null): () => void {
  if (!root) return () => {};
  const positions = [root, ...root.querySelectorAll<HTMLElement>('*')]
    .filter(element => !element.closest('.react-flow'))
    .map(element => ({element, top: element.scrollTop, left: element.scrollLeft}));
  return () => {
    for (const {element, top, left} of positions) {
      if (element.isConnected && (element === root || root.contains(element))) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    }
  };
}
