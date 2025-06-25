import { safeParseURL } from '@refly/utils/url';
import { useMemo } from 'react';

export const Favicon = (props: { url: string; size?: number }) => {
  const { size = 12, url } = props;

  const faviconUrl = useMemo(() => {
    return `https://www.google.com/s2/favicons?domain=${safeParseURL(`${url}` as string)}&sz=${64}`;
  }, [url]);

  // const [cachedUrl, setCachedUrl] = useState(faviconUrl);

  // useEffect(() => {
  //   const cacheImage = async () => {
  //     if ('caches' in window) {
  //       const cache = await caches.open('favicon-cache');
  //       const cachedResponse = await cache.match(faviconUrl);

  //       if (cachedResponse) {
  //         const blob = await cachedResponse.blob();
  //         setCachedUrl(URL.createObjectURL(blob));
  //       } else {
  //         const response = await fetch(faviconUrl);
  //         const blob = await response.blob();
  //         await cache.put(faviconUrl, new Response(blob));
  //         setCachedUrl(URL.createObjectURL(blob));
  //       }
  //     }
  //   };

  //   cacheImage();

  //   return () => {
  //     if (cachedUrl.startsWith('blob:')) {
  //       URL.revokeObjectURL(cachedUrl);
  //     }
  //   };
  // }, [faviconUrl]);

  return <img style={{ width: size, height: size }} src={faviconUrl} alt={`${url}`} />;
};
