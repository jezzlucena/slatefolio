import React from "react"
import styles from "./Heading.module.scss"

interface HeadingProps {
  children: React.ReactNode
}

export default function Heading({ children }: HeadingProps) {
  return (
    <div className={styles.title}>
      {children}
    </div>
  )
}
