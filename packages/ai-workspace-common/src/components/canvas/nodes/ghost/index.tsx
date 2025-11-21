import React from 'react';
import { Handle, Position } from '@xyflow/react';

export const GhostNode = React.memo(() => (
  <div className="w-1 h-1 opacity-50">
    <Handle
      type="target"
      position={Position.Top}
      isConnectable={false}
      className="!bg-transparent !border-gray-300 !w-3 !h-3 opacity-0"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={false}
      className="!bg-transparent !border-transparent !w-3 !h-3 opacity-0"
    />
  </div>
));

GhostNode.displayName = 'GhostNode';
