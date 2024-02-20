// Import utilities from `astro:content`
import { z, defineCollection } from "astro:content";
// Define a `type` and `schema` for each collection
const tripsCollection = defineCollection({
    type: 'content',
    schema: ({ image }) => z.object({
      title: z.string(),
      date: z.date(),
      canonicalLink: z.string().optional(),
      lastModified: z.string().optional(),
      featured: z.boolean().optional(),
      featuredImage: image().optional(),
      excerpt: z.string().optional(),
      tags: z.array(z.string())
    })
});
// Export a single `collections` object to register your collection(s)
export const collections = {
  trips: tripsCollection,
};