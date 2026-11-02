import { safeParseURL } from './url';
import { load } from 'cheerio';
import { safeFetch } from './safe-fetch';

export const scrapeWeblink = async (url: string) => {
  const res = await safeFetch(url);
  const html = await res.text();
  const $ = load(html);

  // Get OG title
  const title = $('meta[property="og:title"]').attr('content') || $('title').text();

  // Get OG description
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content');

  // Get OG image or first suitable image
  let image = $('meta[property="og:image"]').attr('content');
  if (!image) {
    // If no og:image exists, pick the first image starts with http or https
    $('img').each((_index, element) => {
      const src = $(element).attr('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        image = src;
        return false; // break forEach loop
      }
    });
  }
  if (!image) {
    const domain = safeParseURL(url);
    image = `https://www.google.com/s2/favicons?domain=${domain}&sz=${16}`;
  }

  return {
    title,
    description,
    image,
  };
};
