const contentListTypeList = [
  'resourceSelection',
  'documentSelection',
  'extensionWeblinkSelection',
  'documentCursorSelection',
  'documentBeforeCursorSelection',
  'documentAfterCursorSelection',
];

export const isContentList = (type: string) => {
  return contentListTypeList.includes(type);
};

export const mapSelectionTypeToContentList = (type: string) => {
  return isContentList(type) ? 'contentList' : type;
};
