import styles from "./Keywords.module.scss"

interface KeywordsProps {
  label: string,
  keywords: string[]
};

/**
 * Wrapper for keywords, with label
 * 
 * @prop {string} label Label to be displayed as a title for the current list of keywords
 * @prop {string[]} keywords Array containing keywords to be displayed
 */
export default function Keywords({ label, keywords }: KeywordsProps) {
  return (
    <span className={`${styles.keywords}`}>
      <span className={`${styles.label} big`}>{ label }</span>
      {keywords.map(keyword => (
        <span className={`${styles.keyword}`} key={keyword}>{ keyword }</span>
      ))}
    </span>
  );
}
