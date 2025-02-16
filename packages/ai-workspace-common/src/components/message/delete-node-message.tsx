import React from 'react';

interface DeleteNodeMessageContentProps {
  action: string;
  title: string;
}

const DeleteNodeMessageContent: React.FC<DeleteNodeMessageContentProps> = React.memo(
  ({ action, title }) => (
    <div className="flex items-center gap-2">
      <span>{action}</span>[<span className="max-w-[200px] truncate">{title}</span>]
    </div>
  ),
);

DeleteNodeMessageContent.displayName = 'DeleteNodeMessageContent';

export default DeleteNodeMessageContent;
