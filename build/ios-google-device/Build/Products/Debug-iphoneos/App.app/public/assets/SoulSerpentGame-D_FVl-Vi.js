import{j as e,r as t,m as L,n as j,Z as pe,d9 as ge,em as fe,en as be}from"./vendor-B4Pf7lGT.js";import{cc as Le,cd as Ge,ce as $e,cf as Xe}from"./index-D1EFzdSg.js";import{t as Z}from"./gameUtils-YUxD0xee.js";import"./date-vendor-DNTU5tB5.js";import"./three-vendor-qI8GXUTd.js";const _e=`
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
`,Ye=({children:i})=>e.jsxs(e.Fragment,{children:[e.jsx("style",{children:_e}),i]}),ze={beginner:{baseSpeed:400},easy:{baseSpeed:320},medium:{baseSpeed:260},hard:{baseSpeed:200},master:{baseSpeed:160}},Fe={beginner:4,easy:5,medium:6,hard:7,master:8},S=10,He=28,d=He,xe=600,ue=30,Oe=30,Be=()=>{if(typeof window>"u")return 28;const i=window.innerHeight;return i<600?24:i<700?26:28},G=t.memo(({direction:i,onPress:b,disabled:x})=>{const T={up:be,down:fe,left:ge,right:pe}[i],I={up:"top-0 left-1/2 -translate-x-1/2",down:"bottom-0 left-1/2 -translate-x-1/2",left:"left-0 top-1/2 -translate-y-1/2",right:"right-0 top-1/2 -translate-y-1/2"};return e.jsx("button",{className:`absolute ${I[i]} w-12 h-12 rounded-lg 
        bg-primary/20 border border-primary/40 backdrop-blur-sm
        active:bg-primary/40 active:scale-95 transition-all
        flex items-center justify-center touch-manipulation
        ${x?"opacity-50":""}`,onTouchStart:y=>{y.preventDefault(),x||b(i)},onClick:()=>{x||b(i)},disabled:x,children:e.jsx(T,{className:"w-6 h-6 text-primary"})})});G.displayName="DPadButton";const me=t.memo(({direction:i,visible:b})=>{if(!b||!i)return null;const c={up:be,down:fe,left:ge,right:pe}[i];return e.jsx(j.div,{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-30",initial:{opacity:0,scale:1.5},animate:{opacity:.8,scale:1},exit:{opacity:0,scale:.5},transition:{duration:.2},children:e.jsx("div",{className:"p-4 rounded-full bg-primary/30 backdrop-blur-sm",children:e.jsx(c,{className:"w-12 h-12 text-primary"})})})});me.displayName="SwipeIndicator";const he=t.memo(({show:i})=>e.jsx(L,{children:i&&e.jsx(j.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},className:"absolute bottom-2 left-0 right-0 text-center z-20",children:e.jsx("div",{className:"inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30",children:e.jsx("span",{className:"text-xs text-primary",children:"👆 Swipe or use D-Pad below"})})})}));he.displayName="SwipeHint";const ye=t.memo(({particle:i})=>e.jsx(j.div,{className:"absolute rounded-full pointer-events-none",style:{left:i.x*d+d/2,top:i.y*d+d/2,width:(d-6)*i.scale,height:(d-6)*i.scale,transform:"translate(-50%, -50%)",background:`radial-gradient(circle, hsl(var(--primary) / ${i.opacity*.6}) 0%, hsl(var(--accent) / ${i.opacity*.3}) 50%, transparent 100%)`,filter:"blur(2px)"},initial:{opacity:i.opacity,scale:i.scale},animate:{opacity:0,scale:.2},transition:{duration:xe/1e3,ease:"easeOut"}}));ye.displayName="TrailParticleComponent";const We=(i,b)=>{const x=Math.abs(i.x-b.x),c=Math.abs(i.y-b.y);return x>d*1.5||c>d*1.5},we=t.memo(({snake:i,direction:b,interpolation:x=0})=>{const c=t.useMemo(()=>i.map((a,s)=>{let p=a.x*d+d/2,g=a.y*d+d/2;if(s===0&&x>0){const f=d*x;switch(b){case"up":g-=f;break;case"down":g+=f;break;case"left":p-=f;break;case"right":p+=f;break}}return{x:p,y:g}}),[i,b,x]),T=t.useMemo(()=>{if(c.length<2)return[c];const a=[];let s=[c[0]];for(let p=1;p<c.length;p++){const g=c[p-1],f=c[p];We(g,f)?(s.length>0&&a.push(s),s=[f]):s.push(f)}return s.length>0&&a.push(s),a},[c]),I=a=>{if(a.length<2)return"";let s=`M ${a[0].x} ${a[0].y}`;for(let g=1;g<a.length;g++){const f=a[g-1],X=a[g],R=(f.x+X.x)/2,C=(f.y+X.y)/2;g===1?s+=` Q ${f.x} ${f.y} ${R} ${C}`:s+=` T ${R} ${C}`}const p=a[a.length-1];return s+=` L ${p.x} ${p.y}`,s},y=t.useMemo(()=>{const a=d/4;switch(b){case"up":return{left:{x:-a,y:-a/2},right:{x:a,y:-a/2}};case"down":return{left:{x:-a,y:a/2},right:{x:a,y:a/2}};case"left":return{left:{x:-a/2,y:-a},right:{x:-a/2,y:a}};case"right":return{left:{x:a/2,y:-a},right:{x:a/2,y:a}}}},[b]),$=S*d;return e.jsxs("svg",{className:"absolute inset-0 pointer-events-none",width:$,height:$,style:{overflow:"visible"},children:[e.jsxs("defs",{children:[e.jsxs("linearGradient",{id:"serpentBodyGradient",x1:"0%",y1:"0%",x2:"100%",y2:"0%",children:[e.jsx("stop",{offset:"0%",stopColor:"hsl(var(--primary))"}),e.jsx("stop",{offset:"50%",stopColor:"hsl(var(--accent))"}),e.jsx("stop",{offset:"100%",stopColor:"hsl(var(--primary))",stopOpacity:"0.3"})]}),e.jsxs("radialGradient",{id:"serpentHeadGradient",children:[e.jsx("stop",{offset:"0%",stopColor:"hsl(var(--primary))"}),e.jsx("stop",{offset:"70%",stopColor:"hsl(var(--accent))"}),e.jsx("stop",{offset:"100%",stopColor:"hsl(var(--primary))"})]}),e.jsxs("filter",{id:"serpentGlow",x:"-50%",y:"-50%",width:"200%",height:"200%",children:[e.jsx("feGaussianBlur",{stdDeviation:"3",result:"coloredBlur"}),e.jsxs("feMerge",{children:[e.jsx("feMergeNode",{in:"coloredBlur"}),e.jsx("feMergeNode",{in:"SourceGraphic"})]})]})]}),T.map((a,s)=>{if(a.length<2)return e.jsx("circle",{cx:a[0].x,cy:a[0].y,r:(d-6)/2,fill:"url(#serpentBodyGradient)",filter:"url(#serpentGlow)"},`seg-${s}`);const p=I(a);return e.jsxs("g",{children:[e.jsx("path",{d:p,stroke:"hsl(var(--primary) / 0.4)",strokeWidth:d+4,strokeLinecap:"round",strokeLinejoin:"round",fill:"none",filter:"url(#serpentGlow)"}),e.jsx("path",{d:p,stroke:"url(#serpentBodyGradient)",strokeWidth:d-6,strokeLinecap:"round",strokeLinejoin:"round",fill:"none"}),e.jsx("path",{d:p,stroke:"hsl(var(--primary-foreground) / 0.15)",strokeWidth:d-10,strokeLinecap:"round",strokeLinejoin:"round",strokeDasharray:"4 8",fill:"none"})]},`seg-${s}`)}),e.jsx(j.circle,{cx:c[0]?.x||0,cy:c[0]?.y||0,r:d/2+2,fill:"url(#serpentHeadGradient)",filter:"url(#serpentGlow)",animate:{scale:[1,1.05,1]},transition:{duration:.5,repeat:1/0}}),e.jsx("circle",{cx:(c[0]?.x||0)+y.left.x,cy:(c[0]?.y||0)+y.left.y,r:4,fill:"hsl(var(--background))"}),e.jsx("circle",{cx:(c[0]?.x||0)+y.left.x+1,cy:(c[0]?.y||0)+y.left.y,r:2,fill:"hsl(var(--foreground))"}),e.jsx("circle",{cx:(c[0]?.x||0)+y.right.x,cy:(c[0]?.y||0)+y.right.y,r:4,fill:"hsl(var(--background))"}),e.jsx("circle",{cx:(c[0]?.x||0)+y.right.x+1,cy:(c[0]?.y||0)+y.right.y,r:2,fill:"hsl(var(--foreground))"})]})});we.displayName="ContinuousSerpent";const ke=t.memo(({position:i})=>e.jsx(j.div,{className:"absolute",style:{left:i.x*d,top:i.y*d,width:d,height:d},children:e.jsxs(j.div,{className:"relative w-full h-full flex items-center justify-center",animate:{rotate:360,scale:[.9,1.3,.9]},transition:{rotate:{duration:3,repeat:1/0,ease:"linear"},scale:{duration:1,repeat:1/0}},children:[e.jsx("div",{className:"w-[90%] h-[90%] rounded-full",style:{background:"linear-gradient(135deg, #fbbf24, #f59e0b)",boxShadow:"0 0 15px #fbbf24, 0 0 25px #fbbf24, 0 0 35px #fbbf24"}}),e.jsx("span",{className:"absolute text-sm",children:"✨"})]})}));ke.displayName="Stardust";const Je=({companionStats:i,onComplete:b,onDamage:x,tierAttackDamage:c=15,difficulty:T="medium",questIntervalScale:I=0,maxTimer:y,isPractice:$=!1,compact:a=!1})=>{const[s,p]=t.useState("countdown"),[g,f]=t.useState([{x:5,y:5}]),[X,R]=t.useState("right"),[C,q]=t.useState({x:7,y:5}),[z,Q]=t.useState(0),[V,ve]=t.useState(0),[Se,K]=t.useState(!1),[je,J]=t.useState(!1),[Ce,ee]=t.useState([]),[te,re]=t.useState(null),[F,Te]=t.useState(!0),[Ne,_]=t.useState(0),[ae,Me]=t.useState(0),N=t.useRef(g),H=t.useRef(null),O=t.useRef("right"),B=t.useRef("right"),k=t.useRef([]),Y=t.useRef(null),Ae=t.useRef(0),P=t.useRef(null),E=t.useRef(null),M=t.useRef(null),se=t.useRef(!1),ne=t.useCallback(n=>{se.current||(se.current=!0,b(n))},[b]);t.useEffect(()=>{N.current=g},[g]);const v=t.useMemo(()=>Be(),[]),Ie=ze[T].baseSpeed*(1-I*.1),W=Math.max(120,Ie),ie=$?5:Fe[T],oe=t.useCallback((n,r)=>{const l={id:`trail-${Ae.current++}`,x:n.x,y:n.y,opacity:Math.min(.8,.4+r*.05),scale:Math.min(1.2,.6+r*.05),createdAt:Date.now()};ee(o=>{const w=[...o,l];return w.length>ue?w.slice(-ue):w})},[]);t.useEffect(()=>(H.current=setInterval(()=>{const n=Date.now();ee(r=>r.filter(l=>n-l.createdAt<xe))},100),()=>{H.current&&clearInterval(H.current)}),[]);const U=t.useCallback(n=>{let r;do r={x:Math.floor(Math.random()*S),y:Math.floor(Math.random()*S)};while(n.some(l=>l.x===r.x&&l.y===r.y));return r},[]),ce=t.useCallback((n,r)=>{const l=Math.max(0,Math.min(100,Math.round(55+n*6-r*15))),o=l>=90?"perfect":l>=50?"good":"fail";return{accuracy:l,result:o}},[]),le=t.useCallback(()=>{if(s!=="playing")return;if(k.current.length>0){const u=k.current.shift();O.current=u,B.current=u,R(u)}const n=N.current;if(n.length===0)return;const r=n[0],l=O.current;oe(r,n.length);let o;switch(l){case"up":o={x:r.x,y:r.y-1};break;case"down":o={x:r.x,y:r.y+1};break;case"left":o={x:r.x-1,y:r.y};break;case"right":o={x:r.x+1,y:r.y};break;default:o={x:r.x+1,y:r.y}}if(o.x<0&&(o.x=S-1),o.x>=S&&(o.x=0),o.y<0&&(o.y=S-1),o.y>=S&&(o.y=0),n.slice(0,-1).some(u=>u.x===o.x&&u.y===o.y)){Z("error"),K(!0),setTimeout(()=>K(!1),300),x?.({target:"player",amount:c,source:"collision"}),Me(A=>A+1);const u=[{x:5,y:5}];f(u),N.current=u,R("right"),O.current="right",B.current="right",k.current=[],q(U(u)),_(0);return}const h=[o,...n];if(o.x===C.x&&o.y===C.y){const u=z+1;if(u>0&&u%5===0&&x?.({target:"adversary",amount:Le.soul_serpent.scoreMilestone,source:"score_milestone"}),u>=ie){Q(u);const{accuracy:A,result:D}=ce(u,ae);p("complete"),ne({success:D!=="fail",accuracy:A,result:D,highScoreValue:u,gameStats:{score:u}}),f(h),N.current=h;return}Q(u),u>V&&ve(u),q(U(h)),J(!0),Z("medium"),setTimeout(()=>J(!1),300),f(h),N.current=h,_(0);return}h.pop(),f(h),N.current=h,_(0)},[oe,ce,ne,s,V,x,z,ae,ie,U,C,c]);t.useEffect(()=>{if(s!=="playing")return;let n=performance.now(),r=0;const l=o=>{const w=o-n;n=o,r+=w;const h=Math.min(1,r/W);_(h),r>=W&&(le(),r=0),M.current=requestAnimationFrame(l)};return M.current=requestAnimationFrame(l),()=>{M.current&&cancelAnimationFrame(M.current)}},[s,le,W]);const m=t.useCallback(n=>{const r={up:"down",down:"up",left:"right",right:"left"},l=k.current.length>0?k.current[k.current.length-1]:B.current;r[n]!==l&&n!==l&&(k.current.length<2&&k.current.push(n),Z("light"),re(n),E.current&&clearTimeout(E.current),E.current=setTimeout(()=>{re(null)},200),F&&Te(!1))},[F]);t.useEffect(()=>{const n=r=>{if(s==="playing")switch(r.key){case"ArrowUp":case"w":case"W":r.preventDefault(),m("up");break;case"ArrowDown":case"s":case"S":r.preventDefault(),m("down");break;case"ArrowLeft":case"a":case"A":r.preventDefault(),m("left");break;case"ArrowRight":case"d":case"D":r.preventDefault(),m("right");break}};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[s,m]);const Re=t.useCallback(n=>{if(s!=="playing")return;const r=n.touches[0];P.current={x:r.clientX,y:r.clientY}},[s]),Pe=t.useCallback(n=>{if(s!=="playing"||!Y.current||!P.current)return;const r=n.changedTouches[0],l=r.clientX-P.current.x,o=r.clientY-P.current.y;Math.sqrt(l*l+o*o)>=Oe&&(Math.abs(l)>Math.abs(o)?m(l>0?"right":"left"):m(o>0?"down":"up")),P.current=null},[s,m]),Ee=t.useCallback(n=>{if(s!=="playing"||!Y.current)return;const r=Y.current.getBoundingClientRect(),l=n.clientX-r.left,o=n.clientY-r.top,w=g[0],h=w.x*v+v/2,u=w.y*v+v/2,A=l-h,D=o-u;Math.abs(A)>Math.abs(D)?m(A>0?"right":"left"):m(D>0?"down":"up")},[s,g,m,v]),De=t.useCallback(()=>{p("playing")},[]);t.useEffect(()=>()=>{E.current&&clearTimeout(E.current),M.current&&cancelAnimationFrame(M.current)},[]);const de=S*v;return e.jsx(Ye,{children:e.jsxs("div",{className:`flex flex-col items-center relative ${Se?"animate-shake":""}`,children:[s==="countdown"&&e.jsx(Ge,{count:3,onComplete:De}),e.jsx(L,{children:s==="paused"&&e.jsx($e,{onResume:()=>p("playing")})}),e.jsx(Xe,{title:"Soul Serpent",subtitle:"Survive as long as possible!",score:z,showCombo:!0,combo:g.length-1,primaryStat:{value:g.length,label:"Length",color:"hsl(var(--primary))"},isPaused:s==="paused",onPauseToggle:()=>p(s==="paused"?"playing":"paused"),compact:a}),e.jsxs(j.div,{ref:Y,className:"relative rounded-xl overflow-hidden cursor-pointer select-none touch-none",style:{width:de,height:de,background:"linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.5) 100%)",border:"2px solid hsl(var(--border) / 0.5)",boxShadow:"0 0 30px hsl(var(--primary) / 0.1), inset 0 0 50px hsl(var(--background) / 0.5)"},onClick:Ee,onTouchStart:Re,onTouchEnd:Pe,whileTap:{scale:.99},children:[e.jsx(L,{children:e.jsx(me,{direction:te,visible:te!==null})}),e.jsx(he,{show:F&&s==="playing"}),e.jsx("div",{className:"absolute inset-0 opacity-30",style:{background:`
                radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.3) 0%, transparent 40%),
                radial-gradient(circle at 80% 70%, hsl(var(--accent) / 0.3) 0%, transparent 40%)
              `}}),e.jsx("div",{className:"absolute inset-0 opacity-15",style:{backgroundImage:`
                linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px)
              `,backgroundSize:`${v}px ${v}px`}}),e.jsx(L,{children:Ce.map(n=>e.jsx(ye,{particle:n},n.id))}),e.jsx(ke,{position:C}),e.jsx(we,{snake:g,direction:X,interpolation:Ne}),e.jsx(L,{children:je&&e.jsx(j.div,{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-10",initial:{opacity:0,scale:.5},animate:{opacity:1,scale:1},exit:{opacity:0,scale:1.5},transition:{duration:.3},children:e.jsx("span",{className:"text-4xl",children:"✨"})})})]}),e.jsxs("div",{className:"relative mt-2",style:{width:140,height:140},children:[e.jsx(G,{direction:"up",onPress:m,disabled:s!=="playing"}),e.jsx(G,{direction:"down",onPress:m,disabled:s!=="playing"}),e.jsx(G,{direction:"left",onPress:m,disabled:s!=="playing"}),e.jsx(G,{direction:"right",onPress:m,disabled:s!=="playing"}),e.jsx("div",{className:"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-muted/30 border border-border/30"})]}),e.jsx("p",{className:"mt-2 text-xs text-muted-foreground text-center",children:"Swipe or D-Pad • Walls wrap!"}),e.jsx("style",{children:`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
            20%, 40%, 60%, 80% { transform: translateX(3px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out; }
        `})]})})};export{Je as SoulSerpentGame};
