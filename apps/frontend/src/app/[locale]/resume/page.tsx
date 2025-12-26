import Heading from "@/components/Heading/Heading";
import Link from "next/link";
import Image from "next/image";
import styles from "./Resume.module.scss";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: `${t("resume")} - ${t("jezzLucena")}` };
}

/**
 * Page that displays an embedded resumé, with a link for download 
 */
export default async function Resume() {
  const t = await getTranslations("common");

  return (
    <div className="relative bg-white">
      <div className="absolute -top-[60px]" id="content"></div>
      <div className="relative w-[100%] max-w-[1280px] mx-auto py-[30px] px-[20px] md:px-[30px] lg:px-[50px]">
        <Heading>
          <span>{t("resume")}</span>
          <Link
            href="https://jezzlucena.com/files/JezzLucenaResume2025.pdf"
            target="_blank"
            download
          >
            <div className={styles.icon}>
              <Image src="/img/download.png" width={0} height={0} unoptimized className={styles.symbol} alt="Download Resumé" />
            </div>
          </Link>
        </Heading>

        <div className={`relative w-[100%] ${styles.pdfContainer}`}>
          <embed
            className="absolute top-0 left-0 w-[100%] h-[100%]"
            src="/files/JezzLucenaResume2025.pdf#toolbar=1&navpanes=0&scrollbar=0&view=FitH"
          />
        </div>
      </div>
    </div>
  );
}
