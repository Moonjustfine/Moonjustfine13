import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import sunArt from '../../../assets/cosmic/cosmic-sun.webp';
import moonArt from '../../../assets/cosmic/cosmic-moon.webp';
import galaxyArt from '../../../assets/cosmic/cosmic-galaxy.webp';
import blackholeArt from '../../../assets/cosmic/cosmic-blackhole.webp';
import nebulaArt from '../../../assets/cosmic/cosmic-nebula.webp';

type CosmicTheme = 'sun'|'moon'|'galaxy'|'blackhole'|'nebula'|'aurora';

const ART: Partial<Record<CosmicTheme,string>> = {
  sun:sunArt, moon:moonArt, galaxy:galaxyArt,
  blackhole:blackholeArt, nebula:nebulaArt
};
const isArtTheme=(theme:CosmicTheme):theme is Exclude<CosmicTheme,'aurora'>=>Boolean(ART[theme]);

function readTheme(): CosmicTheme {
  const v = document.documentElement.dataset.cosmicTheme;
  return v && (v in ART || v === 'aurora') ? v as CosmicTheme : 'sun';
}

export default function AndroidCosmicBackground() {
  const [theme,setTheme] = useState<CosmicTheme>(readTheme);
  const art = useRef<HTMLDivElement>(null);
  const atmosphere = useRef<HTMLDivElement>(null);
  const stars = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('pt-android-cosmic-mode');
    const root = document.documentElement;
    const sync = () => setTheme(readTheme());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root,{attributes:true,attributeFilter:['data-cosmic-theme']});
    return () => {
      observer.disconnect();
      document.body.classList.remove('pt-android-cosmic-mode');
    };
  },[]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now:number) => {
      const t=(now-start)/1000;


      if (art.current) {
        art.current.style.transform =
          `scale(${1.045 + Math.sin(t*.42)*.012})`;
      }

      if (stars.current) {
        stars.current.style.transform =
          `translate3d(${Math.sin(t*.31)*2.8}%,${Math.cos(t*.27)*1.8}%,0)`;
      }

      if (atmosphere.current) {
        const speed = theme === 'blackhole' ? 11 : 3.2;
        atmosphere.current.style.transform =
          `rotate(${t*speed + Math.sin(t*1.7)*6}deg) scale(${1.03+Math.sin(t*.8)*.025})`;
      }


      raf=requestAnimationFrame(tick);
    };

    raf=requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  },[theme]);

  const root:CSSProperties = {
    position:'fixed', inset:0, width:'100vw', height:'100dvh',
    zIndex:0, pointerEvents:'none', overflow:'hidden',
    background:'#02050a'
  };

  const atmosphereBackground =
    theme==='blackhole'
      ? 'conic-gradient(from 10deg at 50% 48%,transparent 0 18deg,rgba(70,210,255,.28) 24deg,rgba(255,175,75,.34) 32deg,transparent 42deg 150deg,rgba(255,145,55,.22) 166deg,rgba(55,210,255,.20) 184deg,transparent 198deg 360deg)'
      : theme==='galaxy'
      ? 'conic-gradient(from 20deg at 50% 50%,transparent 0 35deg,rgba(130,100,255,.20) 55deg,transparent 80deg 170deg,rgba(50,210,255,.18) 205deg,transparent 235deg)'
      : theme==='nebula'
      ? 'conic-gradient(from 35deg at 50% 50%,rgba(255,90,210,.14),transparent 35%,rgba(80,140,255,.16),transparent 70%)'
      : theme==='aurora'
      ? 'conic-gradient(from 120deg at 50% 50%,rgba(124,255,178,.16),transparent 28%,rgba(111,211,255,.16) 48%,transparent 70%,rgba(167,110,255,.12))'
      : 'radial-gradient(circle at 50% 45%,rgba(80,190,255,.10),transparent 42%)';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={root} aria-hidden="true">
      <div ref={art} style={{
        position:'absolute',inset:'-7%',
        backgroundImage:isArtTheme(theme) ? `url("${ART[theme]}")` : 'linear-gradient(125deg,rgba(124,255,178,.14),transparent 36%,rgba(111,211,255,.16) 58%,transparent 78%), radial-gradient(circle at 72% 20%,rgba(167,110,255,.12),transparent 26%)',
        backgroundRepeat:'no-repeat',
        backgroundPosition:'center',
        backgroundSize:'cover',
        opacity:.98,
        willChange:'transform'
      }}/>

      <div ref={atmosphere} style={{
        position:'absolute',
        width:'125%',height:'90%',
        left:'-12.5%',top:'5%',
        borderRadius:'50%',
        background:atmosphereBackground,
        opacity:.72,
        mixBlendMode:'screen',
        willChange:'transform'
      }}/>

      <div ref={stars} style={{
        position:'absolute',inset:'-15%',
        backgroundImage:
          'radial-gradient(circle at 18px 26px,rgba(255,255,255,.85) 0 1px,transparent 1.7px),radial-gradient(circle at 91px 67px,rgba(180,220,255,.72) 0 1px,transparent 1.7px)',
        backgroundSize:'170px 170px',
        opacity:.5,
        willChange:'transform'
      }}/>


    </div>,
    document.body
  );
}
