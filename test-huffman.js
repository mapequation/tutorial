#!/usr/bin/env node

// Simple Huffman tree builder to understand what SHOULD happen
class HuffmanNode {
  constructor(data, left = null, right = null) {
    this.data = data;
    this.left = left;
    this.right = right;
    this.code = "";
  }

  *depthFirst() {
    yield this;
    if (this.left) yield* this.left.depthFirst();
    if (this.right) yield* this.right.depthFirst();
  }

  get isLeaf() {
    return !this.left && !this.right;
  }
}

function createHuffmanTree(items, compareFn, addFn) {
  const nodeCompareFn = (a, b) => compareFn(a.data, b.data);
  const nodes = items.map((item) => new HuffmanNode(item));
  
  // Simple insertion sort for priority queue
  const queue = [];
  for (let node of nodes) {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (nodeCompareFn(node, queue[i]) < 0) {
        queue.splice(i, 0, node);
        inserted = true;
        break;
      }
    }
    if (!inserted) queue.push(node);
  }

  while (queue.length > 1) {
    const left = queue.shift();
    const right = queue.shift();
    const data = addFn(left.data, right.data);
    const parent = new HuffmanNode(data, left, right);
    
    // Re-insert parent into sorted queue
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (nodeCompareFn(parent, queue[i]) < 0) {
        queue.splice(i, 0, parent);
        inserted = true;
        break;
      }
    }
    if (!inserted) queue.push(parent);
  }

  const root = queue[0];

  // Assign codes
  for (let node of root.depthFirst()) {
    if (node.left) {
      node.left.code = node.code + "0";
    }
    if (node.right) {
      node.right.code = node.code + "1";
    }
  }

  return root;
}

// Test with module enter flows
const modules = [
  { id: 0, flow: 5 },
  { id: 1, flow: 3 },
  { id: 3, flow: 2 },
  { id: 2, flow: 0 }
];

const compareFn = (a, b) => a.flow - b.flow;
const addFn = (a, b) => ({ flow: a.flow + b.flow });

console.log('=== Module Enter Flows (sorted) ===');
const sorted = [...modules].sort((a, b) => b.flow - a.flow);
sorted.forEach(m => console.log(`Module ${m.id}: ${m.flow}`));

const root = createHuffmanTree(modules, compareFn, addFn);

console.log('\n=== Generated Huffman Codes ===');
for (let node of root.depthFirst()) {
  if (node.isLeaf && node.data.id !== undefined) {
    console.log(`Module ${node.data.id}: "${node.code}" (flow: ${node.data.flow})`);
  }
}

console.log('\n=== Tree Structure ===');
function printTree(node, indent = "") {
  if (node.isLeaf) {
    if (node.data.id !== undefined) {
      console.log(`${indent}Leaf: Module ${node.data.id} (flow: ${node.data.flow}, code: "${node.code}")`);
    }
  } else {
    console.log(`${indent}Internal: flow=${node.data.flow}`);
    if (node.left) {
      console.log(`${indent}  Left (0):`);
      printTree(node.left, indent + "    ");
    }
    if (node.right) {
      console.log(`${indent}  Right (1):`);
      printTree(node.right, indent + "    ");
    }
  }
}

printTree(root);
