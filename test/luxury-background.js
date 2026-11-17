/* Subtle in-app parallax; no external image assets. */
(() => {
 const root=document.documentElement;
 let scheduled=false;
 const update=()=>{
  scheduled=false;
  const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
  root.style.setProperty('--lux-scroll-y',(-window.scrollY*.055).toFixed(1)+'px');
 };
 window.addEventListener('scroll',()=>{
  if(!scheduled){scheduled=true;requestAnimationFrame(update);}
 },{passive:true});
 update();
 document.addEventListener('pointerdown',event=>{
  if(event.target.closest('.reaction-picker'))return;
  document.querySelectorAll('.reaction-picker').forEach(panel=>panel.remove());
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')document.querySelectorAll('.reaction-picker').forEach(panel=>panel.remove());
 });
})();