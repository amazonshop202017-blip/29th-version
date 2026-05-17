import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const TIMEZONE_CITIES = [
  { city:"Abu Dhabi",    value:"Asia/Dubai" },         { city:"Amsterdam",    value:"Europe/Amsterdam" },
  { city:"Athens",       value:"Europe/Athens" },       { city:"Auckland",     value:"Pacific/Auckland" },
  { city:"Bangkok",      value:"Asia/Bangkok" },         { city:"Beijing",      value:"Asia/Shanghai" },
  { city:"Brussels",     value:"Europe/Brussels" },     { city:"Buenos Aires", value:"America/Argentina/Buenos_Aires" },
  { city:"Cairo",        value:"Africa/Cairo" },         { city:"Chicago",      value:"America/Chicago" },
  { city:"Copenhagen",   value:"Europe/Copenhagen" },   { city:"Dubai",        value:"Asia/Dubai" },
  { city:"Dublin",       value:"Europe/Dublin" },        { city:"Frankfurt",    value:"Europe/Berlin" },
  { city:"Helsinki",     value:"Europe/Helsinki" },     { city:"Hong Kong",    value:"Asia/Hong_Kong" },
  { city:"Istanbul",     value:"Europe/Istanbul" },     { city:"Jakarta",      value:"Asia/Jakarta" },
  { city:"Johannesburg", value:"Africa/Johannesburg" }, { city:"Karachi",      value:"Asia/Karachi" },
  { city:"Kuala Lumpur", value:"Asia/Kuala_Lumpur" },  { city:"Kuwait",       value:"Asia/Kuwait" },
  { city:"Lisbon",       value:"Europe/Lisbon" },        { city:"London",       value:"Europe/London" },
  { city:"Los Angeles",  value:"America/Los_Angeles" }, { city:"Madrid",       value:"Europe/Madrid" },
  { city:"Mexico City",  value:"America/Mexico_City" }, { city:"Moscow",       value:"Europe/Moscow" },
  { city:"Mumbai",       value:"Asia/Kolkata" },         { city:"New York",     value:"America/New_York" },
  { city:"Oslo",         value:"Europe/Oslo" },          { city:"Paris",        value:"Europe/Paris" },
  { city:"Prague",       value:"Europe/Prague" },        { city:"Riyadh",       value:"Asia/Riyadh" },
  { city:"Rome",         value:"Europe/Rome" },          { city:"São Paulo",    value:"America/Sao_Paulo" },
  { city:"Seoul",        value:"Asia/Seoul" },           { city:"Singapore",    value:"Asia/Singapore" },
  { city:"Stockholm",    value:"Europe/Stockholm" },    { city:"Sydney",       value:"Australia/Sydney" },
  { city:"Taipei",       value:"Asia/Taipei" },          { city:"Tokyo",        value:"Asia/Tokyo" },
  { city:"Toronto",      value:"America/Toronto" },     { city:"UTC",          value:"UTC" },
  { city:"Vienna",       value:"Europe/Vienna" },        { city:"Warsaw",       value:"Europe/Warsaw" },
  { city:"Zurich",       value:"Europe/Zurich" },
];

const SESSIONS = [
  { name:"Sydney",   flag:"🇦🇺", tz:"Australia/Sydney",  color:"#3b9bd4", localOpen:7,  durationH:9 },
  { name:"Tokyo",    flag:"🇯🇵", tz:"Asia/Tokyo",         color:"#cc2e84", localOpen:9,  durationH:9 },
  { name:"London",   flag:"🇬🇧", tz:"Europe/London",      color:"#3b9bd4", localOpen:8,  durationH:9 },
  { name:"New York", flag:"🇺🇸", tz:"America/New_York",   color:"#5cb85c", localOpen:8,  durationH:9 },
] as const;

const H_RULER=72, H_SESSION=72, H_CHART=96;

function getUTCOffset(tz: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US",{
      timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false,
    }).formatToParts(date);
    const p = (t:string)=>parseInt(parts.find(x=>x.type===t)?.value??"0",10);
    const localAsUTC = Date.UTC(p("year"),p("month")-1,p("day"),p("hour")%24,p("minute"),p("second"));
    return Math.round((localAsUTC-date.getTime())/60_000)/60;
  } catch { return 0; }
}

function getTZAbbr(tz: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"short"})
      .formatToParts(date).find(p=>p.type==="timeZoneName")?.value??"";
  } catch { return ""; }
}

function fmtOffset(offset: number): string {
  const sign=offset>=0?"+":"-", abs=Math.abs(offset);
  const h=Math.floor(abs), m=Math.round((abs%1)*60);
  return m>0?`${sign}${h}:${String(m).padStart(2,"0")}`:`${sign}${h}`;
}

function wrapH(h: number): number { return ((h%24)+24)%24; }

function sessionSegments(openUTC: number, durationH: number, userOffset: number) {
  const localOpen=wrapH(openUTC+userOffset), localFrac=localOpen/24, durFrac=durationH/24;
  const closeFrac=localFrac+durFrac;
  if(closeFrac<=1) return [{left:localFrac*100, width:durFrac*100}];
  return [{left:localFrac*100, width:(1-localFrac)*100},{left:0, width:(closeFrac-1)*100}];
}

function isOpen(openUTC: number, durationH: number, utcH: number): boolean {
  const h=wrapH(utcH), closeUTC=wrapH(openUTC+durationH);
  return openUTC<closeUTC ? h>=openUTC&&h<closeUTC : h>=openUTC||h<closeUTC;
}

const DAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function cityDateInfo(utcH: number, cityOff: number, base: Date) {
  const localHour=wrapH(utcH+cityOff), totalH=utcH+cityOff;
  const dayOff=totalH<0?-1:totalH>=24?1:0;
  const d=new Date(base); d.setUTCDate(d.getUTCDate()+dayOff);
  const dn=d.getUTCDate();
  const sfx=dn>=11&&dn<=13?"th":dn%10===1?"st":dn%10===2?"nd":dn%10===3?"rd":"th";
  return { localHour, dayShort:DAY_SHORT[d.getUTCDay()], dayFull:DAY_NAMES[d.getUTCDay()],
           month:MONTH_SHORT[d.getUTCMonth()], dayNum:dn, suffix:sfx };
}

function fmt12(h: number): string {
  const hh=Math.floor(h)%24, mm=Math.round((h-Math.floor(h))*60);
  return `${hh%12===0?12:hh%12}:${String(mm).padStart(2,"0")} ${hh>=12?"pm":"am"}`;
}
function fmt24(h: number): string {
  const hh=Math.floor(h)%24, mm=Math.round((h-Math.floor(h))*60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

// Volume curve — defined in NY local time (EDT=UTC-4), mapped to UTC 0-23
const VOL_LDN=[
  0.16,0.16,0.17,0.17, // UTC 0-3  = NY 8-11pm  red stable
  0.18,0.26,0.34,0.65, // UTC 4-7  = NY 12am-3am rising red→yellow→green
  0.70,0.74,0.72,0.68, // UTC 8-11 = NY 4-7am   green plateau/dip
  0.76,0.83,0.88,0.93, // UTC 12-15= NY 8-11am  green steep rise
  0.90,0.78,0.65,0.54, // UTC 16-19= NY 12-3pm  green/yellow falling
  0.40,0.28,0.22,0.18, // UTC 20-23= NY 4-7pm   yellow/red falling
];

function volLevel(utcH: number): "low"|"medium"|"high" {
  const v=VOL_LDN[Math.floor(wrapH(utcH))];
  return v>=0.65?"high":v>=0.34?"medium":"low";
}

function volAtUTC(utcH: number): number {
  const h=((utcH%24)+24)%24;
  const lo=Math.floor(h)%24, hi=(lo+1)%24;
  const base=VOL_LDN[lo]*(1-(h-lo))+VOL_LDN[hi]*(h-lo);
  // Tokyo open bump: peaks UTC 0:20, sigma=0.35h
  const dist=Math.min(Math.abs(h-0.33),24-Math.abs(h-0.33));
  return Math.min(1, base+0.16*Math.exp(-0.5*(dist/0.35)**2));
}

function buildPath(pts: number[], W: number, H: number): string {
  const base=H-4; let d="";
  pts.forEach((v,i)=>{
    const x=(i/(pts.length-1))*W, y=base-v*(base-8);
    if(i===0){d+=`M ${x} ${y}`;return;}
    const px=((i-1)/(pts.length-1))*W, py=base-pts[i-1]*(base-8), cx=(px+x)/2;
    d+=` C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  });
  return d;
}

function detectLocalTZ(): string {
  try {
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(TIMEZONE_CITIES.some(t=>t.value===tz)) return tz;
  } catch { /**/ }
  return "America/New_York";
}

export default function ForexClock() {
  const [selectedTZ, setSelectedTZ] = useState(detectLocalTZ);
  const [use24h, setUse24h]         = useState(false);
  const [utcHour, setUTCHour]       = useState(0);
  const [dragUTC, setDragUTC]       = useState<number|null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const barRef  = useRef<HTMLDivElement>(null);
  const snapRef = useRef<number>(0);
  const nowRef  = useRef(new Date());

  useEffect(()=>{
    const tick=()=>{
      nowRef.current=new Date();
      const n=nowRef.current;
      setUTCHour(n.getUTCHours()+n.getUTCMinutes()/60+n.getUTCSeconds()/3600);
    };
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);

  const activeUTC   = dragUTC!==null?dragUTC:utcHour;
  const userOffset  = getUTCOffset(selectedTZ,nowRef.current);
  const localHour   = wrapH(activeUTC+userOffset);
  const linePercent = (localHour/24)*100;

  const tzLabels = useMemo(() => {
    const labels = TIMEZONE_CITIES.map(tz => {
      const offset = getUTCOffset(tz.value, nowRef.current);
      return {
        ...tz,
        offset,
        label: `${tz.city} (GMT ${fmtOffset(offset)})`,
      };
    });
    return labels.sort((a, b) => {
      if (a.offset !== b.offset) return a.offset - b.offset;
      return a.city.localeCompare(b.city);
    });
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [Math.floor(utcHour / 60)]);

  const selectedLabel = tzLabels.find(t=>t.value===selectedTZ)?.label??selectedTZ;

  const xToUTC = useCallback((cx:number):number=>{
    if(!barRef.current) return activeUTC;
    const rect=barRef.current.getBoundingClientRect();
    const frac=Math.max(0,Math.min((cx-rect.left)/rect.width,1));
    return wrapH(frac*24-userOffset);
  },[userOffset,activeUTC]);

  const startDrag = useCallback((cx:number)=>{
    if(snapRef.current) cancelAnimationFrame(snapRef.current);
    setIsDragging(true); setDragUTC(xToUTC(cx));
  },[xToUTC]);

  const moveDrag = useCallback((cx:number)=>{ setDragUTC(xToUTC(cx)); },[xToUTC]);

  const endDrag = useCallback(()=>{
    setIsDragging(false);
    const from=dragUTC??utcHour, to=utcHour, t0=performance.now();
    const snap=(t:number)=>{
      const p=Math.min((t-t0)/700,1), e=1-Math.pow(1-p,3);
      setDragUTC(p<1?from+(to-from)*e:null);
      if(p<1) snapRef.current=requestAnimationFrame(snap);
    };
    snapRef.current=requestAnimationFrame(snap);
  },[dragUTC,utcHour]);

  useEffect(()=>{
    const mm=(e:MouseEvent)=>{ if(isDragging) moveDrag(e.clientX); };
    const mu=()=>{ if(isDragging) endDrag(); };
    const tm=(e:TouchEvent)=>{ if(isDragging){e.preventDefault();moveDrag(e.touches[0].clientX);} };
    const te=()=>{ if(isDragging) endDrag(); };
    window.addEventListener("mousemove",mm);
    window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",tm,{passive:false});
    window.addEventListener("touchend",te);
    return ()=>{
      window.removeEventListener("mousemove",mm); window.removeEventListener("mouseup",mu);
      window.removeEventListener("touchmove",tm); window.removeEventListener("touchend",te);
    };
  },[isDragging,moveDrag,endDrag]);

  const vLevel = volLevel(activeUTC);
  const vColor = vLevel==="high"?"#5cb85c":vLevel==="medium"?"#f0ad4e":"#d9534f";
  const CW=600, CH=72;
  const chartX = linePercent/100*CW;

  const localVolData = useMemo(()=>
    Array.from({length:49},(_,i)=>volAtUTC(i*0.5-userOffset)),
  [userOffset]);

  const bubbleInfo = cityDateInfo(activeUTC,userOffset,nowRef.current);
  const bubbleTime = use24h?fmt24(bubbleInfo.localHour):fmt12(bubbleInfo.localHour);

  return (
    <div onClick={()=>showDropdown&&setShowDropdown(false)}
      style={{minHeight:"100vh",background:"#f0f0f0",display:"flex",alignItems:"flex-start",
              justifyContent:"center",padding:"24px 16px",
              fontFamily:"'Open Sans','Helvetica Neue',Arial,sans-serif"}}>
      <div style={{width:"100%",maxWidth:"820px",background:"white",
                   borderRadius:"8px",boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>

        {/* Purple top bar */}
        <div style={{height:"6px",background:"#7b2fbe",borderRadius:"8px 8px 0 0"}}/>

        {/* Header */}
        <div style={{padding:"20px 24px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <h1 style={{fontSize:"26px",fontWeight:700,color:"#222",margin:0,lineHeight:1.2}}>
              Forex Market Time Zone Converter
            </h1>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px"}}>
              <span style={{fontSize:"13px",color:"#555",fontWeight:600}}>24 Hour Time</span>
              <div onClick={()=>setUse24h(v=>!v)}
                style={{width:"44px",height:"24px",borderRadius:"12px",
                        background:use24h?"#7b2fbe":"#ccc",position:"relative",
                        cursor:"pointer",transition:"background 0.2s"}}>
                <div style={{width:"18px",height:"18px",borderRadius:"50%",background:"white",
                             position:"absolute",top:"3px",left:use24h?"23px":"3px",
                             transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div style={{display:"flex",padding:"0 24px 0",marginTop:"90px"}}>

          {/* Left column */}
          <div style={{width:"210px",flexShrink:0}}>

            {/* TZ dropdown */}
            <div style={{height:`${H_RULER}px`,display:"flex",flexDirection:"column",
                         justifyContent:"flex-end",paddingBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",
                           alignItems:"center",marginBottom:"4px"}}>
                <span style={{fontSize:"11px",fontWeight:700,color:"#888",
                              textTransform:"uppercase",letterSpacing:"0.5px"}}>Timezone</span>
                <button onClick={e=>{e.stopPropagation();setSelectedTZ(detectLocalTZ());}}
                  style={{fontSize:"11px",color:"#7b2fbe",background:"none",
                          border:"none",cursor:"pointer",padding:0}}>(reset)</button>
              </div>
              <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>setShowDropdown(v=>!v)}
                  style={{width:"100%",background:"#7b2fbe",border:"none",borderRadius:"4px",
                          padding:"8px 12px",color:"white",fontSize:"13px",fontWeight:600,
                          cursor:"pointer",display:"flex",alignItems:"center",
                          justifyContent:"space-between",textAlign:"left"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                                flex:1,marginRight:"8px"}}>{selectedLabel}</span>
                  <span style={{fontSize:"10px",flexShrink:0}}>▼</span>
                </button>
                {showDropdown&&(
                  <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,width:"250px",
                               background:"white",border:"1px solid #ddd",borderRadius:"4px",
                               zIndex:1000,maxHeight:"260px",overflowY:"auto",
                               boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>
                    {tzLabels.map(tz=>(
                      <button key={tz.value+tz.city}
                        onClick={()=>{setSelectedTZ(tz.value);setShowDropdown(false);}}
                        style={{width:"100%",padding:"8px 12px",
                                background:selectedTZ===tz.value?"#f0e6ff":"transparent",
                                border:"none",borderBottom:"1px solid #f0f0f0",
                                color:selectedTZ===tz.value?"#7b2fbe":"#333",
                                fontSize:"13px",cursor:"pointer",textAlign:"left",display:"block"}}
                        onMouseEnter={e=>{if(selectedTZ!==tz.value)(e.currentTarget as HTMLElement).style.background="#f9f9f9";}}
                        onMouseLeave={e=>{if(selectedTZ!==tz.value)(e.currentTarget as HTMLElement).style.background="transparent";}}>
                        {tz.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* City info rows */}
            {SESSIONS.map((session,idx)=>{
              const cityOff  = getUTCOffset(session.tz,nowRef.current);
              const cityAbbr = getTZAbbr(session.tz,nowRef.current);
              const info     = cityDateInfo(activeUTC,cityOff,nowRef.current);
              const timeStr  = use24h?fmt24(info.localHour):fmt12(info.localHour);
              void isOpen(wrapH(session.localOpen-cityOff),session.durationH,activeUTC);
              return (
                <div key={session.name}
                  style={{height:`${H_SESSION}px`,display:"flex",alignItems:"center",gap:"12px",
                          borderTop:"1px solid #eee",background:idx%2===0?"white":"#fafafa",
                          paddingRight:"12px"}}>
                  <div style={{width:"40px",height:"40px",borderRadius:"50%",flexShrink:0,
                               border:"2px solid #e0e0e0",display:"flex",alignItems:"center",
                               justifyContent:"center",fontSize:"24px",lineHeight:1,
                               background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.12)",
                               overflow:"hidden"}}>{session.flag}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"15px",color:"#222",lineHeight:1.2}}>
                      {session.name}</div>
                    <div style={{fontSize:"13px",color:"#444",fontWeight:600}}>{timeStr}</div>
                    <div style={{fontSize:"10px",color:"#888",whiteSpace:"nowrap",
                                 overflow:"hidden",textOverflow:"ellipsis"}}>
                      {info.dayShort} {info.month}. {info.dayNum}{info.suffix} {cityAbbr} (UTC {fmtOffset(cityOff)})
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Volume label */}
            <div style={{height:`${H_CHART}px`,borderTop:"1px solid #eee",background:"#fafafa",
                         display:"flex",flexDirection:"column",justifyContent:"center",
                         paddingRight:"12px",borderRadius:"0 0 0 8px"}}>
              <div style={{fontSize:"13px",color:"#444",lineHeight:1.4,marginBottom:"8px"}}>
                Trading Volume is usually <strong>{vLevel}</strong> at this time of day.
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"white",
                           border:"1px solid #ddd",borderRadius:"20px",padding:"4px 12px",
                           fontSize:"13px",fontWeight:600,color:"#333",alignSelf:"flex-start"}}>
                <div style={{width:"10px",height:"10px",borderRadius:"50%",
                             background:vColor,boxShadow:`0 0 4px ${vColor}`}}/>
                {vLevel.charAt(0).toUpperCase()+vLevel.slice(1)}
              </div>
            </div>
          </div>

          {/* Right track area */}
          <div style={{flex:1,position:"relative",marginLeft:"8px"}}>

            {/* Draggable bubble */}
            <div onMouseDown={e=>{e.preventDefault();startDrag(e.clientX);}}
              onTouchStart={e=>startDrag(e.touches[0].clientX)}
              style={{position:"absolute",top:`-${H_RULER+14}px`,left:`${linePercent}%`,
                      transform:"translateX(-50%)",zIndex:30,display:"flex",
                      flexDirection:"column",alignItems:"center",
                      cursor:isDragging?"grabbing":"grab",
                      filter:"drop-shadow(0 3px 8px rgba(123,47,190,0.35))",userSelect:"none"}}>
              <div style={{background:"#7b2fbe",borderRadius:"36px",display:"flex",
                           flexDirection:"column",alignItems:"center",
                           padding:"10px 14px 12px",minWidth:"88px"}}>
                <div style={{width:"42px",height:"42px",borderRadius:"50%",
                             background:"rgba(0,0,0,0.18)",display:"flex",
                             alignItems:"center",justifyContent:"center",
                             marginBottom:"6px",flexShrink:0}}>
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <circle cx="13" cy="13" r="11" stroke="white" strokeWidth="2"/>
                    <line x1="13" y1="13" x2="13" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="13" y1="13" x2="18" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{color:"white",fontWeight:700,fontSize:"15px",lineHeight:1.2,whiteSpace:"nowrap"}}>
                  {bubbleTime}</div>
                <div style={{color:"rgba(255,255,255,0.85)",fontSize:"11px",marginTop:"1px"}}>
                  {bubbleInfo.dayFull}</div>
              </div>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",
                           borderRight:"10px solid transparent",borderTop:"12px solid #7b2fbe"}}/>
            </div>

            {/* Continuous vertical line */}
            <div style={{position:"absolute",top:0,bottom:0,left:`${linePercent}%`,
                         transform:"translateX(-50%)",width:"2px",background:"#7b2fbe",
                         zIndex:10,pointerEvents:"none"}}/>

            {/* Ruler row */}
            <div style={{height:`${H_RULER}px`,display:"flex",flexDirection:"column",
                         justifyContent:"flex-end",paddingBottom:"4px"}}>
              {/* Sun / Moon icons */}
              <div style={{position:"relative",height:"18px",marginBottom:"2px"}}>
                <div style={{position:"absolute",left:"25%",transform:"translateX(-50%)"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="#e6b800" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="4"/>
                    <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
                    <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
                  </svg>
                </div>
                <div style={{position:"absolute",left:"95.8%",transform:"translateX(-50%)",
                             display:"flex",alignItems:"flex-end",gap:"1px"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#999">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
                  </svg>
                  <span style={{fontSize:"8px",color:"#999",lineHeight:1}}>z</span>
                  <span style={{fontSize:"6px",color:"#bbb",lineHeight:1}}>z</span>
                </div>
              </div>

              {/* Draggable ruler bar */}
              <div ref={barRef}
                onMouseDown={e=>{e.preventDefault();startDrag(e.clientX);}}
                onTouchStart={e=>startDrag(e.touches[0].clientX)}
                style={{position:"relative",height:"28px",
                        cursor:isDragging?"grabbing":"col-resize",userSelect:"none"}}>
                <div style={{position:"absolute",inset:0,display:"flex"}}>
                  <div style={{width:"50%",height:"100%",background:"#f8f8f8",borderRight:"1px solid #ddd"}}/>
                  <div style={{width:"50%",height:"100%",background:"#f0f0f0"}}/>
                </div>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center"}}>
                  <div style={{position:"absolute",left:"0%",transform:"translateX(-50%)",
                               fontSize:"12px",color:"#bbb",fontWeight:use24h?600:400}}>
                    {use24h?"0":"•"}
                  </div>
                  {Array.from({length:23},(_,i)=>i+1).map(h=>(
                    <div key={h} style={{position:"absolute",left:`${(h/24)*100}%`,
                                         transform:"translateX(-50%)",fontSize:"12px",color:"#aaa",
                                         fontWeight:use24h?(h===6||h===12||h===18?600:400):(h===12?600:400),
                                         whiteSpace:"nowrap"}}>
                      {use24h?h:h<=12?h:h-12}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Session bar tracks */}
            {SESSIONS.map((session,idx)=>{
              const cityOff    = getUTCOffset(session.tz,nowRef.current);
              const openUTC    = wrapH(session.localOpen-cityOff);
              const sessionOpen= isOpen(openUTC,session.durationH,activeUTC);
              const segs       = sessionSegments(openUTC,session.durationH,userOffset);
              const isNY       = session.name==="New York";
              const nyseOpenUTC= isNY?wrapH(9.5-cityOff):0;
              const nyseOpenPct= isNY?wrapH(nyseOpenUTC+userOffset)/24*100:0;
              return (
                <div key={session.name}
                  style={{height:`${H_SESSION}px`,borderTop:"1px solid #eee",
                          background:idx%2===0?"white":"#fafafa",
                          display:"flex",flexDirection:"column",justifyContent:"center",
                          padding:"0 4px"}}>
                  <div style={{fontSize:"10px",fontWeight:700,marginBottom:"4px",
                               color:sessionOpen?session.color:"#aaa",
                               textTransform:"uppercase",letterSpacing:"0.5px"}}>
                    {session.name} session {sessionOpen?"open":"closed"}
                  </div>
                  <div style={{position:"relative",height:"28px",background:"#eeeeee",
                               borderRadius:"3px",overflow:"visible"}}>
                    {Array.from({length:11},(_,i)=>(i+1)*2).map(h=>(
                      <div key={h} style={{position:"absolute",top:0,bottom:0,
                                           left:`${(h/24)*100}%`,width:"1px",
                                           background:"rgba(255,255,255,0.9)",zIndex:1}}/>
                    ))}
                    {segs.map((seg,si)=>(
                      <div key={si} style={{position:"absolute",top:"4px",bottom:"4px",
                                            left:`${seg.left}%`,width:`${Math.max(seg.width,0)}%`,
                                            background:session.color,borderRadius:"2px",zIndex:2,
                                            minWidth:seg.width>0.1?"2px":"0"}}/>
                    ))}
                    {isNY&&(
                      <div style={{position:"absolute",left:`${nyseOpenPct}%`,top:0,bottom:0,
                                   zIndex:5,pointerEvents:"none"}}>
                        <div style={{position:"absolute",top:"2px",bottom:"2px",left:0,
                                     width:"2px",background:"rgba(0,0,0,0.55)",borderRadius:"1px"}}/>
                        <div style={{position:"absolute",bottom:"calc(100% + 2px)",left:"4px",
                                     fontSize:"8px",fontWeight:700,color:"rgba(30,30,30,0.75)",
                                     whiteSpace:"nowrap",letterSpacing:"0.4px",
                                     textTransform:"uppercase",lineHeight:1}}>NYSE OPEN</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Volume chart */}
            <div style={{height:`${H_CHART}px`,borderTop:"1px solid #eee",background:"#fafafa",
                         display:"flex",alignItems:"center",padding:"8px 0",
                         borderRadius:"0 0 8px 0"}}>
              <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" height={CH}
                style={{display:"block",overflow:"visible"}} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="volGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    {localVolData.map((v,i)=>{
                      const pct=(i/(localVolData.length-1))*100;
                      const c=v>=0.65?"#5cb85c":v>=0.34?"#f0a030":"#cc2e84";
                      return <stop key={i} offset={`${pct}%`} stopColor={c}/>;
                    })}
                  </linearGradient>
                </defs>
                <path d={buildPath(localVolData,CW,CH)} fill="none"
                  stroke="url(#volGrad)" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"/>
                {(()=>{
                  const R=7, GAP=16, cx=chartX, cy=CH/2;
                  const topY=cy-R-GAP, botY=cy+R+GAP;
                  const high=vLevel==="high", med=vLevel==="medium", low=vLevel==="low";
                  return (
                    <g>
                      <rect x={cx-R-3} y={topY-R-3} width={(R+3)*2}
                        height={botY+R+3-(topY-R-3)} rx={R+3}
                        fill="white" stroke="#e0e0e0" strokeWidth="1"/>
                      <circle cx={cx} cy={topY} r={R}
                        fill={high?"#5cb85c":"#e8e8e8"} stroke={high?"#4aaa4a":"#ccc"} strokeWidth="1.5"/>
                      <circle cx={cx} cy={cy} r={R}
                        fill={med?"#f0a030":"#e8e8e8"} stroke={med?"#d8902a":"#ccc"} strokeWidth="1.5"/>
                      <circle cx={cx} cy={botY} r={R}
                        fill={low?"#cc2e84":"#e8e8e8"} stroke={low?"#aa2070":"#ccc"} strokeWidth="1.5"/>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {showDropdown&&(
        <div style={{position:"fixed",inset:0,zIndex:50}}
          onClick={()=>setShowDropdown(false)}/>
      )}
    </div>
  );
}
