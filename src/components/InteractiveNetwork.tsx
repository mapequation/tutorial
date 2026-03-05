/**
 * InteractiveNetwork wraps the Network component with direct selection capability.
 * Users can draw a free-hand lasso on the network visualization itself to select and
 * reassign nodes to communities.
 */

import React, { useRef, useState, useCallback, useMemo } from "react";
import type { Network as NetworkModel, Node as NodeModel } from "../model";
import { observer } from "mobx-react";
import { scaleSqrt } from "d3";
import { getRate, Rate } from "../model";
import Network from "./Network/Network";

interface Props {
  network: NetworkModel;
  numCommunities: number;
  scheme: Record<number, string>;
  schemeAlt?: Record<number, string>;
  showLabels?: boolean;
  showModules?: boolean;
  rate?: any;
  width?: number;
  height?: number;
  children?: React.ReactNode;
}

/**
 * InteractiveNetwork component that allows direct selection on the network SVG.
 * Features:
 * - Community selector buttons (0-n)
 * - Draw a free-hand lasso on the network to select nodes
 * - Assign selected nodes to active community
 * - Visual feedback with lasso and success messages
 */
export default observer(function InteractiveNetwork({
  network,
  numCommunities,
  scheme,
  schemeAlt,
  showLabels = false,
  showModules = false,
  rate,
  width = 800,
  height = 800,
  children,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lassoPointsRef = useRef<[number, number][]>([]);
  const [activeCommunity, setActiveCommunity] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<[number, number][]>([]);
  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<string>("");

  // Node radius scale (same as in Network component)
  const nodeScale = useMemo(() => scaleSqrt().domain([0, 1]).range([10, 100]), []);

  // Use exact same radius calculation as Network component
  const getNodeRate = useMemo(() => getRate(rate), [rate]);

  const getNodeRadius = useCallback(
    (node: NodeModel): number => {
      return nodeScale(getNodeRate(node));
    },
    [nodeScale, getNodeRate]
  );

  /**
   * Get the SVG's bounding rectangle and mouse position in SVG coordinates.
   * SVG uses viewBox, so we need to convert screen coords to viewBox coords.
   * Clamps coordinates to stay strictly within SVG bounds.
   */
  const getSVGCoordinates = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      if (!svgRef.current) return null;

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = svg.viewBox.baseVal.width / rect.width;
      const scaleY = svg.viewBox.baseVal.height / rect.height;

      let x = (clientX - rect.left) * scaleX + svg.viewBox.baseVal.x;
      let y = (clientY - rect.top) * scaleY + svg.viewBox.baseVal.y;

      // Clamp to SVG viewBox bounds
      const minX = svg.viewBox.baseVal.x;
      const maxX = svg.viewBox.baseVal.x + svg.viewBox.baseVal.width;
      const minY = svg.viewBox.baseVal.y;
      const maxY = svg.viewBox.baseVal.y + svg.viewBox.baseVal.height;

      x = Math.max(minX, Math.min(maxX, x));
      y = Math.max(minY, Math.min(maxY, y));

      return [x, y];
    },
    []
  );

  // Setup global mouse tracking
  React.useEffect(() => {
    if (!isDrawing) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Prevent text selection while drawing
      e.preventDefault();
      
      const coords = getSVGCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      lassoPointsRef.current.push(coords);
      
      if (lassoPointsRef.current.length % 3 === 0) {
        setLassoPoints([...lassoPointsRef.current]);
        
        if (lassoPointsRef.current.length >= 3) {
          const nodesInLasso = network.nodes
            .filter((node) => 
              isCircleIntersectingPolygon([node.x, node.y], getNodeRadius(node), lassoPointsRef.current)
            )
            .map((node) => node.id);
          setSelectedNodes(new Set(nodesInLasso));
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDrawing(false);

      if (lassoPointsRef.current.length < 3) {
        setLassoPoints([]);
        lassoPointsRef.current = [];
        return;
      }

      const selectedNodes = network.nodes.filter((node) =>
        isCircleIntersectingPolygon([node.x, node.y], getNodeRadius(node), lassoPointsRef.current)
      );

      setLassoPoints([]);
      lassoPointsRef.current = [];
      setSelectedNodes(new Set());

      if (selectedNodes.length === 0) {
        setFeedback("No nodes selected");
        setTimeout(() => setFeedback(""), 2000);
        return;
      }

      selectedNodes.forEach((node) => {
        node.setTopModule(activeCommunity);
      });

      network.finalize();

      setFeedback(`✓ Assigned ${selectedNodes.length} node(s) to community ${activeCommunity}`);
      setTimeout(() => setFeedback(""), 2000);
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("selectstart", handleSelectStart);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("selectstart", handleSelectStart);
    };
  }, [isDrawing, network, getNodeRadius, activeCommunity, getSVGCoordinates, getNodeRate]);

  /**
   * Check if a point is inside a polygon using ray casting algorithm.
   */
  const isPointInPolygon = (
    point: [number, number],
    polygon: [number, number][]
  ): boolean => {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if (
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    return inside;
  };

  /**
   * Check if a circle intersects with a polygon.
   * Returns true if ANY of these conditions are met:
   * 1. Circle center is inside the polygon
   * 2. Any polygon vertex is inside the circle
   * 3. Any polygon edge intersects the circle
   */
  const isCircleIntersectingPolygon = (
    center: [number, number],
    radius: number,
    polygon: [number, number][]
  ): boolean => {
    const [cx, cy] = center;
    const radiusSq = radius * radius;

    // Check 1: Is center inside polygon?
    if (isPointInPolygon(center, polygon)) return true;

    // Check 2: Is any polygon vertex inside circle?
    for (const [vx, vy] of polygon) {
      const dx = vx - cx;
      const dy = vy - cy;
      if (dx * dx + dy * dy < radiusSq) return true;
    }

    // Check 3: Does any polygon edge intersect the circle?
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];

      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;

      if (lengthSq === 0) continue; // Skip degenerate edges

      // Find closest point on edge to circle center
      const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lengthSq));
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;

      const distX = cx - closestX;
      const distY = cy - closestY;
      if (distX * distX + distY * distY < radiusSq) return true;
    }

    return false;
  };

  /**
   * Start drawing lasso on mouse down.
   */
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Don't start selection if clicking on interactive elements
    if ((e.target as SVGElement).tagName === "circle" || (e.target as SVGElement).tagName === "text") {
      return;
    }

    const coords = getSVGCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    lassoPointsRef.current = [coords];
    setIsDrawing(true);
  };

  /**
   * Convert lasso points to SVG path string.
   */
  const getPathString = (points: [number, number][]): string => {
    if (points.length === 0) return "";
    return (
      "M " +
      points.map(([x, y]) => `${x},${y}`).join(" L ") +
      ` Z`
    );
  };

  const getButtonStyle = useCallback((i: number) => ({
    width: "2rem",
    height: "2rem",
    border: i === activeCommunity ? "3px solid #333" : "2px solid #ddd",
    borderRadius: "0.25rem",
    cursor: "pointer",
    transition: "all 0.15s",
    fontWeight: "bold" as const,
    fontSize: "0.75rem",
    color: "#fff",
    backgroundColor: scheme[i],
    boxShadow: i === activeCommunity ? "0 0 0 2px white, 0 0 0 4px #333" : "none",
  }), [activeCommunity, scheme]);

  const getLabel = useCallback(
    (node: NodeModel) => showModules && network.treeUpdateCounter ? (node.code ?? "") : (undefined as any),
    [showModules, network.treeUpdateCounter]
  ) as any;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Community selector buttons */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <strong>Select Community:</strong>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {Array.from({ length: numCommunities }).map((_, i) => (
            <button
              key={i}
              style={getButtonStyle(i)}
              onClick={() => setActiveCommunity(i)}
              title={`Community ${i}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Network with selection overlay */}
      <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
        <svg
          ref={svgRef}
          style={{
            cursor: "crosshair",
            width: "100%",
            height: "auto",
            display: "block",
            userSelect: "none",
          }}
          viewBox={`0 0 ${width} ${height}`}
          xmlns="http://www.w3.org/2000/svg"
          onMouseDown={handleMouseDown}
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#888" />
            </marker>
          </defs>

          {/* Render the network content */}
          <Network
            network={network}
            scheme={Object.values(scheme)}
            schemeAlt={schemeAlt ? Object.values(schemeAlt) : undefined}
            rate={rate}
            showLabels={showLabels}
            showModules={showModules}
            width={width}
            height={height}
            getLabel={getLabel}
            selectedNodeIds={isDrawing ? selectedNodes : undefined}
          >
            {children}
          </Network>

          {/* Draw lasso while dragging */}
          {lassoPoints.length > 0 && (
            <>
              {/* Filled polygon showing selection area */}
              <path
                d={getPathString(lassoPoints)}
                fill="rgba(100, 150, 255, 0.1)"
                stroke="#4a7ff7"
                strokeWidth="2"
                strokeDasharray="5,3"
                style={{ pointerEvents: "none" }}
              />
            </>
          )}
        </svg>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div style={{ color: "#2d5f2e", fontWeight: 500, minHeight: "1.25rem" }}>
          {feedback}
        </div>
      )}

      {/* Instructions */}
      <div style={{ color: "#666", fontSize: "0.8rem" }}>
        Click and drag to draw a free-hand lasso around nodes. Release to complete the selection
        and assign selected nodes to the active community (number shown on colored buttons).
      </div>
    </div>
  );
});
