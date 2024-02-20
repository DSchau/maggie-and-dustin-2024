import styles from './project.module.css';
import Star from 'phosphor-react/src/icons/Star.tsx';
import GitFork from 'phosphor-react/src/icons/GitFork.tsx';

import { Tags } from '@/components/tags/tags.tsx';

interface Props {
  createdAt: string;
  name: string;
  url: string;
  description: string;
  repositoryTopics: {
    nodes: {
      topic: {
        name: string;
      }
    }[]
  }
  stargazers: {
    totalCount: number;
  }
  forks: {
    totalCount: number
  }
}

export function Project({ createdAt, description, name, url, repositoryTopics, stargazers, forks }: Props) {
  return (
    <div className={styles.project}>
      <h3 className={styles.header}>
        <p className={styles.date}>{new Date(createdAt).toLocaleDateString("en-us", {timeZone: 'UTC'})}</p>
        <a href={url}>{name}</a>
      </h3>
      <div className={styles.content}>
        <p className={styles.description}>{description}</p>
        <Tags list={repositoryTopics?.nodes.map(node => {
          return {
            label: node.topic.name
          }
        })} />
      </div>
      <div className={styles.footer}>
        <span className="stars">
          <Star weight="fill"/> {stargazers?.totalCount || 0}
        </span>
        <span className="forks">
           <GitFork /> {forks?.totalCount || 0}
        </span>
      </div>
    </div>
  )
}
