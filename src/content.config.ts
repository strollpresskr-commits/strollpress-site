import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    description: z.string().optional().default(''),
    category: z.string().optional().default(''),
    channel: z.string().optional().default('Web'),
    lang: z.string().optional().default('ko'),
    slug: z.string().optional(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { posts };
