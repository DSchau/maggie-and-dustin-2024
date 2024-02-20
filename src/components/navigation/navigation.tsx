import styles from './navigation.module.css'

import links from '@/assets/navigation.yaml'

type Link = {
  name: string;
  to: string;
}

interface Props {
  pathname: string;
}

const isActive = (link: Link, pathname: string) => {
  if (pathname === '') {
    return link.name === 'home'
  }
  return pathname === link.name || pathname.includes(link.name)
}

export function Navigation({ pathname }: Props) {
  return (
    <nav className={styles.navigation}>
      <ul>
        {
          links.map((link: Link) => (
            <li key={link.name} className={isActive(link, pathname) ? styles.active : ''}>
              <a href={link.to}>{link.name}</a>
            </li>
          ))
        }
      </ul>
    </nav>
  )
}
