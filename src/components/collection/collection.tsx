import { type FunctionComponent } from 'react'
import { type CollectionEntry } from 'astro:content';

import { PostPreview } from '@/components/post-preview/post-preview'
import styles from './collection.module.css';

type Post = CollectionEntry<"posts">

interface Props {
  items: Post[];
  renderer?: FunctionComponent<any>;
}

export function Collection({ items = [], renderer = PostPreview }: Props) {
  const Item = renderer
  if (items.length === 0 || !items) {
    return null
  }

  return (
    <ul className={styles.collection}>
      {
        items.map((item: Post) => (
          <li className={styles.item} key={item.id}>
            <Item key={item.id} {...item} />
          </li>
        ))
      }
    </ul>
  )
}
