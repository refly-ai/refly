import React from 'react';

interface AddToContextMessageContentProps {
  nodeType: string;
  title: string;
  action: string;
}

const AddToContextMessageContent: React.FC<AddToContextMessageContentProps> = React.memo(
  ({ nodeType, title, action }) => (
    <div className="flex items-center gap-2">
      <span>{nodeType}</span>[<span className="max-w-[200px] truncate">{title}</span>]
      <span>{action}</span>
    </div>
  ),
);

AddToContextMessageContent.displayName = 'AddToContextMessageContent';

export default AddToContextMessageContent;
