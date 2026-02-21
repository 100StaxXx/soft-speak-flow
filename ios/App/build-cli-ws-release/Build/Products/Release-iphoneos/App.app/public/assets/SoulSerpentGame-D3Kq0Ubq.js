import{j as e,r as a,l as R,m as S,dd as ie,cp as oe,eb as le,ec as ce}from"./vendor-FfY6MM0Z.js";import{bo as Ae,bp as Ie,bq as Pe,br as De}from"./index-sX_cJ3I4.js";import{t as H}from"./gameUtils-G90wW1BE.js";import"./date-vendor-Bk4KiHsJ.js";import"./three-vendor-qI8GXUTd.js";const Le=`
  /* === GLOBAL GAME STYLES === */
  
  /* Premium glass container with depth */
  .game-container {
    background: linear-gradient(
      165deg,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(10, 10, 30, 0.95) 30%,
      rgba(20, 10, 40, 0.92) 70%,
      rgba(5, 5, 25, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 30px 60px -15px rgba(0, 0, 0, 0.7),
      0 0 80px -20px rgba(168, 85, 247, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
  }
  
  /* Premium card surface with subtle texture */
  .game-surface {
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0.01) 50%,
      rgba(0, 0, 0, 0.02) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1),
      0 12px 45px -10px rgba(0, 0, 0, 0.6);
    border-radius: 16px;
  }
  
  /* === COSMIC ANIMATIONS === */
  
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  
  @keyframes cosmic-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-3px) rotate(1deg); }
    75% { transform: translateY(2px) rotate(-1deg); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
      opacity: 1;
    }
    50% { 
      box-shadow: 0 0 35px currentColor, 0 0 70px currentColor;
      opacity: 0.85;
    }
  }
  
  @keyframes cosmic-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes scale-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }
  
  @keyframes cosmic-breathe {
    0%, 100% { opacity: 0.6; transform: scale(1); filter: brightness(1); }
    50% { opacity: 1; transform: scale(1.03); filter: brightness(1.15); }
  }
  
  @keyframes success-burst {
    0% { transform: scale(0); opacity: 1; filter: brightness(2); }
    50% { transform: scale(1.5); opacity: 0.8; filter: brightness(1.5); }
    100% { transform: scale(2.5); opacity: 0; filter: brightness(1); }
  }
  
  @keyframes cosmic-shake {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    10%, 50%, 90% { transform: translateX(-3px) rotate(-0.5deg); }
    30%, 70% { transform: translateX(3px) rotate(0.5deg); }
  }
  
  @keyframes twinkle-pulse {
    0%, 100% { opacity: 0.15; transform: scale(0.7); filter: blur(0.5px); }
    50% { opacity: 0.95; transform: scale(1.15); filter: blur(0px); }
  }
  
  @keyframes ring-expand {
    0% { transform: scale(1); opacity: 0.9; filter: blur(0px); }
    100% { transform: scale(2.2); opacity: 0; filter: blur(2px); }
  }
  
  @keyframes cosmic-spin {
    from { transform: rotate(0deg); filter: hue-rotate(0deg); }
    to { transform: rotate(360deg); filter: hue-rotate(20deg); }
  }
  
  @keyframes stardust-trail {
    0% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.3) translateY(-10px); }
  }
  
  @keyframes aurora-wave {
    0%, 100% { opacity: 0.3; transform: translateX(-10%) skewX(-5deg); }
    50% { opacity: 0.6; transform: translateX(10%) skewX(5deg); }
  }
  
  /* === UTILITY CLASSES === */
  
  .animate-shimmer {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.15) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2.5s ease-in-out infinite;
  }
  
  .animate-cosmic-float {
    animation: cosmic-float 3s ease-in-out infinite;
  }
  
  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
  
  .animate-cosmic-rotate {
    animation: cosmic-rotate 10s linear infinite;
  }
  
  .animate-scale-breathe {
    animation: scale-breathe 1s ease-in-out infinite;
  }
  
  .animate-cosmic-breathe {
    animation: cosmic-breathe 3.5s ease-in-out infinite;
  }
  
  .animate-cosmic-shake {
    animation: cosmic-shake 0.4s ease-in-out;
  }
  
  .animate-ring-expand {
    animation: ring-expand 0.7s ease-out forwards;
  }
  
  .animate-stardust {
    animation: stardust-trail 1.5s ease-out forwards;
  }
  
  /* GPU acceleration */
  .gpu-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
    will-change: transform, opacity;
  }
  
  /* Premium button with cosmic glow */
  .game-button {
    background: linear-gradient(
      135deg,
      hsl(var(--primary)) 0%,
      hsl(var(--primary) / 0.85) 50%,
      hsl(var(--accent)) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 6px 20px hsl(var(--primary) / 0.4),
      0 0 40px hsl(var(--primary) / 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .game-button:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 8px 25px hsl(var(--primary) / 0.5),
      0 0 50px hsl(var(--primary) / 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  
  .game-button:active {
    transform: translateY(0) scale(0.98);
  }
  
  /* Premium progress bar with animated gradient */
  .progress-bar-premium {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      inset 0 2px 6px rgba(0, 0, 0, 0.4),
      0 1px 0 rgba(255, 255, 255, 0.05);
    border-radius: 999px;
  }
  
  .progress-fill-premium {
    background: linear-gradient(
      90deg,
      hsl(var(--primary)) 0%,
      hsl(var(--accent)) 50%,
      hsl(var(--primary)) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s linear infinite;
    box-shadow: 
      0 0 20px hsl(var(--primary) / 0.6),
      0 0 40px hsl(var(--primary) / 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
    border-radius: 999px;
  }
  
  /* Stat pill with glass effect */
  .stat-pill {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.02) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 
      0 4px 15px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  
  /* Score badge with cosmic glow */
  .score-badge {
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.25) 0%,
      rgba(168, 85, 247, 0.1) 100%
    );
    border: 1px solid rgba(168, 85, 247, 0.4);
    box-shadow: 
      0 0 25px rgba(168, 85, 247, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  
  .combo-badge {
    background: linear-gradient(
      135deg,
      rgba(250, 204, 21, 0.25) 0%,
      rgba(251, 191, 36, 0.1) 100%
    );
    border: 1px solid rgba(250, 204, 21, 0.5);
    box-shadow: 
      0 0 25px rgba(250, 204, 21, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
  
  /* Feedback overlays with premium styling */
  .feedback-perfect {
    background: linear-gradient(
      135deg,
      rgba(250, 204, 21, 0.2) 0%,
      rgba(251, 191, 36, 0.08) 100%
    );
    border: 2px solid rgba(250, 204, 21, 0.6);
    box-shadow: 
      0 0 40px rgba(250, 204, 21, 0.5),
      0 0 80px rgba(250, 204, 21, 0.25),
      inset 0 0 40px rgba(250, 204, 21, 0.15);
  }
  
  .feedback-good {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.2) 0%,
      rgba(34, 197, 94, 0.08) 100%
    );
    border: 2px solid rgba(34, 197, 94, 0.6);
    box-shadow: 
      0 0 40px rgba(34, 197, 94, 0.5),
      0 0 80px rgba(34, 197, 94, 0.25),
      inset 0 0 40px rgba(34, 197, 94, 0.15);
  }
  
  .feedback-miss {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.2) 0%,
      rgba(239, 68, 68, 0.08) 100%
    );
    border: 2px solid rgba(239, 68, 68, 0.6);
    box-shadow: 
      0 0 40px rgba(239, 68, 68, 0.5),
      0 0 80px rgba(239, 68, 68, 0.25),
      inset 0 0 40px rgba(239, 68, 68, 0.15);
  }
  
  /* Premium orb styles with depth */
  .orb-fire { 
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff4757 100%);
    box-shadow: 0 0 20px rgba(255, 107, 107, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-water { 
    background: linear-gradient(135deg, #4facfe 0%, #00cec9 50%, #0984e3 100%);
    box-shadow: 0 0 20px rgba(79, 172, 254, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-earth { 
    background: linear-gradient(135deg, #00b894 0%, #55a630 50%, #2d6a4f 100%);
    box-shadow: 0 0 20px rgba(0, 184, 148, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-light { 
    background: linear-gradient(135deg, #ffd93d 0%, #ff9f1c 50%, #f9a825 100%);
    box-shadow: 0 0 20px rgba(255, 217, 61, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.4);
  }
  .orb-dark { 
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6366f1 100%);
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-cosmic { 
    background: linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #e11d48 100%);
    box-shadow: 0 0 20px rgba(244, 114, 182, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  
  /* Touch optimization */
  .touch-target {
    min-height: 48px;
    min-width: 48px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }
  
  /* Premium nebula background effect */
  .nebula-bg {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse at 15% 15%, rgba(139, 92, 246, 0.12) 0%, transparent 55%),
      radial-gradient(ellipse at 85% 85%, rgba(34, 211, 238, 0.08) 0%, transparent 55%),
      radial-gradient(ellipse at 50% 50%, rgba(236, 72, 153, 0.06) 0%, transparent 55%),
      radial-gradient(ellipse at 25% 75%, rgba(251, 191, 36, 0.04) 0%, transparent 45%);
    pointer-events: none;
    animation: aurora-wave 8s ease-in-out infinite;
  }
  
  /* Cosmic vignette overlay */
  .cosmic-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.4) 100%
    );
    pointer-events: none;
  }
  
  /* Star particle styles */
  .star-particle {
    position: absolute;
    border-radius: 50%;
    background: white;
    animation: twinkle-pulse var(--twinkle-duration, 2s) ease-in-out infinite;
    animation-delay: var(--twinkle-delay, 0s);
  }
  
  /* Game arena with premium border */
  .game-arena {
    position: relative;
    background: linear-gradient(
      165deg,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(10, 10, 30, 0.95) 50%,
      rgba(20, 10, 40, 0.9) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 30px 60px -15px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  
  /* Cosmic text glow */
  .cosmic-text {
    text-shadow: 
      0 0 10px currentColor,
      0 0 20px currentColor,
      0 0 40px currentColor;
  }
  
  /* Success celebration effect */
  .celebration-burst::after {
    content: '';
    position: absolute;
    inset: -50%;
    background: radial-gradient(
      circle,
      rgba(250, 204, 21, 0.3) 0%,
      transparent 60%
    );
    animation: success-burst 0.8s ease-out forwards;
  }
`,Ee=({children:i})=>e.jsxs(e.Fragment,{children:[e.jsx("style",{children:Le}),i]}),Re={beginner:{baseSpeed:400},easy:{baseSpeed:320},medium:{baseSpeed:260},hard:{baseSpeed:200},master:{baseSpeed:160}},v=10,Ge=28,d=Ge,de=600,ne=30,$e=30,Xe=()=>{if(typeof window>"u")return 28;const i=window.innerHeight;return i<600?24:i<700?26:28},G=a.memo(({direction:i,onPress:g,disabled:f})=>{const j={up:ce,down:le,left:oe,right:ie}[i],P={up:"top-0 left-1/2 -translate-x-1/2",down:"bottom-0 left-1/2 -translate-x-1/2",left:"left-0 top-1/2 -translate-y-1/2",right:"right-0 top-1/2 -translate-y-1/2"};return e.jsx("button",{className:`absolute ${P[i]} w-12 h-12 rounded-lg 
        bg-primary/20 border border-primary/40 backdrop-blur-sm
        active:bg-primary/40 active:scale-95 transition-all
        flex items-center justify-center touch-manipulation
        ${f?"opacity-50":""}`,onTouchStart:h=>{h.preventDefault(),f||g(i)},onClick:()=>{f||g(i)},disabled:f,children:e.jsx(j,{className:"w-6 h-6 text-primary"})})});G.displayName="DPadButton";const ue=a.memo(({direction:i,visible:g})=>{if(!g||!i)return null;const c={up:ce,down:le,left:oe,right:ie}[i];return e.jsx(S.div,{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-30",initial:{opacity:0,scale:1.5},animate:{opacity:.8,scale:1},exit:{opacity:0,scale:.5},transition:{duration:.2},children:e.jsx("div",{className:"p-4 rounded-full bg-primary/30 backdrop-blur-sm",children:e.jsx(c,{className:"w-12 h-12 text-primary"})})})});ue.displayName="SwipeIndicator";const pe=a.memo(({show:i})=>e.jsx(R,{children:i&&e.jsx(S.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},className:"absolute bottom-2 left-0 right-0 text-center z-20",children:e.jsx("div",{className:"inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30",children:e.jsx("span",{className:"text-xs text-primary",children:"👆 Swipe or use D-Pad below"})})})}));pe.displayName="SwipeHint";const ge=a.memo(({particle:i})=>e.jsx(S.div,{className:"absolute rounded-full pointer-events-none",style:{left:i.x*d+d/2,top:i.y*d+d/2,width:(d-6)*i.scale,height:(d-6)*i.scale,transform:"translate(-50%, -50%)",background:`radial-gradient(circle, hsl(var(--primary) / ${i.opacity*.6}) 0%, hsl(var(--accent) / ${i.opacity*.3}) 50%, transparent 100%)`,filter:"blur(2px)"},initial:{opacity:i.opacity,scale:i.scale},animate:{opacity:0,scale:.2},transition:{duration:de/1e3,ease:"easeOut"}}));ge.displayName="TrailParticleComponent";const Ye=(i,g)=>{const f=Math.abs(i.x-g.x),c=Math.abs(i.y-g.y);return f>d*1.5||c>d*1.5},fe=a.memo(({snake:i,direction:g,interpolation:f=0})=>{const c=a.useMemo(()=>i.map((s,n)=>{let u=s.x*d+d/2,p=s.y*d+d/2;if(n===0&&f>0){const b=d*f;switch(g){case"up":p-=b;break;case"down":p+=b;break;case"left":u-=b;break;case"right":u+=b;break}}return{x:u,y:p}}),[i,g,f]),j=a.useMemo(()=>{if(c.length<2)return[c];const s=[];let n=[c[0]];for(let u=1;u<c.length;u++){const p=c[u-1],b=c[u];Ye(p,b)?(n.length>0&&s.push(n),n=[b]):n.push(b)}return n.length>0&&s.push(n),s},[c]),P=s=>{if(s.length<2)return"";let n=`M ${s[0].x} ${s[0].y}`;for(let p=1;p<s.length;p++){const b=s[p-1],$=s[p],X=(b.x+$.x)/2,C=(b.y+$.y)/2;p===1?n+=` Q ${b.x} ${b.y} ${X} ${C}`:n+=` T ${X} ${C}`}const u=s[s.length-1];return n+=` L ${u.x} ${u.y}`,n},h=a.useMemo(()=>{const s=d/4;switch(g){case"up":return{left:{x:-s,y:-s/2},right:{x:s,y:-s/2}};case"down":return{left:{x:-s,y:s/2},right:{x:s,y:s/2}};case"left":return{left:{x:-s/2,y:-s},right:{x:-s/2,y:s}};case"right":return{left:{x:s/2,y:-s},right:{x:s/2,y:s}}}},[g]),D=v*d;return e.jsxs("svg",{className:"absolute inset-0 pointer-events-none",width:D,height:D,style:{overflow:"visible"},children:[e.jsxs("defs",{children:[e.jsxs("linearGradient",{id:"serpentBodyGradient",x1:"0%",y1:"0%",x2:"100%",y2:"0%",children:[e.jsx("stop",{offset:"0%",stopColor:"hsl(var(--primary))"}),e.jsx("stop",{offset:"50%",stopColor:"hsl(var(--accent))"}),e.jsx("stop",{offset:"100%",stopColor:"hsl(var(--primary))",stopOpacity:"0.3"})]}),e.jsxs("radialGradient",{id:"serpentHeadGradient",children:[e.jsx("stop",{offset:"0%",stopColor:"hsl(var(--primary))"}),e.jsx("stop",{offset:"70%",stopColor:"hsl(var(--accent))"}),e.jsx("stop",{offset:"100%",stopColor:"hsl(var(--primary))"})]}),e.jsxs("filter",{id:"serpentGlow",x:"-50%",y:"-50%",width:"200%",height:"200%",children:[e.jsx("feGaussianBlur",{stdDeviation:"3",result:"coloredBlur"}),e.jsxs("feMerge",{children:[e.jsx("feMergeNode",{in:"coloredBlur"}),e.jsx("feMergeNode",{in:"SourceGraphic"})]})]})]}),j.map((s,n)=>{if(s.length<2)return e.jsx("circle",{cx:s[0].x,cy:s[0].y,r:(d-6)/2,fill:"url(#serpentBodyGradient)",filter:"url(#serpentGlow)"},`seg-${n}`);const u=P(s);return e.jsxs("g",{children:[e.jsx("path",{d:u,stroke:"hsl(var(--primary) / 0.4)",strokeWidth:d+4,strokeLinecap:"round",strokeLinejoin:"round",fill:"none",filter:"url(#serpentGlow)"}),e.jsx("path",{d:u,stroke:"url(#serpentBodyGradient)",strokeWidth:d-6,strokeLinecap:"round",strokeLinejoin:"round",fill:"none"}),e.jsx("path",{d:u,stroke:"hsl(var(--primary-foreground) / 0.15)",strokeWidth:d-10,strokeLinecap:"round",strokeLinejoin:"round",strokeDasharray:"4 8",fill:"none"})]},`seg-${n}`)}),e.jsx(S.circle,{cx:c[0]?.x||0,cy:c[0]?.y||0,r:d/2+2,fill:"url(#serpentHeadGradient)",filter:"url(#serpentGlow)",animate:{scale:[1,1.05,1]},transition:{duration:.5,repeat:1/0}}),e.jsx("circle",{cx:(c[0]?.x||0)+h.left.x,cy:(c[0]?.y||0)+h.left.y,r:4,fill:"hsl(var(--background))"}),e.jsx("circle",{cx:(c[0]?.x||0)+h.left.x+1,cy:(c[0]?.y||0)+h.left.y,r:2,fill:"hsl(var(--foreground))"}),e.jsx("circle",{cx:(c[0]?.x||0)+h.right.x,cy:(c[0]?.y||0)+h.right.y,r:4,fill:"hsl(var(--background))"}),e.jsx("circle",{cx:(c[0]?.x||0)+h.right.x+1,cy:(c[0]?.y||0)+h.right.y,r:2,fill:"hsl(var(--foreground))"})]})});fe.displayName="ContinuousSerpent";const be=a.memo(({position:i})=>e.jsx(S.div,{className:"absolute",style:{left:i.x*d,top:i.y*d,width:d,height:d},children:e.jsxs(S.div,{className:"relative w-full h-full flex items-center justify-center",animate:{rotate:360,scale:[.9,1.3,.9]},transition:{rotate:{duration:3,repeat:1/0,ease:"linear"},scale:{duration:1,repeat:1/0}},children:[e.jsx("div",{className:"w-[90%] h-[90%] rounded-full",style:{background:"linear-gradient(135deg, #fbbf24, #f59e0b)",boxShadow:"0 0 15px #fbbf24, 0 0 25px #fbbf24, 0 0 35px #fbbf24"}}),e.jsx("span",{className:"absolute text-sm",children:"✨"})]})}));be.displayName="Stardust";const Ue=({companionStats:i,onComplete:g,onDamage:f,tierAttackDamage:c=15,difficulty:j="medium",questIntervalScale:P=0,maxTimer:h,isPractice:D=!1,compact:s=!1})=>{const[n,u]=a.useState("countdown"),[p,b]=a.useState([{x:5,y:5}]),[$,X]=a.useState("right"),[C,xe]=a.useState({x:7,y:5}),[T,B]=a.useState(0),[O,me]=a.useState(0),[he,U]=a.useState(!1),[ye,W]=a.useState(!1),[we,q]=a.useState([]),[Z,V]=a.useState(null),[_,ke]=a.useState(!0),[ve,Q]=a.useState(0),z=a.useRef(null),K=a.useRef("right"),J=a.useRef("right"),M=a.useRef([]),Y=a.useRef(null),Se=a.useRef(0),L=a.useRef(null),E=a.useRef(null),A=a.useRef(null),k=a.useMemo(()=>Xe(),[]),je=Re[j].baseSpeed*(1-P*.1),F=Math.max(120,je),ee=a.useCallback((t,r)=>{const o={id:`trail-${Se.current++}`,x:t.x,y:t.y,opacity:Math.min(.8,.4+r*.05),scale:Math.min(1.2,.6+r*.05),createdAt:Date.now()};q(l=>{const y=[...l,o];return y.length>ne?y.slice(-ne):y})},[]);a.useEffect(()=>(z.current=setInterval(()=>{const t=Date.now();q(r=>r.filter(o=>t-o.createdAt<de))},100),()=>{z.current&&clearInterval(z.current)}),[]);const te=a.useCallback(t=>{let r;do r={x:Math.floor(Math.random()*v),y:Math.floor(Math.random()*v)};while(t.some(o=>o.x===r.x&&o.y===r.y));return r},[]),re=a.useCallback(t=>{const o={beginner:{fail:2,good:4,perfect:7},easy:{fail:3,good:6,perfect:10},medium:{fail:4,good:8,perfect:12},hard:{fail:5,good:10,perfect:15},master:{fail:6,good:12,perfect:18}}[j];return t<o.fail?{accuracy:Math.round(t/o.fail*40),result:"fail"}:t<o.good?{accuracy:50+Math.round((t-o.fail)/(o.good-o.fail)*30),result:"good"}:t<o.perfect?{accuracy:80+Math.round((t-o.good)/(o.perfect-o.good)*10),result:"good"}:{accuracy:Math.min(100,90+Math.round((t-o.perfect)*.5)),result:"perfect"}},[j]),ae=a.useCallback(()=>{if(n==="playing"){if(M.current.length>0){const t=M.current.shift();K.current=t,J.current=t,X(t)}b(t=>{const r=t[0],o=K.current;ee(r,t.length);let l;switch(o){case"up":l={x:r.x,y:r.y-1};break;case"down":l={x:r.x,y:r.y+1};break;case"left":l={x:r.x-1,y:r.y};break;case"right":l={x:r.x+1,y:r.y};break;default:l={x:r.x+1,y:r.y}}if(l.x<0&&(l.x=v-1),l.x>=v&&(l.x=0),l.y<0&&(l.y=v-1),l.y>=v&&(l.y=0),t.slice(0,-1).some(m=>m.x===l.x&&m.y===l.y)){u("complete"),H("error"),U(!0),setTimeout(()=>U(!1),300),f?.({target:"player",amount:c,source:"collision"});const{accuracy:m,result:N}=re(T);return g({success:N!=="fail",accuracy:m,result:N,highScoreValue:T,gameStats:{score:T}}),t}const w=[l,...t];if(l.x===C.x&&l.y===C.y){const m=T+1;return m>0&&m%5===0&&f?.({target:"adversary",amount:Ae.soul_serpent.scoreMilestone,source:"score_milestone"}),D&&m>=5?(B(m),u("complete"),g({success:!0,accuracy:80,result:"good",highScoreValue:m,gameStats:{score:m}}),w):(B(N=>{const I=N+1;return I>O&&me(I),I}),xe(te(w)),W(!0),H("medium"),setTimeout(()=>W(!1),300),w)}return w.pop(),w}),Q(0)}},[n,C,T,O,te,g,ee,re,f,D]);a.useEffect(()=>{if(n!=="playing")return;let t=performance.now(),r=0;const o=l=>{const y=l-t;t=l,r+=y;const w=Math.min(1,r/F);Q(w),r>=F&&(ae(),r=0),A.current=requestAnimationFrame(o)};return A.current=requestAnimationFrame(o),()=>{A.current&&cancelAnimationFrame(A.current)}},[n,ae,F]);const x=a.useCallback(t=>{const r={up:"down",down:"up",left:"right",right:"left"},o=M.current.length>0?M.current[M.current.length-1]:J.current;r[t]!==o&&t!==o&&(M.current.length<2&&M.current.push(t),H("light"),V(t),E.current&&clearTimeout(E.current),E.current=setTimeout(()=>{V(null)},200),_&&ke(!1))},[_]);a.useEffect(()=>{const t=r=>{if(n==="playing")switch(r.key){case"ArrowUp":case"w":case"W":r.preventDefault(),x("up");break;case"ArrowDown":case"s":case"S":r.preventDefault(),x("down");break;case"ArrowLeft":case"a":case"A":r.preventDefault(),x("left");break;case"ArrowRight":case"d":case"D":r.preventDefault(),x("right");break}};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[n,x]);const Ce=a.useCallback(t=>{if(n!=="playing")return;const r=t.touches[0];L.current={x:r.clientX,y:r.clientY}},[n]),Me=a.useCallback(t=>{if(n!=="playing"||!Y.current||!L.current)return;const r=t.changedTouches[0],o=r.clientX-L.current.x,l=r.clientY-L.current.y;Math.sqrt(o*o+l*l)>=$e&&(Math.abs(o)>Math.abs(l)?x(o>0?"right":"left"):x(l>0?"down":"up")),L.current=null},[n,x]),Ne=a.useCallback(t=>{if(n!=="playing"||!Y.current)return;const r=Y.current.getBoundingClientRect(),o=t.clientX-r.left,l=t.clientY-r.top,y=p[0],w=y.x*k+k/2,m=y.y*k+k/2,N=o-w,I=l-m;Math.abs(N)>Math.abs(I)?x(N>0?"right":"left"):x(I>0?"down":"up")},[n,p,x,k]),Te=a.useCallback(()=>{u("playing")},[]);a.useEffect(()=>()=>{E.current&&clearTimeout(E.current),A.current&&cancelAnimationFrame(A.current)},[]);const se=v*k;return e.jsx(Ee,{children:e.jsxs("div",{className:`flex flex-col items-center relative ${he?"animate-shake":""}`,children:[n==="countdown"&&e.jsx(Ie,{count:3,onComplete:Te}),e.jsx(R,{children:n==="paused"&&e.jsx(Pe,{onResume:()=>u("playing")})}),e.jsx(De,{title:"Soul Serpent",subtitle:"Survive as long as possible!",score:T,showCombo:!0,combo:p.length-1,primaryStat:{value:p.length,label:"Length",color:"hsl(var(--primary))"},isPaused:n==="paused",onPauseToggle:()=>u(n==="paused"?"playing":"paused"),compact:s}),e.jsxs(S.div,{ref:Y,className:"relative rounded-xl overflow-hidden cursor-pointer select-none touch-none",style:{width:se,height:se,background:"linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.5) 100%)",border:"2px solid hsl(var(--border) / 0.5)",boxShadow:"0 0 30px hsl(var(--primary) / 0.1), inset 0 0 50px hsl(var(--background) / 0.5)"},onClick:Ne,onTouchStart:Ce,onTouchEnd:Me,whileTap:{scale:.99},children:[e.jsx(R,{children:e.jsx(ue,{direction:Z,visible:Z!==null})}),e.jsx(pe,{show:_&&n==="playing"}),e.jsx("div",{className:"absolute inset-0 opacity-30",style:{background:`
                radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.3) 0%, transparent 40%),
                radial-gradient(circle at 80% 70%, hsl(var(--accent) / 0.3) 0%, transparent 40%)
              `}}),e.jsx("div",{className:"absolute inset-0 opacity-15",style:{backgroundImage:`
                linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px)
              `,backgroundSize:`${k}px ${k}px`}}),e.jsx(R,{children:we.map(t=>e.jsx(ge,{particle:t},t.id))}),e.jsx(be,{position:C}),e.jsx(fe,{snake:p,direction:$,interpolation:ve}),e.jsx(R,{children:ye&&e.jsx(S.div,{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-10",initial:{opacity:0,scale:.5},animate:{opacity:1,scale:1},exit:{opacity:0,scale:1.5},transition:{duration:.3},children:e.jsx("span",{className:"text-4xl",children:"✨"})})})]}),e.jsxs("div",{className:"relative mt-2",style:{width:140,height:140},children:[e.jsx(G,{direction:"up",onPress:x,disabled:n!=="playing"}),e.jsx(G,{direction:"down",onPress:x,disabled:n!=="playing"}),e.jsx(G,{direction:"left",onPress:x,disabled:n!=="playing"}),e.jsx(G,{direction:"right",onPress:x,disabled:n!=="playing"}),e.jsx("div",{className:"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-muted/30 border border-border/30"})]}),e.jsx("p",{className:"mt-2 text-xs text-muted-foreground text-center",children:"Swipe or D-Pad • Walls wrap!"}),e.jsx("style",{children:`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
            20%, 40%, 60%, 80% { transform: translateX(3px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out; }
        `})]})})};export{Ue as SoulSerpentGame};
