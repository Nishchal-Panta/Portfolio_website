import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      dateLabel: z.string(),
      /** Ascending, and deliberately not the date. The mentor session is
       *  dated after the hackathon it happened inside, but it is read first
       *  because it is the more telling account of that week. dateLabel keeps
       *  the real date; only the position is chosen. */
      sortKey: z.string(),
      role: z.string(),
      organizer: z.string(),
      summary: z.string(),
      images: z
        .array(
          z.object({
            src: image(),
            alt: z.string().min(8),
            caption: z.string().optional(),
            /** 'portrait' never gets cropped or stretched: it keeps its own ratio */
            layout: z.enum(['default', 'portrait']).default('default'),
          })
        )
        .max(4)
        .default([]),
      /** id of a row in the credentials ledger, so events never duplicate it */
      credential: z.string().nullable().default(null),
    }),
});

const credentials = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/credentials' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      issuer: z.string(),
      dateLabel: z.string(),
      sortKey: z.string(),
      kind: z.string(),
      detail: z.string(),
      verification: z.string().url().optional(),
      document: z.string().optional(),
      image: image().optional(),
      imageAlt: z.string().optional(),
    }),
});

const skills = defineCollection({
  loader: glob({ pattern: 'skills.json', base: './src/content' }),
  schema: z.object({
    groups: z.array(
      z.object({
        name: z.string(),
        blurb: z.string(),
        items: z.array(z.string()),
      })
    ),
    source: z.string(),
  }),
});

export const collections = { events, credentials, skills };