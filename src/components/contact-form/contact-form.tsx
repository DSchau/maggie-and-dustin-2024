import { type FormEvent, useState, useRef } from 'react'

import styles from './contact-form.module.css';

enum Status {
  idle = "IDLE",
  in_progress = "IN_PROGRESS",
  success = "SUCCESS",
  failed = "FAILED"
}

const SPAM_FIELD_VALUE = import.meta.env.PUBLIC_SPAM_FIELD_VALUE

const delay = (duration: number) => new Promise(resolve => {
  setTimeout(resolve, duration)
})

export function ContactForm() {
  const [status, setStatus] = useState(Status.idle)
  const [time, setTime] = useState(Date.now())
  const formEl = useRef(null)

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();

    setStatus(Status.in_progress)

    const formData = new FormData(ev.target as HTMLFormElement)

    const diffSeconds = (Date.now() - time) / 1000
    const HUMAN_THRESHOLD_SECONDS = 10

    /*
     * Naive spam bot detection
     * I tested a bunch, and 10s is about the minimum time a real human user takes to fill this out
     */
    if (diffSeconds >= HUMAN_THRESHOLD_SECONDS) {
      const response = await fetch("/api/email", {
        method: 'POST',
        body: formData
      })
      if (response.ok) {
        setStatus(Status.success)
    
        await delay(5000)
  
        if (formEl && formEl.current) {
          (formEl.current as any).reset()
        }
  
        setStatus(Status.idle)
      } else {
        setStatus(Status.failed)
      }
    } else {
      setStatus(Status.failed)
    }
    
  }

  const getButtonText = () => {
    switch (status) {
      case Status.success:
        return 'Message sent. Thanks!';
      case Status.failed:
          return 'Failed. E-mail me@dustinschau.com';
      case Status.in_progress:
        return 'Sending message';
      default:
        return 'Send message'
    }
  }
  return (
    <form className={styles.container} name="contact-me" action="/api/email" method="POST" onSubmit={submit} ref={formEl}>
      <div className={styles.row}>
        <input name="name" type="text" placeholder="Your name" autoComplete="name" required />
        <input name="lastName" type="text" placeholder="Your last name" defaultValue={SPAM_FIELD_VALUE} tabIndex={-1} required />
        <input name="email" type="email" placeholder="Your e-mail" autoComplete="email" required />
      </div>
      <div className={styles.row}>
        <textarea name="message" className={styles.message} placeholder="Your message" required></textarea>
      </div>
      <div className={styles.row}>
        <button className={styles.button} type="submit" disabled={status !== Status.idle} data-state={status}>
          {getButtonText()}
        </button>
      </div>
    </form>
  )
}
