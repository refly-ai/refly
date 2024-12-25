import { FC } from 'react';
import { NodeActionMenu } from '../node-action-menu';

type ActionButtonsProps = {
  nodeId: string;
  type: 'document' | 'resource' | 'skillResponse';
};

export const ActionButtons: FC<ActionButtonsProps> = ({ nodeId, type }) => {
  return (
    <div
      className="
        absolute
          -right-[154px]
          top-0
          opacity-0
          group-hover:opacity-100
          transition-opacity
          duration-200
          ease-in-out
          z-50
          w-[150px]
          bg-white
          rounded-lg
      "
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <NodeActionMenu nodeId={nodeId} nodeType={type} />
    </div>
  );
};
