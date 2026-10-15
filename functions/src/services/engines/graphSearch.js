// Plain graph searches over the generated graph's directed edges, kept apart from the rules that use them
// (reachability, passages and orphans): a compressed adjacency, breadth-first reach, strongly connected parts and
// undirected components. Linear in nodes plus edges, for the PRD §7 scale (about 20,000 nodes per venue).
'use strict';

/** Compressed adjacency of the edges that pass `include`; `reverse` follows them backwards. */
function adjacency(nodeCount, edges, include, reverse = false) {
  const start = new Int32Array(nodeCount + 1);
  const kept = edges.filter(include);
  for (const e of kept) start[(reverse ? e.to : e.from) + 1] += 1;
  for (let i = 0; i < nodeCount; i += 1) start[i + 1] += start[i];
  const fill = start.slice(0, nodeCount);
  const target = new Int32Array(kept.length);
  for (const e of kept) {
    const from = reverse ? e.to : e.from;
    target[fill[from]] = reverse ? e.from : e.to;
    fill[from] += 1;
  }
  return { start, target, nodeCount };
}

/** Every node reachable from the sources (sources included), as a 0/1 array. */
function reach(adj, sources) {
  const seen = new Uint8Array(adj.nodeCount);
  const queue = [];
  for (const s of sources) {
    if (!seen[s]) {
      seen[s] = 1;
      queue.push(s);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const n = queue[head];
    for (let k = adj.start[n]; k < adj.start[n + 1]; k += 1) {
      const m = adj.target[k];
      if (!seen[m]) {
        seen[m] = 1;
        queue.push(m);
      }
    }
  }
  return seen;
}

/** Strongly connected parts (Tarjan, without recursion): part id per node, ids in order of completion. */
function stronglyConnectedParts(adj) {
  const n = adj.nodeCount;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const part = new Int32Array(n).fill(-1);
  const onStack = new Uint8Array(n);
  const stack = [];
  let next = 0;
  let parts = 0;
  const work = [];
  for (let root = 0; root < n; root += 1) {
    if (index[root] !== -1) continue;
    work.push([root, adj.start[root]]);
    index[root] = low[root] = next;
    next += 1;
    stack.push(root);
    onStack[root] = 1;
    while (work.length) {
      const frame = work[work.length - 1];
      const v = frame[0];
      if (frame[1] < adj.start[v + 1]) {
        const w = adj.target[frame[1]];
        frame[1] += 1;
        if (index[w] === -1) {
          index[w] = low[w] = next;
          next += 1;
          stack.push(w);
          onStack[w] = 1;
          work.push([w, adj.start[w]]);
        } else if (onStack[w] && index[w] < low[v]) low[v] = index[w];
        continue;
      }
      work.pop();
      if (work.length) {
        const u = work[work.length - 1][0];
        if (low[v] < low[u]) low[u] = low[v];
      }
      if (low[v] === index[v]) {
        for (;;) {
          const w = stack.pop();
          onStack[w] = 0;
          part[w] = parts;
          if (w === v) break;
        }
        parts += 1;
      }
    }
  }
  return { part, count: parts };
}

/** Connected components ignoring direction: component id per node (the smallest node id in it). */
function undirectedComponents(nodeCount, edges) {
  const parent = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) parent[i] = i;
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const e of edges) {
    const a = find(e.from);
    const b = find(e.to);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  }
  const out = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) out[i] = find(i);
  return out;
}

module.exports = { adjacency, reach, stronglyConnectedParts, undirectedComponents };
