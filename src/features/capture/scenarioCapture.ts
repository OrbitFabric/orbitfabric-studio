import { invoke } from '@tauri-apps/api/core';
import type { EntityRef } from '../../mission/entityRef';
import type { SurfaceCaptureResult } from './surfaceCapture';

// Scenarios export is a snapshot of the mounted declaration, not a second React
// render or a graph fit. Only the detached copy expands authored detail.
export function createScenarioCaptureClone(live: HTMLElement) {
  const host = document.createElement('div');
  host.className = 'studio-main-surface';
  host.dataset.scenarioCaptureHost = 'true';
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  Object.assign(host.style, {position: 'fixed', left: '-20000px', top: '0',
    width: `${live.getBoundingClientRect().width}px`, height: 'auto', overflow: 'visible', pointerEvents: 'none'});
  const target = live.cloneNode(true) as HTMLElement;
  const style = getComputedStyle(live);
  // Theme tokens normally arrive through ancestors outside the capture root.
  for (const property of Array.from(style)) {
    if (property.startsWith('--') || ['color', 'font-family', 'font-size', 'line-height'].includes(property)) {
      target.style.setProperty(property, style.getPropertyValue(property));
    }
  }
  const originals = [live, ...live.querySelectorAll<HTMLElement>('*')];
  const copies = [target, ...target.querySelectorAll<HTMLElement>('*')];
  originals.forEach((original, index) => {
    const copy = copies[index];
    if (original instanceof HTMLSelectElement) {
      const text = document.createElement('span');
      text.className = original.className;
      text.textContent = Array.from(original.selectedOptions).map(option => option.label).join(', ');
      copy.replaceWith(text);
    }
    // Preserve the actual graph box and transform, including a user-panned view.
    if (original.matches('.engineering-canvas, .react-flow')) {
      const box = original.getBoundingClientRect();
      copy.style.setProperty('width', `${box.width}px`, 'important');
      copy.style.setProperty('height', `${box.height}px`, 'important');
      copy.style.setProperty('flex', 'none', 'important');
    }
    if (original.matches('.workspace-layout')) {
      copy.style.gridTemplateColumns = getComputedStyle(original).gridTemplateColumns;
    }
  });
  // Export the source inventory and every authored field, including collapsed
  // metadata. This never opens disclosures in the interactive application.
  target.querySelectorAll<HTMLDetailsElement>(
    '.scenario-sources, .scenario-content details, .scenario-provenance, .scenario-source-identity',
  ).forEach(details => { details.open = true; });
  for (const element of [target, ...target.querySelectorAll<HTMLElement>(
    '.workspace-layout, .workspace-primary, .entity-xray, .xray-scroll, .investigation-panel, .investigation-content',
  )]) {
    Object.assign(element.style, {height: 'auto', minHeight: '0', maxHeight: 'none', overflow: 'visible', alignSelf: 'start'});
  }
  target.style.width = `${live.getBoundingClientRect().width}px`;
  target.dataset.scenarioCapture = 'true';
  host.appendChild(target);
  return {host, target};
}

export async function captureScenarioSurface(
  live: HTMLElement, request: {missionId: string; view: string; selection: EntityRef | null},
): Promise<SurfaceCaptureResult> {
  // Snapshot synchronously, before any async font/image work or user navigation.
  const {host, target} = createScenarioCaptureClone(live);
  document.body.appendChild(host);
  try {
    await document.fonts?.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const width = Math.ceil(target.getBoundingClientRect().width);
    const height = Math.ceil(Math.max(target.scrollHeight, target.getBoundingClientRect().height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 16384 / width, 16384 / height,
      Math.sqrt(64_000_000 / (width * height)));
    if (!(width > 0 && height > 0 && pixelRatio > 0)) throw new Error('Invalid Scenario capture dimensions.');
    // Browser SVG foreignObject preserves CSS grid, nested transforms and the
    // original SVG edges/markers. No synthetic edge overlay or graph reframing.
    const {toPng} = await import('html-to-image');
    const dataUrl = await toPng(target, {width, height, pixelRatio, cacheBust: false,
      backgroundColor: getComputedStyle(live.closest('.studio-main-surface') ?? document.body).backgroundColor});
    const filename = ['orbitfabric-studio', request.missionId, request.view, new Date().toISOString()]
      .join('__').replace(/[^a-zA-Z0-9_.-]/g, '-') + '.png';
    const saved = await invoke<{path: string}>('save_surface_capture_png', {filename, dataUrl});
    let copiedToClipboard = false;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
        copiedToClipboard = true;
      }
    } catch { /* Saving succeeds independently of clipboard permission. */ }
    return {path: saved.path, copiedToClipboard, width, height};
  } finally { host.remove(); }
}
