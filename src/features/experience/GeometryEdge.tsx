import { BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';
import type { RoutedGeometry } from './geometry/geometry.mjs';
// Adapted from accepted S3 GeometryEdge.jsx; exact Core ID remains the click identity.
function GeometryEdge({id,data,label,markerEnd,style,selected}:EdgeProps<Edge<{geometry:RoutedGeometry}>>) {
  if (!data?.geometry) return null;
  const geometry=data.geometry, rect=geometry.label;
  return <><BaseEdge id={id} path={geometry.path} markerEnd={markerEnd} style={style} interactionWidth={18}/>
    <foreignObject x={rect.x} y={rect.y} width={rect.width} height={rect.height} className="geometry-label-box">
      <div className={`geometry-label ${selected?'inspected':''}`}>{label}</div>
    </foreignObject></>;
}
export const geometryEdgeTypes={geometry:GeometryEdge};
