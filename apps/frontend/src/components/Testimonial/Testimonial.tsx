'use client';

import Link from "next/link"
import ReactMarkdown from "react-markdown"
import styles from "./Testimonial.module.scss"

interface TestimonialProps {
  quote: string,
  role: string,
  connection: string,
  author: string,
  href: string
}

/**
 * Instance of a Testimonial to be used on the About screen
 * 
 * @prop {string} href Hyperlink to be opened on a separate tab of the browser upon clicking this testimonial
 * @prop {string} quote Markdown content for the testimonial quote
 */
export default function Testimonial({
  quote,
  role,
  connection,
  author,
  href
}: TestimonialProps) {
  return (
    <Link href={href} target="_blank">
      <div className={`${styles.testimonial}`}>
        <div className={`${styles.quote}`}>
          <ReactMarkdown>{quote}</ReactMarkdown>
        </div>
        <div className={`${styles.author}`}>
          - { author }
        </div>
        <div className={`${styles.role}`}>
          { role }
        </div>
        <div className={`${styles.connection}`}>
          { connection }
        </div>
      </div>
    </Link>
  );
}
