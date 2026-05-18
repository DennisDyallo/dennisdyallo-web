import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import sharp from 'sharp';
import { getRupicolaDataUri } from '../../lib/rupicola';

const serifFontPath = '/System/Library/Fonts/Supplemental/Georgia.ttf';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts
    .filter((post) => !post.data.draft)
    .map((post) => ({
      params: { slug: post.data.slug },
      props: { post },
    }));
}

export async function GET({ props }: { props: any }) {
  const { post } = props;
  const serif = await readFile(serifFontPath);
  const date = post.data.pubDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0F0B0A',
        color: '#F2EADB',
        padding: '72px',
        position: 'relative',
        fontFamily: 'Georgia',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(224,83,28,0.16), rgba(214,168,95,0.06) 36%, rgba(15,11,10,0) 68%)',
            },
          },
        },
        {
          type: 'img',
          props: {
            src: getRupicolaDataUri(),
            style: { position: 'absolute', right: '72px', bottom: '64px', width: '92px', height: '92px', opacity: 0.95 },
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '16px', color: '#D6A85F', fontSize: '30px', position: 'relative' },
            children: [
              { type: 'span', props: { children: 'dyallo.se' } },
              { type: 'span', props: { style: { width: '96px', height: '1px', background: '#D6A85F' } } },
              { type: 'span', props: { children: date } },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { maxWidth: '900px', position: 'relative', display: 'flex' },
            children: {
              type: 'h1',
              props: {
                style: { fontSize: '82px', lineHeight: 1.02, fontWeight: 400, margin: 0, letterSpacing: 0 },
                children: post.data.title,
              },
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { maxWidth: '780px', color: '#A89A88', fontSize: '30px', lineHeight: 1.35, position: 'relative', display: 'flex' },
            children: post.data.description,
          },
        },
      ],
    },
  };

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Georgia',
        data: serif,
        weight: 400,
        style: 'normal',
      },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
