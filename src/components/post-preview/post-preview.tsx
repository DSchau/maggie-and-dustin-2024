import { type CollectionEntry } from "astro:content"

import { Tags } from '@/components/tags/tags.tsx';
import styles from './post-preview.module.css';

type Post = CollectionEntry<"posts">

interface Props {
  showImage?: boolean;
  slug: string;
  data: Post["data"];
}

export function PostPreview({ slug: partialSlug, data, showImage }: Props) {
  const slug = `/posts/${partialSlug}`;
  return (
    <div className={styles.post}>
      <p className={styles.date}>{new Date(data.date).toLocaleDateString("en-us", {timeZone: 'UTC'})}</p>
      <h3 className={styles.title}>
        <a href={slug}>{data.title}</a>
      </h3>
      <Tags list={data.tags.map(tag => ({
        label: tag
      }))} />
      {showImage && data.featuredImage && (
        <img src={data.featuredImage.src} alt={`Image for ${data.title}`} />
      )}
      <p className={styles.excerpt}>{data.excerpt}</p>
      <a className={styles.link} href={slug}>Read more</a>
    </div>
  )
}
