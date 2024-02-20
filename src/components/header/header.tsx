import styles from './header.module.css'
import logo from '@/assets/logos/postman.svg'

interface Props {
  commits: number;
  showCopy?: boolean;
  className?: string;
}

export function Header({ commits, showCopy = true, className }: Props) {
  const year = new Date().getFullYear()
  const frequency = <span className={styles.frequency}><strong>{commits} update{commits === 1 ? '' : 's'}</strong> in {year}</span>
  const updateWord = commits >= 10 ? 'occasionally' : 'infrequently'
  return (
    <header className={[styles.header, className].filter(Boolean).join(' ')}>
      <h1 className={styles.title}>Hi! It's Dustin & Maggie.</h1>
      <h2 className={styles.byline}>Proud parents of a little boy.</h2>
      {showCopy && <p>Welcome to our website! We update it... {updateWord} ({frequency}). We like to share updates, mostly for ourselves, and we write updates on our <a href="/travel/">travel blog</a> about those topics. We live in San Francisco, CA with our son, Noah.</p>}
    </header>
  )
}
