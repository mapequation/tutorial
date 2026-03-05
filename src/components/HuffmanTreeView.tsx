/**
 * HuffmanTreeView visualizes Huffman coding trees as hierarchical structures.
 * 
 * Displays the Huffman tree with codes as node labels, organized in a tree layout
 * using D3. Shows three types of trees:
 * - One-level: flat Huffman tree for all nodes
 * - Index: tree for module enter codes
 * - Module: tree for module exit codes and node visit codes
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import * as d3 from "d3";
import { HuffmanNode } from "../model/algorithms/HuffmanCoder";
import type { TreeNode } from "../model/algorithms/Tree";
import { Network as NetworkModel } from "../model";

interface Props {
  treeNode: TreeNode;
  treeType: "oneLevel" | "index" | "module";
  network?: NetworkModel;
  width?: number;
  height?: number;
}

interface HierarchyNode {
  code: string;
  label: string;
  itemId?: number;
  isExit?: boolean;
  children?: HierarchyNode[];
}

export default observer(function HuffmanTreeView({
  treeNode,
  treeType,
  network,
  width = 600,
  height = 400,
}: Props) {
  const huffmanTree = useMemo(() => {
    const tree =
      treeType === "oneLevel"
        ? treeNode.huffmanOneLevelTree
        : treeType === "index"
          ? treeNode.huffmanIndexTree
          : treeNode.huffmanModuleTree;

    if (!tree) return null;

    // Convert Huffman tree to D3 hierarchy format
    function convertToHierarchy(
      node: HuffmanNode<{ flow: number; id?: number }>
    ): HierarchyNode {
      const isLeaf = !node.left && !node.right;
      const id = node.data.id;
      let label = node.code || "root";
      let isExit = false;

      if (isLeaf) {
        if (id === -1) {
          label = `${node.code} → (exit)`;
          isExit = true;
        } else if (id !== undefined) {
          // Get node or module name
          let name = "";
          if (treeType === "oneLevel" && network) {
            const networkNode = network.getNode(id);
            name = networkNode ? `${networkNode.name}` : `${id}`;
          } else if (treeType === "index") {
            name = `Module ${id}`;
          } else if (treeType === "module" && network) {
            const networkNode = network.getNode(id);
            name = networkNode ? `${networkNode.name}` : `${id}`;
          }
          label = `${node.code} ${name}`;
        }
      }

      const result: HierarchyNode = {
        code: node.code,
        label,
        itemId: id,
        isExit,
      };

      if (node.left || node.right) {
        result.children = [];
        if (node.left) {
          result.children.push(convertToHierarchy(node.left));
        }
        if (node.right) {
          result.children.push(convertToHierarchy(node.right));
        }
      }

      return result;
    }

    return convertToHierarchy(tree);
  }, [treeNode, treeType, network, treeNode.children?.size]);

  const layout = useMemo(() => {
    if (!huffmanTree) return null;

    const padding = 50; // Padding around the tree
    const hierarchy = d3.hierarchy(huffmanTree);
    const tree = d3.tree<HierarchyNode>().size([height - 2 * padding, width - 2 * padding]);
    return tree(hierarchy);
  }, [huffmanTree, width, height]);

  if (!huffmanTree || !layout) {
    return (
      <div style={{ padding: "20px", color: "#999" }}>
        No Huffman tree available for {treeType}
      </div>
    );
  }

  const links = layout.links();
  const nodes = layout.descendants();
  const padding = 50;

  return (
    <div style={{ marginBottom: "40px", border: "1px solid #ccc", padding: "10px" }}>
      <h3>{treeType} Huffman Tree</h3>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ border: "1px solid #ddd", width: "100%" }}>
        {/* Apply padding via transform */}
        <g transform={`translate(${padding}, ${padding})`}>
          {/* Links */}
          <g strokeWidth="1" stroke="#999" fill="none">
            {links.map((link, i) => (
              <line
                key={`link-${i}`}
                x1={link.source.y}
                y1={link.source.x}
                x2={link.target.y}
                y2={link.target.x}
              />
            ))}
          </g>

          {/* Nodes */}
          <g fontSize="12" fontFamily="sans-serif">
          {nodes.map((node, i) => {
            const isLeaf = !node.children || node.children.length === 0;
            const nodeRadius = isLeaf ? 22 : 18;
            const data = node.data as HierarchyNode;
            
            return (
              <g key={`node-${i}`}>
                {/* Node circle */}
                <circle
                  cx={node.y}
                  cy={node.x}
                  r={nodeRadius}
                  fill={isLeaf ? "#4CAF50" : "#2196F3"}
                  stroke="#000"
                  strokeWidth="1"
                />
                
                {/* Code in circle */}
                <text
                  x={node.y}
                  y={node.x}
                  textAnchor="middle"
                  dy="0.3em"
                  fill="white"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {data.code || "0"}
                </text>
                
                {/* Labels to the right of the node */}
                {isLeaf && (
                  <text
                    x={node.y + nodeRadius + 8}
                    y={node.x}
                    dy="0.3em"
                    fill="#333"
                    fontSize="11"
                  >
                    {data.isExit ? `→ Module ${data.itemId}` : data.label.split(" ").slice(1).join(" ")}
                  </text>
                )}
              </g>
            );
          })}
          </g>
        </g>
      </svg>
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
        <div>🟢 Leaf nodes (codes for items)</div>
        <div>🔵 Internal nodes (branch points)</div>
      </div>
    </div>
  );
});
