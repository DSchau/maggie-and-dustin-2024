import styles from './tags.module.css'

type Tag = {
  label: string;
  href?: string;
}

interface Props {
  className?: string;
  list?: Tag[];
  small?: boolean;
}

export function Tags({ className, list, small }: Props) {
  if (list?.length === 0) {
    return null
  }
  return (
    <ul className={[styles.tags].concat(className || '').filter(Boolean).join(' ')} {...small ? { 'data-size': 'small' } : {}}>
      {
        (list || []).map(item => {
          const content = item.href ? <a href={item.href}>{item.label}</a> : item.label
          return (
            <li key={item.label} className={styles.tag}>
              {content}
            </li>
          )
        })
      }
    </ul>
  )
}
