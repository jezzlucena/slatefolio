import styles from "./Button.module.scss"

interface ButtonProps {
  theme?: 'light' | 'dark',
  children: React.ReactNode,
  className?: string,
  onClick?: () => void
}

/**
 * Component that represents a stylized button
 */
export default function Button({ theme, children, className, onClick }: ButtonProps) {
  return (
    <span
      className={`${styles.button} ${theme === 'light' ? styles.light : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </span>
  )
}
