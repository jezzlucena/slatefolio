'use client'

import Link from "next/link"
import { useCallback, useEffect, useRef } from "react";
import useWindowScroll from "../../hooks/useWindowScroll";
import styles from "./Logo.module.scss"
import useTabActive from "../../hooks/useTabActive";

/** Aurora gradient stops as [hue, saturation, lightness] — teal, violet, magenta, gold */
const AURORA_STOPS: [number, number, number][] = [
  [172, 78, 55],
  [258, 84, 66],
  [318, 80, 62],
  [402, 92, 60],
];

const auroraAt = (t: number): string => {
  const pos = Math.min(Math.max(t, 0), 1) * (AURORA_STOPS.length - 1);
  const i = Math.min(Math.floor(pos), AURORA_STOPS.length - 2);
  const frac = pos - i;
  const [h1, s1, l1] = AURORA_STOPS[i];
  const [h2, s2, l2] = AURORA_STOPS[i + 1];
  const h = Math.round((h1 + (h2 - h1) * frac) % 360);
  const s = Math.round(s1 + (s2 - s1) * frac);
  const l = Math.round(l1 + (l2 - l1) * frac);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const VIEWBOX_HEIGHT = 1362;

/**
 * Style phases the mosaic cycles through. String phases apply to every
 * triangle alike (properties left out fall back to each triangle's own color
 * from the stylesheet); function phases are computed per triangle from its
 * position in the figure.
 */
const SVG_STYLE_CYCLES: (string | ((x: number, y: number) => string))[] = [
  'opacity: 1;',                                 // aurora: every triangle in its own color
  (_x, y) => {                                   // gradient: the chaos organizes itself —
    const color = auroraAt(y / VIEWBOX_HEIGHT);  // teal apex flowing to a gold base
    return `opacity: 1; fill: ${color}; stroke: ${color};`;
  },
  'opacity: 1; fill: white; stroke: black;',     // porcelain: white tiles, black seams
  'opacity: 1; fill: transparent;',              // stained glass: colored outlines only
  'opacity: 1; fill: black;',                    // ink: black tiles, colored seams
  'opacity: 1; fill: #f5c15c; stroke: #221a08;', // ember: molten gold
  'opacity: 0;'                                  // void: dissolve, then bloom again
];

/** 
 * Container for the very large (and optimized) interactive SVG that decorates every page
 */
export default function Logo() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const svg = useRef<SVGSVGElement>(null);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);

  const animateSVG = useCallback(() => {
    if (!svg.current) return;
    const groups = svg.current.querySelectorAll('g');
    let cycleIndex = 0;

    svg.current.setAttribute('style', 'opacity: 1;');
    
    const runCycle = () => {
      if (!svg.current // SVG element not rendered or ref not instantiated properly
      || scrollY >= svg.current.getBoundingClientRect().height // Page scrolled, logo hidden
      || !isTabActive) // Browser tab is not on focus
        return; 

      const style = SVG_STYLE_CYCLES[cycleIndex];

      for (const [index, group] of groups.entries()) {
        for (const elm of group.querySelectorAll('use')) {
          const delay = (index * 0.05).toFixed(2) + 's';
          elm.setAttribute('style', `${
            typeof style === 'string'
              ? style
              : style(Number(elm.getAttribute('x')) || 0, Number(elm.getAttribute('y')) || 0)
            } transition-delay: ${delay};`
          )
        }
      }

      cycleIndex = (cycleIndex + 1) % SVG_STYLE_CYCLES.length;
    };

    animationInterval.current = setInterval(runCycle, 8000);
    setTimeout(runCycle, 1000);
  }, [isTabActive, scrollY]);

  useEffect(() => {
    animateSVG();

    return () => {
      if (animationInterval.current) clearInterval(animationInterval.current);
    };
  }, [animateSVG]);

  return (
    <Link href="/">
      <svg className={styles.svg} ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1571 1362">
        <defs>
            <path id="a" d="M0,0l28.36-49.65h-56.72Zm0-99.3,28.36,49.65h-56.72Z"/>
            <path id="b" d="M0,0l-57.2,0,28.36,49.12Zm-86.051,49.68,28.846-49.4,28.36,49.12Z"/>
            <path id="c" d="M0,0l28.881,49.45,28.3-49.26Zm86.059,49.65-57.181-.2,28.3-49.26Z"/>
            <path id="d" d="M0,0l-57.2-0.2l28.3-49.3l0,0z"/>
        </defs>
        <g>
            <use data-index="1" className={styles.use} x="1458.3" y="1362.4" href="#a"/>
            <use data-index="2" className={styles.use} x="1486.3" y="1313.9" href="#a"/>
            <use data-index="3" className={styles.use} x="1514.3" y="1265.4" href="#a"/>
            <use data-index="4" className={styles.use} x="1542.3" y="1216.9" href="#a"/>
        </g>
        <g>
            <use data-index="5" className={styles.use} x="1430.3" y="1313.9" href="#a"/>
            <use data-index="6" className={styles.use} x="1458.3" y="1265.4" href="#a"/>
            <use data-index="7" className={styles.use} x="1486.3" y="1216.9" href="#a"/>
            <use data-index="8" className={styles.use} x="1514.3" y="1168.3" href="#a"/>
        </g>
        <g>
            <use data-index="9" className={styles.use} x="1402.3" y="1265.4" href="#a"/>
            <use data-index="10" className={styles.use} x="1430.3" y="1216.9" href="#a"/>
            <use data-index="11" className={styles.use} x="1458.3" y="1168.3" href="#a"/>
            <use data-index="12" className={styles.use} x="1486.3" y="1119.8" href="#a"/>
        </g>
        <g>
            <use data-index="13" className={styles.use} x="1374.3" y="1216.9" href="#a"/>
            <use data-index="14" className={styles.use} x="1402.3" y="1168.3" href="#a"/>
            <use data-index="15" className={styles.use} x="1430.3" y="1119.8" href="#a"/>
            <use data-index="16" className={styles.use} x="1458.3" y="1071.3" href="#a"/>
        </g>
        <g>
            <use data-index="17" className={styles.use} x="1346.3" y="1168.8" href="#a"/>
            <use data-index="18" className={styles.use} x="1374.3" y="1120.3" href="#a"/>
            <use data-index="19" className={styles.use} x="1402.3" y="1071.8" href="#a"/>
            <use data-index="20" className={styles.use} x="1430.3" y="1023.3" href="#a"/>
        </g>
        <g>
            <use data-index="21" className={styles.use} x="1318.3" y="1120.3" href="#a"/>
            <use data-index="22" className={styles.use} x="1346.3" y="1071.8" href="#a"/>
            <use data-index="23" className={styles.use} x="1374.3" y="1023.3" href="#a"/>
            <use data-index="24" className={styles.use} x="1402.3" y="974.8" href="#a"/>
        </g>
        <g>
            <use data-index="25" className={styles.use} x="1290.3" y="1071.8" href="#a"/>
            <use data-index="26" className={styles.use} x="1318.3" y="1023.3" href="#a"/>
            <use data-index="27" className={styles.use} x="1346.3" y="974.8" href="#a"/>
            <use data-index="28" className={styles.use} x="1374.3" y="926.2" href="#a"/>
        </g>
        <g>
            <use data-index="29" className={styles.use} x="1262.3" y="1023.3" href="#a"/>
            <use data-index="30" className={styles.use} x="1290.3" y="974.8" href="#a"/>
            <use data-index="31" className={styles.use} x="1318.3" y="926.2" href="#a"/>
            <use data-index="32" className={styles.use} x="1346.3" y="877.7" href="#a"/>
        </g>
        <g>
            <use data-index="33" className={styles.use} x="1234.3" y="974.3" href="#a"/>
            <use data-index="34" className={styles.use} x="1262.3" y="925.7" href="#a"/>
            <use data-index="35" className={styles.use} x="1290.3" y="877.2" href="#a"/>
            <use data-index="36" className={styles.use} x="1318.3" y="828.7" href="#a"/>
        </g>
        <g>
            <use data-index="37" className={styles.use} x="1206.3" y="925.7" href="#a"/>
            <use data-index="38" className={styles.use} x="1234.3" y="877.2" href="#a"/>
            <use data-index="39" className={styles.use} x="1262.3" y="828.7" href="#a"/>
            <use data-index="40" className={styles.use} x="1290.3" y="780.2" href="#a"/>
        </g>
        <g>
            <use data-index="41" className={styles.use} x="1178.3" y="877.2" href="#a"/>
            <use data-index="42" className={styles.use} x="1206.3" y="828.7" href="#a"/>
            <use data-index="43" className={styles.use} x="1234.3" y="780.2" href="#a"/>
            <use data-index="44" className={styles.use} x="1262.3" y="731.7" href="#a"/>
        </g>
        <g>
            <use data-index="45" className={styles.use} x="1150.3" y="828.7" href="#a"/>
            <use data-index="46" className={styles.use} x="1178.3" y="780.2" href="#a"/>
            <use data-index="47" className={styles.use} x="1206.3" y="731.7" href="#a"/>
            <use data-index="48" className={styles.use} x="1234.3" y="683.1" href="#a"/>
        </g>
        <g>
            <use data-index="49" className={styles.use} x="1122.3" y="779.7" href="#a"/>
            <use data-index="50" className={styles.use} x="1150.3" y="731.2" href="#a"/>
            <use data-index="51" className={styles.use} x="1178.3" y="682.6" href="#a"/>
            <use data-index="52" className={styles.use} x="1206.3" y="634.1" href="#a"/>
        </g>
        <g>
            <use data-index="53" className={styles.use} x="1094.3" y="731.2" href="#a"/>
            <use data-index="54" className={styles.use} x="1122.3" y="682.6" href="#a"/>
            <use data-index="55" className={styles.use} x="1150.3" y="634.1" href="#a"/>
            <use data-index="56" className={styles.use} x="1178.3" y="585.6" href="#a"/>
        </g>
        <g>
            <use data-index="57" className={styles.use} x="1066.3" y="682.6" href="#a"/>
            <use data-index="58" className={styles.use} x="1094.3" y="634.1" href="#a"/>
            <use data-index="59" className={styles.use} x="1122.3" y="585.6" href="#a"/>
            <use data-index="60" className={styles.use} x="1150.3" y="537.1" href="#a"/>
        </g>
        <g>
            <use data-index="61" className={styles.use} x="1038.3" y="634.1" href="#a"/>
            <use data-index="62" className={styles.use} x="1066.3" y="585.6" href="#a"/>
            <use data-index="63" className={styles.use} x="1094.3" y="537.1" href="#a"/>
            <use data-index="64" className={styles.use} x="1122.3" y="488.6" href="#a"/>
        </g>
        <g>
            <use data-index="65" className={styles.use} x="1010.3" y="585.1" href="#a"/>
            <use data-index="66" className={styles.use} x="1038.3" y="536.6" href="#a"/>
            <use data-index="67" className={styles.use} x="1066.3" y="488.1" href="#a"/>
            <use data-index="68" className={styles.use} x="1094.3" y="439.5" href="#a"/>
        </g>
        <g>
            <use data-index="69" className={styles.use} x="982.3" y="536.6" href="#a"/>
            <use data-index="70" className={styles.use} x="1010.3" y="488.1" href="#a"/>
            <use data-index="71" className={styles.use} x="1038.3" y="439.5" href="#a"/>
            <use data-index="72" className={styles.use} x="1066.3" y="391" href="#a"/>
        </g>
        <g>
            <use data-index="73" className={styles.use} x="954.3" y="488.1" href="#a"/>
            <use data-index="74" className={styles.use} x="982.3" y="439.5" href="#a"/>
            <use data-index="75" className={styles.use} x="1010.3" y="391" href="#a"/>
            <use data-index="76" className={styles.use} x="1038.3" y="342.5" href="#a"/>
        </g>
        <g>
            <use data-index="77" className={styles.use} x="926.3" y="439.5" href="#a"/>
            <use data-index="78" className={styles.use} x="954.3" y="391" href="#a"/>
            <use data-index="79" className={styles.use} x="982.3" y="342.5" href="#a"/>
            <use data-index="80" className={styles.use} x="1010.3" y="294" href="#a"/>
        </g>
        <g>
            <use data-index="81" className={styles.use} x="898.3" y="390.5" href="#a"/>
            <use data-index="82" className={styles.use} x="926.3" y="342" href="#a"/>
            <use data-index="83" className={styles.use} x="954.3" y="293.5" href="#a"/>
            <use data-index="84" className={styles.use} x="982.3" y="244.9" href="#a"/>
            <use data-index="85" className={styles.use} x="786.3" y="585.5" href="#a"/>
            <use data-index="86" className={styles.use} x="814.3" y="536.9" href="#a"/>
            <use data-index="87" className={styles.use} x="842.3" y="488.4" href="#a"/>
            <use data-index="88" className={styles.use} x="870.3" y="439.8" href="#a"/>
            <use data-index="89" className={styles.use} x="674.3" y="779.6" href="#a"/>
            <use data-index="90" className={styles.use} x="702.3" y="731" href="#a"/>
            <use data-index="91" className={styles.use} x="730.3" y="682.5" href="#a"/>
            <use data-index="92" className={styles.use} x="758.3" y="633.9" href="#a"/>
            <use data-index="93" className={styles.use} x="562.3" y="973.7" href="#a"/>
            <use data-index="94" className={styles.use} x="590.3" y="925.1" href="#a"/>
            <use data-index="95" className={styles.use} x="618.3" y="876.6" href="#a"/>
            <use data-index="96" className={styles.use} x="646.3" y="828" href="#a"/>
            <use data-index="97" className={styles.use} x="562.3" y="973.6" href="#d"/>
        </g>
        <g>
            <use data-index="98" className={styles.use} x="870.3" y="342" href="#a"/>
            <use data-index="99" className={styles.use} x="898.3" y="293.5" href="#a"/>
            <use data-index="100" className={styles.use} x="926.3" y="244.9" href="#a"/>
            <use data-index="101" className={styles.use} x="954.3" y="196.4" href="#a"/>
            <use data-index="102" className={styles.use} x="758.3" y="536.9" href="#a"/>
            <use data-index="103" className={styles.use} x="786.3" y="488.4" href="#a"/>
            <use data-index="104" className={styles.use} x="814.3" y="439.8" href="#a"/>
            <use data-index="105" className={styles.use} x="842.3" y="391.3" href="#a"/>
            <use data-index="106" className={styles.use} x="646.3" y="731" href="#a"/>
            <use data-index="107" className={styles.use} x="674.3" y="682.5" href="#a"/>
            <use data-index="108" className={styles.use} x="702.3" y="633.9" href="#a"/>
            <use data-index="109" className={styles.use} x="730.3" y="585.4" href="#a"/>
            <use data-index="110" className={styles.use} x="534.3" y="925.1" href="#a"/>
            <use data-index="111" className={styles.use} x="562.3" y="876.6" href="#a"/>
            <use data-index="112" className={styles.use} x="590.3" y="828" href="#a"/>
            <use data-index="113" className={styles.use} x="618.3" y="779.5" href="#a"/>
            <use data-index="114" className={styles.use} x="506.3" y="973.6" href="#d"/>
            <use data-index="115" className={styles.use} x="506.3" y="973.6" href="#a"/>
        </g>
        <g>
            <use data-index="116" className={styles.use} x="842.3" y="293.5" href="#a"/>
            <use data-index="117" className={styles.use} x="870.3" y="244.9" href="#a"/>
            <use data-index="118" className={styles.use} x="898.3" y="196.4" href="#a"/>
            <use data-index="119" className={styles.use} x="926.3" y="147.9" href="#a"/>
            <use data-index="120" className={styles.use} x="730.3" y="488.4" href="#a"/>
            <use data-index="121" className={styles.use} x="758.3" y="439.8" href="#a"/>
            <use data-index="122" className={styles.use} x="786.3" y="391.3" href="#a"/>
            <use data-index="123" className={styles.use} x="814.3" y="342.7" href="#a"/>
            <use data-index="124" className={styles.use} x="618.3" y="682.5" href="#a"/>
            <use data-index="125" className={styles.use} x="646.3" y="633.9" href="#a"/>
            <use data-index="126" className={styles.use} x="674.3" y="585.4" href="#a"/>
            <use data-index="127" className={styles.use} x="702.3" y="536.8" href="#a"/>
            <use data-index="128" className={styles.use} x="506.3" y="876.6" href="#a"/>
            <use data-index="129" className={styles.use} x="534.3" y="828" href="#a"/>
            <use data-index="130" className={styles.use} x="562.3" y="779.5" href="#a"/>
            <use data-index="131" className={styles.use} x="590.3" y="730.9" href="#a"/>
            <use data-index="132" className={styles.use} x="450.3" y="973.6" href="#d"/>
            <use data-index="133" className={styles.use} x="450.3" y="973.6" href="#a"/>
            <use data-index="134" className={styles.use} x="478.3" y="925.1" href="#a"/>
        </g>
        <g>
            <use data-index="135" className={styles.use} x="814.3" y="244.9" href="#a"/>
            <use data-index="136" className={styles.use} x="842.3" y="196.4" href="#a"/>
            <use data-index="137" className={styles.use} x="870.3" y="147.9" href="#a"/>
            <use data-index="138" className={styles.use} x="898.3" y="99.4" href="#a"/>
            <use data-index="139" className={styles.use} x="702.3" y="439.8" href="#a"/>
            <use data-index="140" className={styles.use} x="730.3" y="391.3" href="#a"/>
            <use data-index="141" className={styles.use} x="758.3" y="342.7" href="#a"/>
            <use data-index="142" className={styles.use} x="786.3" y="294.2" href="#a"/>
            <use data-index="143" className={styles.use} x="590.3" y="633.9" href="#a"/>
            <use data-index="144" className={styles.use} x="618.3" y="585.4" href="#a"/>
            <use data-index="145" className={styles.use} x="646.3" y="536.8" href="#a"/>
            <use data-index="146" className={styles.use} x="674.3" y="488.3" href="#a"/>
            <use data-index="147" className={styles.use} x="478.3" y="828" href="#a"/>
            <use data-index="148" className={styles.use} x="506.3" y="779.5" href="#a"/>
            <use data-index="149" className={styles.use} x="534.3" y="730.9" href="#a"/>
            <use data-index="150" className={styles.use} x="562.3" y="682.4" href="#a"/>
            <use data-index="151" className={styles.use} x="394.3" y="973.6" href="#d"/>
            <use data-index="152" className={styles.use} x="394.3" y="973.6" href="#a"/>
            <use data-index="153" className={styles.use} x="422.3" y="925.1" href="#a"/>
            <use data-index="154" className={styles.use} x="450.3" y="876.5" href="#a"/>
        </g>
        <g>
            <use data-index="155" className={styles.use} x="899.7" y="1.4" href="#b"/>
            <use data-index="156" className={styles.use} x="843.7" y="1.4" href="#b"/>
            <use data-index="157" className={styles.use} x="787.7" y="1.4" href="#b"/>
            <use data-index="158" className={styles.use} x="731.6" y="1.4" href="#b"/>
        </g>
        <g>
            <use data-index="159" className={styles.use} x="871.7" y="49.9" href="#b"/>
            <use data-index="160" className={styles.use} x="815.7" y="49.9" href="#b"/>
            <use data-index="161" className={styles.use} x="759.6" y="49.9" href="#b"/>
            <use data-index="162" className={styles.use} x="703.6" y="50" href="#b"/>
        </g>
        <g>
            <use data-index="163" className={styles.use} x="843.7" y="98.4" href="#b"/>
            <use data-index="164" className={styles.use} x="787.6" y="98.4" href="#b"/>
            <use data-index="165" className={styles.use} x="731.6" y="98.5" href="#b"/>
            <use data-index="166" className={styles.use} x="675.6" y="98.5" href="#b"/>
        </g>
        <g>
            <use data-index="167" className={styles.use} x="815.6" y="146.9" href="#b"/>
            <use data-index="168" className={styles.use} x="759.6" y="146.9" href="#b"/>
            <use data-index="169" className={styles.use} x="703.6" y="147" href="#b"/>
            <use data-index="170" className={styles.use} x="647.6" y="147" href="#b"/>
        </g>
        <g>
            <use data-index="171" className={styles.use} x="788" y="195.2" href="#b"/>
            <use data-index="172" className={styles.use} x="732" y="195.2" href="#b"/>
            <use data-index="173" className={styles.use} x="676" y="195.2" href="#b"/>
            <use data-index="174" className={styles.use} x="620" y="195.2" href="#b"/>
        </g>
        <g>
            <use data-index="175" className={styles.use} x="760" y="243.7" href="#b"/>
            <use data-index="176" className={styles.use} x="704" y="243.7" href="#b"/>
            <use data-index="177" className={styles.use} x="648" y="243.7" href="#b"/>
            <use data-index="178" className={styles.use} x="592" y="243.7" href="#b"/>
        </g>
        <g>
            <use data-index="179" className={styles.use} x="732" y="292.2" href="#b"/>
            <use data-index="180" className={styles.use} x="676" y="292.2" href="#b"/>
            <use data-index="181" className={styles.use} x="620" y="292.2" href="#b"/>
            <use data-index="182" className={styles.use} x="564" y="292.2" href="#b"/>
        </g>
        <g>
            <use data-index="183" className={styles.use} x="704" y="340.7" href="#b"/>
            <use data-index="184" className={styles.use} x="648" y="340.7" href="#b"/>
            <use data-index="185" className={styles.use} x="592" y="340.7" href="#b"/>
            <use data-index="186" className={styles.use} x="535.9" y="340.8" href="#b"/>
        </g>
        <g>
            <use data-index="187" className={styles.use} x="675.5" y="389.5" href="#b"/>
            <use data-index="188" className={styles.use} x="619.5" y="389.5" href="#b"/>
            <use data-index="189" className={styles.use} x="563.5" y="389.5" href="#b"/>
            <use data-index="190" className={styles.use} x="507.5" y="389.5" href="#b"/>
        </g>
        <g>
            <use data-index="191" className={styles.use} x="647.5" y="438" href="#b"/>
            <use data-index="192" className={styles.use} x="591.5" y="438" href="#b"/>
            <use data-index="193" className={styles.use} x="535.5" y="438" href="#b"/>
            <use data-index="194" className={styles.use} x="479.5" y="438" href="#b"/>
        </g>
        <g>
            <use data-index="195" className={styles.use} x="619.5" y="486.5" href="#b"/>
            <use data-index="196" className={styles.use} x="563.5" y="486.5" href="#b"/>
            <use data-index="197" className={styles.use} x="507.5" y="486.5" href="#b"/>
            <use data-index="198" className={styles.use} x="451.4" y="486.5" href="#b"/>
        </g>
        <g>
            <use data-index="199" className={styles.use} x="591.5" y="535" href="#b"/>
            <use data-index="200" className={styles.use} x="535.5" y="535" href="#b"/>
            <use data-index="201" className={styles.use} x="479.4" y="535" href="#b"/>
            <use data-index="202" className={styles.use} x="423.4" y="535" href="#b"/>
        </g>
        <g>
            <use data-index="203" className={styles.use} x="563" y="583.8" href="#b"/>
            <use data-index="204" className={styles.use} x="507" y="583.8" href="#b"/>
            <use data-index="205" className={styles.use} x="451" y="583.8" href="#b"/>
            <use data-index="206" className={styles.use} x="395" y="583.8" href="#b"/>
        </g>
        <g>
            <use data-index="207" className={styles.use} x="535" y="632.3" href="#b"/>
            <use data-index="208" className={styles.use} x="479" y="632.3" href="#b"/>
            <use data-index="209" className={styles.use} x="423" y="632.3" href="#b"/>
            <use data-index="210" className={styles.use} x="366.9" y="632.3" href="#b"/>
        </g>
        <g>
            <use data-index="211" className={styles.use} x="507" y="680.8" href="#b"/>
            <use data-index="212" className={styles.use} x="451" y="680.8" href="#b"/>
            <use data-index="213" className={styles.use} x="394.9" y="680.8" href="#b"/>
            <use data-index="214" className={styles.use} x="338.9" y="680.8" href="#b"/>
        </g>
        <g>
            <use data-index="215" className={styles.use} x="479" y="729.3" href="#b"/>
            <use data-index="216" className={styles.use} x="422.9" y="729.3" href="#b"/>
            <use data-index="217" className={styles.use} x="366.9" y="729.3" href="#b"/>
            <use data-index="218" className={styles.use} x="310.9" y="729.3" href="#b"/>
        </g>
        <g>
            <use data-index="219" className={styles.use} x="450.5" y="778.1" href="#b"/>
            <use data-index="220" className={styles.use} x="394.5" y="778.1" href="#b"/>
            <use data-index="221" className={styles.use} x="338.5" y="778.1" href="#b"/>
            <use data-index="222" className={styles.use} x="282.5" y="778.1" href="#b"/>
        </g>
        <g>
            <use data-index="223" className={styles.use} x="422.5" y="826.6" href="#b"/>
            <use data-index="224" className={styles.use} x="366.5" y="826.6" href="#b"/>
            <use data-index="225" className={styles.use} x="310.5" y="826.6" href="#b"/>
            <use data-index="226" className={styles.use} x="254.4" y="826.6" href="#b"/>
        </g>
        <g>
            <use data-index="227" className={styles.use} x="394.5" y="875.1" href="#b"/>
            <use data-index="228" className={styles.use} x="338.5" y="875.1" href="#b"/>
            <use data-index="229" className={styles.use} x="282.4" y="875.1" href="#b"/>
            <use data-index="230" className={styles.use} x="226.4" y="875.1" href="#b"/>
        </g>
        <g>
            <use data-index="231" className={styles.use} x="366.5" y="923.6" href="#b"/>
            <use data-index="232" className={styles.use} x="310.4" y="923.6" href="#b"/>
            <use data-index="233" className={styles.use} x="254.4" y="923.6" href="#b"/>
            <use data-index="234" className={styles.use} x="198.4" y="923.6" href="#b"/>
        </g>
        <g>
            <use data-index="235" className={styles.use} x="338" y="972.3" href="#b"/>
            <use data-index="236" className={styles.use} x="282" y="972.4" href="#b"/>
            <use data-index="237" className={styles.use} x="226" y="972.4" href="#b"/>
            <use data-index="238" className={styles.use} x="169.9" y="972.4" href="#b"/>
            <use data-index="239" className={styles.use} x="562.8" y="971.9" href="#b"/>
            <use data-index="240" className={styles.use} x="506.8" y="971.9" href="#b"/>
            <use data-index="241" className={styles.use} x="450.7" y="971.9" href="#b"/>
            <use data-index="242" className={styles.use} x="394.7" y="971.9" href="#b"/>
            <use data-index="243" className={styles.use} x="786.9" y="971.8" href="#b"/>
            <use data-index="244" className={styles.use} x="730.9" y="971.8" href="#b"/>
            <use data-index="245" className={styles.use} x="674.8" y="971.9" href="#b"/>
            <use data-index="246" className={styles.use} x="618.8" y="971.9" href="#b"/>
            <use data-index="247" className={styles.use} x="1011" y="971.7" href="#b"/>
            <use data-index="248" className={styles.use} x="955" y="971.8" href="#b"/>
            <use data-index="249" className={styles.use} x="899" y="971.8" href="#b"/>
            <use data-index="250" className={styles.use} x="842.9" y="971.8" href="#b"/>
            <use data-index="251" className={styles.use} x="1039" y="1020.3" href="#d"/>
        </g>
        <g>
            <use data-index="252" className={styles.use} x="310" y="1020.9" href="#b"/>
            <use data-index="253" className={styles.use} x="254" y="1020.9" href="#b"/>
            <use data-index="254" className={styles.use} x="197.9" y="1020.9" href="#b"/>
            <use data-index="255" className={styles.use} x="141.9" y="1020.9" href="#b"/>
            <use data-index="256" className={styles.use} x="534.8" y="1020.4" href="#b"/>
            <use data-index="257" className={styles.use} x="478.7" y="1020.4" href="#b"/>
            <use data-index="258" className={styles.use} x="422.7" y="1020.4" href="#b"/>
            <use data-index="259" className={styles.use} x="366.6" y="1020.5" href="#b"/>
            <use data-index="260" className={styles.use} x="758.9" y="1020.3" href="#b"/>
            <use data-index="261" className={styles.use} x="702.8" y="1020.4" href="#b"/>
            <use data-index="262" className={styles.use} x="646.8" y="1020.4" href="#b"/>
            <use data-index="263" className={styles.use} x="590.8" y="1020.4" href="#b"/>
            <use data-index="264" className={styles.use} x="983" y="1020.3" href="#b"/>
            <use data-index="265" className={styles.use} x="927" y="1020.3" href="#b"/>
            <use data-index="266" className={styles.use} x="870.9" y="1020.3" href="#b"/>
            <use data-index="267" className={styles.use} x="814.9" y="1020.3" href="#b"/>
            <use data-index="268" className={styles.use} x="1067" y="1068.8" href="#d"/>
            <use data-index="269" className={styles.use} x="1039" y="1020.3" href="#b"/>
        </g>
        <g>
            <use data-index="270" className={styles.use} x="282" y="1069.4" href="#b"/>
            <use data-index="271" className={styles.use} x="225.9" y="1069.4" href="#b"/>
            <use data-index="272" className={styles.use} x="169.9" y="1069.4" href="#b"/>
            <use data-index="273" className={styles.use} x="113.9" y="1069.4" href="#b"/>
            <use data-index="274" className={styles.use} x="506.7" y="1068.9" href="#b"/>
            <use data-index="275" className={styles.use} x="450.7" y="1068.9" href="#b"/>
            <use data-index="276" className={styles.use} x="394.6" y="1069" href="#b"/>
            <use data-index="277" className={styles.use} x="338.6" y="1069" href="#b"/>
            <use data-index="278" className={styles.use} x="730.8" y="1068.8" href="#b"/>
            <use data-index="279" className={styles.use} x="674.8" y="1068.9" href="#b"/>
            <use data-index="280" className={styles.use} x="618.8" y="1068.9" href="#b"/>
            <use data-index="281" className={styles.use} x="562.7" y="1068.9" href="#b"/>
            <use data-index="282" className={styles.use} x="955" y="1068.8" href="#b"/>
            <use data-index="283" className={styles.use} x="898.9" y="1068.8" href="#b"/>
            <use data-index="284" className={styles.use} x="842.9" y="1068.8" href="#b"/>
            <use data-index="285" className={styles.use} x="786.8" y="1068.9" href="#b"/>
            <use data-index="286" className={styles.use} x="1095" y="1117.3" href="#d"/>
            <use data-index="287" className={styles.use} x="1067" y="1068.8" href="#b"/>
            <use data-index="288" className={styles.use} x="1010.9" y="1068.8" href="#b"/>
        </g>
        <g>
            <use data-index="289" className={styles.use} x="253.9" y="1117.9" href="#b"/>
            <use data-index="290" className={styles.use} x="197.9" y="1117.9" href="#b"/>
            <use data-index="291" className={styles.use} x="141.9" y="1117.9" href="#b"/>
            <use data-index="292" className={styles.use} x="85.9" y="1117.9" href="#b"/>
            <use data-index="293" className={styles.use} x="478.7" y="1117.4" href="#b"/>
            <use data-index="294" className={styles.use} x="422.6" y="1117.5" href="#b"/>
            <use data-index="295" className={styles.use} x="366.6" y="1117.5" href="#b"/>
            <use data-index="296" className={styles.use} x="310.6" y="1117.5" href="#b"/>
            <use data-index="297" className={styles.use} x="702.8" y="1117.4" href="#b"/>
            <use data-index="298" className={styles.use} x="646.8" y="1117.4" href="#b"/>
            <use data-index="299" className={styles.use} x="590.7" y="1117.4" href="#b"/>
            <use data-index="300" className={styles.use} x="534.7" y="1117.5" href="#b"/>
            <use data-index="301" className={styles.use} x="926.9" y="1117.3" href="#b"/>
            <use data-index="302" className={styles.use} x="870.9" y="1117.3" href="#b"/>
            <use data-index="303" className={styles.use} x="814.8" y="1117.4" href="#b"/>
            <use data-index="304" className={styles.use} x="758.8" y="1117.4" href="#b"/>
            <use data-index="305" className={styles.use} x="1122.2" y="1165.7" href="#d"/>
            <use data-index="306" className={styles.use} x="1095" y="1117.3" href="#b"/>
            <use data-index="307" className={styles.use} x="1038.9" y="1117.3" href="#b"/>
            <use data-index="308" className={styles.use} x="982.9" y="1117.3" href="#b"/>
        </g>
        <g>
            <use data-index="309" className={styles.use} x=".8" y="1166.2" href="#c"/>
            <use data-index="310" className={styles.use} x="28.9" y="1214.7" href="#c"/>
            <use data-index="311" className={styles.use} x="57" y="1263.3" href="#c"/>
            <use data-index="312" className={styles.use} x="85.1" y="1311.9" href="#c"/>
        </g>
        <g>
            <use data-index="313" className={styles.use} x="56.8" y="1166.1" href="#c"/>
            <use data-index="314" className={styles.use} x="84.9" y="1214.7" href="#c"/>
            <use data-index="315" className={styles.use} x="113" y="1263.2" href="#c"/>
            <use data-index="316" className={styles.use} x="141.1" y="1311.8" href="#c"/>
        </g>
        <g>
            <use data-index="317" className={styles.use} x="112.9" y="1166" href="#c"/>
            <use data-index="318" className={styles.use} x="140.9" y="1214.6" href="#c"/>
            <use data-index="319" className={styles.use} x="169" y="1263.2" href="#c"/>
            <use data-index="320" className={styles.use} x="197.1" y="1311.8" href="#c"/>
        </g>
        <g>
            <use data-index="321" className={styles.use} x="168.9" y="1166" href="#c"/>
            <use data-index="322" className={styles.use} x="197" y="1214.5" href="#c"/>
            <use data-index="323" className={styles.use} x="225" y="1263.1" href="#c"/>
            <use data-index="324" className={styles.use} x="253.1" y="1311.7" href="#c"/>
        </g>
        <g>
            <use data-index="325" className={styles.use} x="224.5" y="1165.7" href="#c"/>
            <use data-index="326" className={styles.use} x="252.6" y="1214.2" href="#c"/>
            <use data-index="327" className={styles.use} x="280.6" y="1262.8" href="#c"/>
            <use data-index="328" className={styles.use} x="308.7" y="1311.4" href="#c"/>
        </g>
        <g>
            <use data-index="329" className={styles.use} x="280.5" y="1165.6" href="#c"/>
            <use data-index="330" className={styles.use} x="308.6" y="1214.2" href="#c"/>
            <use data-index="331" className={styles.use} x="336.6" y="1262.8" href="#c"/>
            <use data-index="332" className={styles.use} x="364.7" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="333" className={styles.use} x="336.5" y="1165.5" href="#c"/>
            <use data-index="334" className={styles.use} x="364.6" y="1214.1" href="#c"/>
            <use data-index="335" className={styles.use} x="392.7" y="1262.7" href="#c"/>
            <use data-index="336" className={styles.use} x="420.7" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="337" className={styles.use} x="392.5" y="1165.5" href="#c"/>
            <use data-index="338" className={styles.use} x="420.6" y="1214.1" href="#c"/>
            <use data-index="339" className={styles.use} x="448.7" y="1262.7" href="#c"/>
            <use data-index="340" className={styles.use} x="476.8" y="1311.2" href="#c"/>
        </g>
        <g>
            <use data-index="341" className={styles.use} x="449" y="1165.7" href="#c"/>
            <use data-index="342" className={styles.use} x="477.1" y="1214.3" href="#c"/>
            <use data-index="343" className={styles.use} x="505.1" y="1262.8" href="#c"/>
            <use data-index="344" className={styles.use} x="533.2" y="1311.4" href="#c"/>
        </g>
        <g>
            <use data-index="345" className={styles.use} x="505" y="1165.6" href="#c"/>
            <use data-index="346" className={styles.use} x="533.1" y="1214.2" href="#c"/>
            <use data-index="347" className={styles.use} x="561.2" y="1262.8" href="#c"/>
            <use data-index="348" className={styles.use} x="589.2" y="1311.4" href="#c"/>
        </g>
        <g>
            <use data-index="349" className={styles.use} x="561" y="1165.6" href="#c"/>
            <use data-index="350" className={styles.use} x="589.1" y="1214.2" href="#c"/>
            <use data-index="351" className={styles.use} x="617.2" y="1262.7" href="#c"/>
            <use data-index="352" className={styles.use} x="645.3" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="353" className={styles.use} x="617" y="1165.5" href="#c"/>
            <use data-index="354" className={styles.use} x="645.1" y="1214.1" href="#c"/>
            <use data-index="355" className={styles.use} x="673.2" y="1262.7" href="#c"/>
            <use data-index="356" className={styles.use} x="701.3" y="1311.2" href="#c"/>
        </g>
        <g>
            <use data-index="357" className={styles.use} x="673.5" y="1165.7" href="#c"/>
            <use data-index="358" className={styles.use} x="701.6" y="1214.3" href="#c"/>
            <use data-index="359" className={styles.use} x="729.7" y="1262.9" href="#c"/>
            <use data-index="360" className={styles.use} x="757.7" y="1311.4" href="#c"/>
        </g>
        <g>
            <use data-index="361" className={styles.use} x="729.5" y="1165.7" href="#c"/>
            <use data-index="362" className={styles.use} x="757.6" y="1214.2" href="#c"/>
            <use data-index="363" className={styles.use} x="785.7" y="1262.8" href="#c"/>
            <use data-index="364" className={styles.use} x="813.8" y="1311.4" href="#c"/>
        </g>
        <g>
            <use data-index="365" className={styles.use} x="785.5" y="1165.6" href="#c"/>
            <use data-index="366" className={styles.use} x="813.6" y="1214.2" href="#c"/>
            <use data-index="367" className={styles.use} x="841.7" y="1262.8" href="#c"/>
            <use data-index="368" className={styles.use} x="869.8" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="369" className={styles.use} x="841.6" y="1165.5" href="#c"/>
            <use data-index="370" className={styles.use} x="869.6" y="1214.1" href="#c"/>
            <use data-index="371" className={styles.use} x="897.7" y="1262.7" href="#c"/>
            <use data-index="372" className={styles.use} x="925.8" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="373" className={styles.use} x="898" y="1165.7" href="#c"/>
            <use data-index="374" className={styles.use} x="926.1" y="1214.3" href="#c"/>
            <use data-index="375" className={styles.use} x="954.2" y="1262.9" href="#c"/>
            <use data-index="376" className={styles.use} x="982.2" y="1311.5" href="#c"/>
        </g>
        <g>
            <use data-index="377" className={styles.use} x="954" y="1165.7" href="#c"/>
            <use data-index="378" className={styles.use} x="982.1" y="1214.3" href="#c"/>
            <use data-index="379" className={styles.use} x="1010.2" y="1262.8" href="#c"/>
            <use data-index="380" className={styles.use} x="1038.3" y="1311.4" href="#c"/>
        </g>
        <g>
            <use data-index="381" className={styles.use} x="1010" y="1165.6" href="#c"/>
            <use data-index="382" className={styles.use} x="1038.1" y="1214.2" href="#c"/>
            <use data-index="383" className={styles.use} x="1066.2" y="1262.8" href="#c"/>
            <use data-index="384" className={styles.use} x="1094.3" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="385" className={styles.use} x="1066.1" y="1165.6" href="#c"/>
            <use data-index="386" className={styles.use} x="1094.2" y="1214.1" href="#c"/>
            <use data-index="387" className={styles.use} x="1122.2" y="1262.7" href="#c"/>
            <use data-index="388" className={styles.use} x="1150.3" y="1311.3" href="#c"/>
        </g>
        <g>
            <use data-index="389" className={styles.use} x="1122.5" y="1165.8" href="#c"/>
            <use data-index="390" className={styles.use} x="1150.6" y="1214.3" href="#c"/>
            <use data-index="391" className={styles.use} x="1178.7" y="1262.9" href="#c"/>
            <use data-index="392" className={styles.use} x="1206.8" y="1311.5" href="#c"/>
            <use data-index="393" className={styles.use} x="1009.5" y="971" href="#c"/>
            <use data-index="394" className={styles.use} x="1037.6" y="1019.6" href="#c"/>
            <use data-index="395" className={styles.use} x="1065.7" y="1068.2" href="#c"/>
            <use data-index="396" className={styles.use} x="1093.8" y="1116.8" href="#c"/>
            <use data-index="397" className={styles.use} x="897.1" y="776.7" href="#c"/>
            <use data-index="398" className={styles.use} x="925.2" y="825.3" href="#c"/>
            <use data-index="399" className={styles.use} x="953.3" y="873.9" href="#c"/>
            <use data-index="400" className={styles.use} x="981.4" y="922.5" href="#c"/>
            <use data-index="401" className={styles.use} x="784.8" y="582.4" href="#c"/>
            <use data-index="402" className={styles.use} x="812.9" y="631" href="#c"/>
            <use data-index="403" className={styles.use} x="841" y="679.6" href="#c"/>
            <use data-index="404" className={styles.use} x="869.1" y="728.1" href="#c"/>
            <use data-index="405" className={styles.use} x="842.8" y="583.5" href="#d"/>
        </g>
        <g>
            <use data-index="406" className={styles.use} x="1178.5" y="1165.7" href="#c"/>
            <use data-index="407" className={styles.use} x="1206.6" y="1214.3" href="#c"/>
            <use data-index="408" className={styles.use} x="1234.7" y="1262.8" href="#c"/>
            <use data-index="409" className={styles.use} x="1262.8" y="1311.4" href="#c"/>
            <use data-index="410" className={styles.use} x="1065.5" y="971" href="#c"/>
            <use data-index="411" className={styles.use} x="1093.6" y="1019.6" href="#c"/>
            <use data-index="412" className={styles.use} x="1121.7" y="1068.2" href="#c"/>
            <use data-index="413" className={styles.use} x="1149.8" y="1116.8" href="#c"/>
            <use data-index="414" className={styles.use} x="953.2" y="776.7" href="#c"/>
            <use data-index="415" className={styles.use} x="981.3" y="825.2" href="#c"/>
            <use data-index="416" className={styles.use} x="1009.4" y="873.8" href="#c"/>
            <use data-index="417" className={styles.use} x="1037.5" y="922.4" href="#c"/>
            <use data-index="418" className={styles.use} x="840.8" y="582.3" href="#c"/>
            <use data-index="419" className={styles.use} x="868.9" y="630.9" href="#c"/>
            <use data-index="420" className={styles.use} x="897" y="679.5" href="#c"/>
            <use data-index="421" className={styles.use} x="925.1" y="728.1" href="#c"/>
            <use data-index="423" className={styles.use} x="870.8" y="534.9" href="#d"/>
            <use data-index="422" className={styles.use} x="812.8" y="533.8" href="#c"/>
        </g>
        <g>
            <use data-index="424" className={styles.use} x="1234.6" y="1165.6" href="#c"/>
            <use data-index="425" className={styles.use} x="1262.6" y="1214.2" href="#c"/>
            <use data-index="426" className={styles.use} x="1290.7" y="1262.8" href="#c"/>
            <use data-index="427" className={styles.use} x="1318.8" y="1311.4" href="#c"/>
            <use data-index="428" className={styles.use} x="1121.5" y="970.9" href="#c"/>
            <use data-index="429" className={styles.use} x="1149.7" y="1019.5" href="#c"/>
            <use data-index="430" className={styles.use} x="1177.8" y="1068.1" href="#c"/>
            <use data-index="431" className={styles.use} x="1205.9" y="1116.7" href="#c"/>
            <use data-index="432" className={styles.use} x="1009.2" y="776.6" href="#c"/>
            <use data-index="433" className={styles.use} x="1037.3" y="825.2" href="#c"/>
            <use data-index="434" className={styles.use} x="1065.4" y="873.8" href="#c"/>
            <use data-index="435" className={styles.use} x="1093.5" y="922.4" href="#c"/>
            <use data-index="436" className={styles.use} x="896.9" y="582.3" href="#c"/>
            <use data-index="437" className={styles.use} x="925" y="630.9" href="#c"/>
            <use data-index="438" className={styles.use} x="953.1" y="679.5" href="#c"/>
            <use data-index="439" className={styles.use} x="981.2" y="728.1" href="#c"/>
            <use data-index="442" className={styles.use} x="898.7" y="486.2" href="#d"/>
            <use data-index="440" className={styles.use} x="840.7" y="485.1" href="#c"/>
            <use data-index="441" className={styles.use} x="868.8" y="533.7" href="#c"/>
        </g>
        <g>
            <use data-index="443" className={styles.use} x="1290.6" y="1165.6" href="#c"/>
            <use data-index="444" className={styles.use} x="1318.7" y="1214.2" href="#c"/>
            <use data-index="445" className={styles.use} x="1346.7" y="1262.7" href="#c"/>
            <use data-index="446" className={styles.use} x="1374.8" y="1311.3" href="#c"/>
            <use data-index="447" className={styles.use} x="1177.6" y="970.9" href="#c"/>
            <use data-index="448" className={styles.use} x="1205.7" y="1019.5" href="#c"/>
            <use data-index="449" className={styles.use} x="1233.8" y="1068.1" href="#c"/>
            <use data-index="450" className={styles.use} x="1261.9" y="1116.7" href="#c"/>
            <use data-index="451" className={styles.use} x="1065.3" y="776.6" href="#c"/>
            <use data-index="452" className={styles.use} x="1093.3" y="825.2" href="#c"/>
            <use data-index="453" className={styles.use} x="1121.5" y="873.7" href="#c"/>
            <use data-index="454" className={styles.use} x="1149.6" y="922.3" href="#c"/>
            <use data-index="455" className={styles.use} x="952.9" y="582.2" href="#c"/>
            <use data-index="456" className={styles.use} x="981" y="630.8" href="#c"/>
            <use data-index="457" className={styles.use} x="1009.1" y="679.4" href="#c"/>
            <use data-index="458" className={styles.use} x="1037.2" y="728" href="#c"/>
            <use data-index="462" className={styles.use} x="926.7" y="437.6" href="#d"/>
            <use data-index="459" className={styles.use} x="868.7" y="436.5" href="#c"/>
            <use data-index="460" className={styles.use} x="896.8" y="485.1" href="#c"/>
            <use data-index="461" className={styles.use} x="924.9" y="533.7" href="#c"/>
        </g>
      </svg>
    </Link>
  )
}
