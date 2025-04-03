import Image from '@tiptap/extension-image';

const UpdatedImage = Image.extend({
  name: 'image',
  inline: true,
  group: 'inline',
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: '',
        parseHTML: (element) => {
          const src = element?.getAttribute('src');
          return src ?? '';
        },
        renderHTML: (attributes) => ({
          src: attributes?.src ?? '',
        }),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element?.getAttribute('width');
          return width ? Number.parseInt(width, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }

          return {
            width: attributes.width,
            style: `width: ${attributes.width}px`,
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element?.getAttribute('height');
          return height ? Number.parseInt(height, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {};
          }

          return {
            height: attributes.height,
            style: `height: ${attributes.height}px`,
          };
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { width, height, style, ...rest } = HTMLAttributes;

    const combinedStyle = [
      width && !style?.includes('width') ? `width: ${width}px;` : '',
      height && !style?.includes('height') ? `height: ${height}px;` : '',
      style || '',
    ]
      .join(' ')
      .trim();

    const finalAttributes = {
      ...rest,
      style: combinedStyle || null,
    };

    return ['img', finalAttributes];
  },
});

export default UpdatedImage;
