// Local-only shared playback. Native controls remain available independently.
(() => {
  const videos = [...document.querySelectorAll('video[data-variant]')];
  if (!videos.length) return;
  const master = videos[0], seek = document.querySelector('#seek-all');
  const time = document.querySelector('#time-display'), status = document.querySelector('#media-status');
  let syncActive = false, dragging = false, frame = 0;
  const duration = () => Math.min(...videos.map(v => v.duration).filter(Number.isFinite));
  const refresh = () => {
    const ready = videos.filter(v => v.readyState >= 2).length;
    const errors = videos.filter(v => v.error);
    status.textContent = errors.length ? `读取异常 ${errors.length}/4；可展开关键帧备用预览` : `本地视频就绪 ${ready}/4`;
  };
  const update = () => {
    const d = duration();
    if (Number.isFinite(d)) {
      time.textContent = `${master.currentTime.toFixed(2)} / ${d.toFixed(2)} s`;
      if (!dragging) seek.value = String(master.currentTime / d);
    }
  };
  const pause = () => {syncActive = false; videos.forEach(v => v.pause()); cancelAnimationFrame(frame); update();};
  function tick() {
    if (!syncActive) return;
    if (master.ended) { pause(); return; }
    if (!master.seeking && master.readyState >= 3) {
      for (const v of videos.slice(1)) {
        if (!v.seeking && Math.abs(v.currentTime-master.currentTime) > .18) v.currentTime = master.currentTime;
      }
    }
    update(); frame = requestAnimationFrame(tick);
  }
  const align = t => {
    for (const v of videos) if (v.readyState >= 1) {
      v.playbackRate = master.playbackRate;
      v.currentTime = Math.max(0, Math.min(t, v.duration - .001));
    }
    update();
  };
  const play = async () => {
    if (videos.some(v => v.readyState < 1 || v.error)) { refresh(); return; }
    pause();
    align(master.ended ? 0 : master.currentTime);
    const results = await Promise.allSettled(videos.map(v => {v.muted=true; return v.play();}));
    if (results.some(r => r.status==='rejected')) {
      pause(); status.textContent = '浏览器阻止播放；请使用单格控件或再次点击同步播放。'; return;
    }
    syncActive = true; tick();
  };
  document.querySelector('#play-all').addEventListener('click', play);
  document.querySelector('#pause-all').addEventListener('click', pause);
  document.querySelector('#restart-all').addEventListener('click', () => {pause();align(0);});
  seek.addEventListener('input', () => {
    dragging = true; const d=duration();
    if (Number.isFinite(d)) {pause(); align(Number(seek.value)*d);}
  });
  seek.addEventListener('change', () => {dragging=false;update();});
  const presentation = document.querySelector('#presentation');
  const focus = enabled => {
    document.body.classList.toggle('presentation-mode', enabled);
    presentation.setAttribute('aria-pressed',String(enabled));
    presentation.textContent = enabled ? '退出紧凑演示' : '紧凑演示';
    if(enabled) window.scrollTo(0,0);
  };
  presentation.addEventListener('click',() => focus(!document.body.classList.contains('presentation-mode')));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')focus(false);});
  for (const v of videos) {
    // Native controls switch to independent preview; shared controls realign later.
    const independent = () => {syncActive=false;cancelAnimationFrame(frame);};
    v.addEventListener('pointerdown',independent);
    v.addEventListener('keydown',independent);
    v.addEventListener('pause',()=>{if(syncActive&&!master.ended)independent();});
    for (const event of ['loadedmetadata','loadeddata','canplay','error']) v.addEventListener(event,refresh);
    v.addEventListener('loadeddata',()=>v.removeAttribute('poster'));
    v.addEventListener('error',()=>{v.parentElement.querySelector('.video-error').hidden=false;pause();});
    v.addEventListener('timeupdate',()=>{if(v===master)update();});
  }
  master.addEventListener('ended',pause);
  window.galleryPlayback = {play,pause,align, get syncActive(){return syncActive;}};
  refresh();
})();
