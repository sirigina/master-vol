import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** Curriculum ID, e.g. "C2". Shown as a chip and used for cross-links. */
        lessonId: z.string().optional(),
        /** Lesson IDs a reader should know first. */
        prereqs: z.array(z.string()).optional(),
        /** Rough reading + playing time. */
        minutes: z.number().optional(),
        /** Where to read more in the source book, by topic. Omitted for generic concepts. */
        bookRef: z.string().optional(),
      }),
    }),
  }),
};
