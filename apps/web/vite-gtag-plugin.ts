import type { Plugin } from 'vite';

const GTAG_ID = 'G-ER782LXJ5F';

export function gtagPlugin(): Plugin {
  return {
    name: 'vite-plugin-gtag',
    transformIndexHtml: {
      enforce: 'post',
      transform(html) {
        if (process.env.NODE_ENV !== 'production') {
          return html;
        }

        const gtagScript = `
          <script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag() {
              dataLayer.push(arguments);
            }
            gtag('js', new Date());
            gtag('config', '${GTAG_ID}');
          </script>
        `;

        return html.replace('</head>', `${gtagScript}</head>`);
      },
    },
  };
}
