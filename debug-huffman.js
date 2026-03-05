// Debug script to inspect Huffman codes
const fs = require('fs');
const path = require('path');

// Load the network data
const networkPath = path.join(__dirname, 'src/networks/modular_w_json.json');
const networkData = JSON.parse(fs.readFileSync(networkPath, 'utf8'));

console.log('=== Network Overview ===');
console.log(`Nodes: ${networkData.nodes.length}`);
console.log(`Links: ${networkData.links.length}`);
console.log(`Flow model: ${networkData.flowModel}`);

// Group nodes by module
const nodesByModule = {};
networkData.nodes.forEach(node => {
  const module = node.path.split(':')[0];
  if (!nodesByModule[module]) {
    nodesByModule[module] = [];
  }
  nodesByModule[module].push(node);
});

console.log('\n=== Modules ===');
Object.keys(nodesByModule).sort().forEach(moduleId => {
  console.log(`Module ${moduleId}: ${nodesByModule[moduleId].length} nodes`);
});

// Calculate flows for each module
console.log('\n=== Module Flows (should be proportional to link weights) ===');
const numNodes = networkData.nodes.length;
const initialFlow = 1 / numNodes;

// Calculate enter/exit flow for each module
const moduleFlows = {};
Object.keys(nodesByModule).forEach(moduleId => {
  moduleFlows[moduleId] = {
    enter: 0,
    exit: 0,
    nodes: nodesByModule[moduleId].map(n => ({
      id: n.id,
      flow: n.flow || initialFlow
    }))
  };
});

// Sum up link weights
networkData.links.forEach(({ source, target, weight }) => {
  const sourceModule = networkData.nodes.find(n => n.id === source).path.split(':')[0];
  const targetModule = networkData.nodes.find(n => n.id === target).path.split(':')[0];
  
  if (sourceModule !== targetModule) {
    moduleFlows[sourceModule].exit += weight;
    moduleFlows[targetModule].enter += weight;
  }
});

Object.keys(moduleFlows).sort().forEach(moduleId => {
  console.log(`Module ${moduleId}:`);
  console.log(`  Enter flow: ${moduleFlows[moduleId].enter}`);
  console.log(`  Exit flow: ${moduleFlows[moduleId].exit}`);
  console.log(`  Nodes: ${moduleFlows[moduleId].nodes.map(n => `${n.id}(${n.flow.toFixed(3)})`).join(', ')}`);
});

// Expected Huffman tree structure
console.log('\n=== Huffman Code Generation ===');

// For enter codes: sort modules by enter flow (descending) 
const sortedModules = Object.keys(moduleFlows)
  .sort((a, b) => moduleFlows[b].enter - moduleFlows[a].enter)
  .map(m => ({ id: m, flow: moduleFlows[m].enter }));

console.log('Modules sorted by enter flow:');
sortedModules.forEach((m, i) => {
  console.log(`  ${i}: Module ${m.id} (enter: ${m.flow})`);
});

// Simulate Huffman tree for enter codes
console.log('\nExpected enter code assignments (with simple binary tree):');
const enterCodes = {};
if (sortedModules.length === 1) {
  enterCodes[sortedModules[0].id] = '0';
} else if (sortedModules.length === 2) {
  enterCodes[sortedModules[0].id] = '0';
  enterCodes[sortedModules[1].id] = '1';
} else {
  // Proper Huffman tree would be more complex
  // This is simplified for debugging
  sortedModules.forEach((m, i) => {
    enterCodes[m.id] = i.toString(2);
  });
}

Object.keys(enterCodes).sort().forEach(moduleId => {
  console.log(`  Module ${moduleId}: ${enterCodes[moduleId]}`);
});
