import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const allPosts = await getCollection('blog');
  const posts = allPosts
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'Dennis Dyall',
    description: 'Essays on sovereignty, systems thinking, and synthesis.',
    site: context.site || 'https://dyallo.se',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: `/blog/${post.data.slug}`,
      pubDate: post.data.pubDate,
      ...(post.data.canonicalUrl && { guid: post.data.canonicalUrl }),
    })),
    customData: '<language>en-us</language>',
  });
}
