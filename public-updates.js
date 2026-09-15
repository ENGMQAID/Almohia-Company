const motionButton=document.getElementById('motion-toggle');
if(motionButton){if(matchMedia('(prefers-reduced-motion: reduce)').matches){motionButton.hidden=true;}motionButton.onclick=()=>{const paused=document.body.classList.toggle('motion-paused');motionButton.setAttribute('aria-pressed',String(paused));motionButton.textContent=paused?'تشغيل حركة الخلفية':'إيقاف حركة الخلفية';};}
