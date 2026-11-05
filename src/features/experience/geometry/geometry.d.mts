import type { Node, Edge, XYPosition, NodeChange } from '@xyflow/react';
export type RoutedGeometry = { id:string; points:XYPosition[]; label:{x:number;y:number;width:number;height:number}; path:string };
export function initialGeometry<N extends Node>(graph:{nodes:N[];edges:Edge[]},surface:string): (N & {width:number;height:number})[];
export function movedGeometry<N extends Node>(nodes:N[],overrides?:Record<string,XYPosition>):N[];
export function changePositions(previous:Record<string,XYPosition>,changes:NodeChange[]):Record<string,XYPosition>;
export function routeGeometry(nodes:Node[],edges:Edge[]):Edge<{geometry:RoutedGeometry}>[];
export function routeBounds(edge:Edge):{x:number;y:number;width:number;height:number}|null;
