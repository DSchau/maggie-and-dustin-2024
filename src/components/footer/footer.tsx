import { Social } from '@/components/footer/social.tsx';
import Heart from 'phosphor-react/src/icons/Heart.tsx'

import styles from './footer.module.css'

interface Props {
  updated: string | undefined
}

export function Footer(props: Props) {
  return (
    <footer className={styles.footer}>
      <p className={styles.copyright}>Made with <Heart weight="fill" /> by yours truly</p>
      <Social />
      <p className={styles.version}>Last updated: {new Date(props.updated).toLocaleDateString("en-us", {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
        day: 'numeric',
      })}</p>
    </footer>
  )
}
