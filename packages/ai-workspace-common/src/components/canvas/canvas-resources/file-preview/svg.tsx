import { memo } from 'react';
import DOMPurify from 'dompurify';
import type { FileRendererProps } from './types';

export const SvgRenderer = memo(({ fileContent }: FileRendererProps) => {
  const svgContent = new TextDecoder().decode(fileContent.data);
  // Sanitize SVG to remove malicious scripts and event handlers
  const sanitizedSvg = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['image'],
    ADD_ATTR: ['href', 'xlink:href'],
  });

  return (
    <div className="h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden relative">
      <div
        className="max-w-full max-h-full"
        ref={(el) => {
          if (el && !el.shadowRoot) {
            const shadow = el.attachShadow({ mode: 'open' });
            // Inject styles to disable interactions on images and links
            shadow.innerHTML = `
              <style>
                :host { display: block; }
                image, a { pointer-events: none; cursor: default; }
              </style>
              ${sanitizedSvg}
            `;
          }
        }}
      />
    </div>
  );
});
