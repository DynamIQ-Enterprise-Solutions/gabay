// Plain graph searches over the generated graph's directed edges (its CSR, graphStore.js), kept apart from the rules
// that use them (reachability, passages and orphans): a filtered adjacency, breadth-first reach, strongly connected
// parts and weakly connected parts. Linear in nodes plus edges, for the PRD §7 scale (about 20,000 nodes per venue;
// AC-137 measures Bayview Grand's size too).
'use strict';

/**
 * The CSR's edges that pass `include(k)` (k an edge index), as a compressed adjacency { start, target, nodeCount };
 * `reverse` follows them backwards.
 */
function csrAdjacency(csr, include, reverse = false) {
  const n = csr.nodeCount;
  const start = new Int32Array(n + 1);
  let kept = 0;
  for (let v = 0; v < n; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      if (!include(k)) continue;
      start[(reverse ? csr.targets[k] : v) + 1] += 1;
      kept += 1;
    }
  }
  for (let i = 0; i < n; i += 1) start[i + 1] += start[i];
  const fill = start.slice(0, n);
  const target = new Int32Array(kept);
  for (let v = 0; v < n; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      if (!include(k)) continue;
      const [from, to] = reverse ? [csr.targets[k], v] : [v, csr.targets[k]];
      target[fill[from]] = to;
      fill[from] += 1;
    }
  }
  return { start, target, nodeCount: n };
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

/** The CSR's weakly connected parts (every edge, either direction): part id per node, the smallest node id in it. */
function csrComponents(csr) {
  const n = csr.nodeCount;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i += 1) parent[i] = i;
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let v = 0; v < n; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      const a = find(v);
      const b = find(csr.targets[k]);
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
  }
  const out = new Int32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = find(i);
  return out;
}

module.exports = { csrAdjacency, reach, stronglyConnectedParts, csrComponents };
