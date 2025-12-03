/**
 * Generate sitemap.xml for SEO optimization
 * This script generates both static sitemap and dynamic template sitemap
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.VITE_BASE_URL || process.env.BASE_URL || 'https://refly.ai';
const API_URL = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:5800';

/**
 * Generate XML sitemap content
 */
function generateSitemapXML(urls) {
  const urlEntries = urls
    .map((url) => {
      const lastmod = url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>\n` : '';
      const changefreq = url.changefreq ? `    <changefreq>${url.changefreq}</changefreq>\n` : '';
      const priority =
        url.priority !== undefined ? `    <priority>${url.priority}</priority>\n` : '';

      return `  <url>\n    <loc>${url.loc}</loc>\n${lastmod}${changefreq}${priority}  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Generate sitemap index XML
 */
function generateSitemapIndex(sitemaps) {
  const sitemapEntries = sitemaps
    .map((sitemap) => `  <sitemap>\n    <loc>${sitemap}</loc>\n  </sitemap>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
}

/**
 * Fetch public workflow templates from API
 */
async function fetchPublicTemplates() {
  try {
    const response = await fetch(`${API_URL}/v1/template/list?scope=public&page=1&pageSize=1000`);
    if (!response.ok) {
      console.warn(`Failed to fetch templates: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    if (data?.success && Array.isArray(data?.data)) {
      return data.data
        .map((template) => ({
          shareId: template.shareId || template.appId,
          updatedAt: template.updatedAt || template.createdAt,
        }))
        .filter((template) => template.shareId);
    }
    return [];
  } catch (error) {
    console.warn('Error fetching templates:', error);
    return [];
  }
}

/**
 * Generate main sitemap with static pages
 */
async function generateMainSitemap() {
  const now = new Date().toISOString().split('T')[0];

  const staticUrls = [
    {
      loc: `${BASE_URL}/`,
      lastmod: now,
      changefreq: 'daily',
      priority: 1.0,
    },
    {
      loc: `${BASE_URL}/login`,
      lastmod: now,
      changefreq: 'monthly',
      priority: 0.8,
    },
    {
      loc: `${BASE_URL}/pricing`,
      lastmod: now,
      changefreq: 'weekly',
      priority: 0.9,
    },
    {
      loc: `${BASE_URL}/marketplace`,
      lastmod: now,
      changefreq: 'daily',
      priority: 0.9,
    },
    {
      loc: `${BASE_URL}/workflow-marketplace`,
      lastmod: now,
      changefreq: 'daily',
      priority: 0.9,
    },
  ];

  return generateSitemapXML(staticUrls);
}

/**
 * Generate templates sitemap with dynamic workflow templates
 */
async function generateTemplatesSitemap() {
  const templates = await fetchPublicTemplates();
  const now = new Date().toISOString().split('T')[0];

  const templateUrls = templates.map((template) => ({
    loc: `${BASE_URL}/workflow-template/${template.shareId}`,
    lastmod: template.updatedAt ? new Date(template.updatedAt).toISOString().split('T')[0] : now,
    changefreq: 'weekly',
    priority: 0.7,
  }));

  // If no templates, return empty sitemap with just the base template page
  if (templateUrls.length === 0) {
    return generateSitemapXML([
      {
        loc: `${BASE_URL}/workflow-template`,
        lastmod: now,
        changefreq: 'daily',
        priority: 0.8,
      },
    ]);
  }

  return generateSitemapXML(templateUrls);
}

/**
 * Main function to generate all sitemaps
 */
async function main() {
  const distPath = join(__dirname, '..', 'dist');
  const publicPath = join(__dirname, '..', 'public');

  console.log('Generating sitemaps...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Marketplace sitemap: ${BASE_URL}/workflow-marketplace/sitemap.xml`);

  try {
    // Generate main sitemap
    const mainSitemap = await generateMainSitemap();
    const mainSitemapPath = join(distPath, 'sitemap.xml');
    writeFileSync(mainSitemapPath, mainSitemap, 'utf-8');
    console.log(`✓ Generated: ${mainSitemapPath}`);

    // Also write to public for development
    writeFileSync(join(publicPath, 'sitemap.xml'), mainSitemap, 'utf-8');

    // Generate templates sitemap
    const templatesSitemap = await generateTemplatesSitemap();
    const templatesSitemapPath = join(distPath, 'sitemap-templates.xml');
    writeFileSync(templatesSitemapPath, templatesSitemap, 'utf-8');
    console.log(`✓ Generated: ${templatesSitemapPath}`);

    // Also write to public for development
    writeFileSync(join(publicPath, 'sitemap-templates.xml'), templatesSitemap, 'utf-8');

    // Generate sitemap index
    const sitemapList = [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/sitemap-templates.xml`,
      `${BASE_URL}/workflow-marketplace/sitemap.xml`,
    ];
    const sitemapIndex = generateSitemapIndex(sitemapList);
    const sitemapIndexPath = join(distPath, 'sitemap_index.xml');
    writeFileSync(sitemapIndexPath, sitemapIndex, 'utf-8');
    console.log(`✓ Generated: ${sitemapIndexPath}`);

    // Also write to public for development
    writeFileSync(join(publicPath, 'sitemap_index.xml'), sitemapIndex, 'utf-8');

    console.log('\n✅ All sitemaps generated successfully!');
  } catch (error) {
    console.error('Error generating sitemaps:', error);
    process.exit(1);
  }
}

// Run if executed directly
main();
