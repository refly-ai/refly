import Dagre from '@dagrejs/dagre';

export const getLayoutedElements = (nodes, edges, options) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  // Configure graph options
  g.setGraph({
    rankdir: options.direction,
    nodesep: options.nodeSep || 10,
    ranksep: options.rankSep || 150,
    ranker: options.ranker || 'network-simplex',
    marginx: 50,
    marginy: 10,
  });

  // Add edges to graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Add nodes with dimensions to graph
  for (const node of nodes) {
    // Add extra padding to node dimensions to prevent overlap
    const nodeWidth = (node.measured?.width ?? 0) + 50; // Extra horizontal padding
    const nodeHeight = (node.measured?.height ?? 0) + 10; // Extra vertical padding

    g.setNode(node.id, {
      ...node,
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  // Run the layout algorithm
  Dagre.layout(g);

  // Map the positions back to the nodes
  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - (node.measured?.width ?? 0) / 2;
      const y = position.y - (node.measured?.height ?? 0) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};
