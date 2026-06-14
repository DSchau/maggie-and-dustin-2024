import { z, defineCollection } from "astro:content";

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    category: z.enum(["note", "travel"]),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    location: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
  })
});

export const collections = {
  posts: postsCollection,
};
