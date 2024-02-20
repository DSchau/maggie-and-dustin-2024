import socialLinks from '@/assets/contact.yaml';

import styles from './social.module.css';

export function Social() {
  return (
    <ul className={styles.container}>
      {
        socialLinks.map((link: any) => (
          <li className={styles.item} key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))
      }
    </ul>
  )
}