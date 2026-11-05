# Third-Party Notices

OrbitFabric Studio is licensed under Apache-2.0. It uses third-party dependencies under their own licenses.

This source repository does not vendor `node_modules`. Dependencies are retrieved by the package manager from the versions pinned by `package-lock.json`.

## Graph rendering and layout

### @xyflow/react 12.11.2

- Project: React Flow / xyflow
- License: MIT
- Repository: https://github.com/xyflow/xyflow

React Flow provides the interactive Context Map rendering primitives used by Studio.

### elkjs 0.11.1

- Project: ELK for JavaScript
- License: Eclipse Public License 2.0 (EPL-2.0)
- Repository: https://github.com/kieler/elkjs
- Version source: tag `0.11.1`

ELK computes layout positions for the Context Map. Studio does not modify ELK source code.

## Surface capture

### html-to-image 1.11.11

- Project: html-to-image
- License: MIT
- Repository: https://github.com/bubkoo/html-to-image

Studio uses `html-to-image` for ordinary mission workspace surfaces such as Mission Atlas and Entity X-Ray. The version is intentionally pinned exactly to `1.11.11`, matching React Flow's current download-image compatibility guidance.

### html2canvas 1.4.1

- Project: html2canvas
- License: MIT
- Repository: https://github.com/niklasvh/html2canvas

Studio uses `html2canvas` as the graph-surface renderer when the active workspace contains React Flow. This avoids the SVG `foreignObject` to browser-image round trip that fails in the Windows WebView2 runtime for the current Context Map and Operational State Map surfaces.

The first Studio Public Preview is a developer/source distribution and does not vendor ELK binaries or `node_modules`. A future packaged desktop distribution must include the notices and license material required by the applicable dependency licenses and re-check the exact bundled dependency versions at release time.

## Release rule

Before any packaged/binary Studio release:

1. regenerate a complete third-party dependency inventory from the release lockfiles;
2. include required copyright/license notices in the distribution;
3. re-check dependencies whose license changed between versions;
4. do not infer a package's license from the current upstream branch when Studio pins an older release.

## Inter font (Visual Slice 1.1)

Offline Latin font files in `src/assets/fonts/` are from the Inter distribution via @fontsource/inter. Copyright and SIL Open Font License terms are retained in `src/assets/fonts/OFL.txt`.
