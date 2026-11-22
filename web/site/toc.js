(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  var bar = document.querySelector('.toc-m');
  var label = bar && bar.querySelector('.toc-cur');
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var active = 0;
  var queued = false;
  function update() {
    queued = false;
    var line = window.innerHeight * 0.3;
    var next = 0;
    targets.forEach(function (target, at) { if (target && target.getBoundingClientRect().top <= line) next = at; });
    if (next === active || !links[next]) return;
    active = next;
    links.forEach(function (a, at) { if (at === active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (label) label.textContent = links[active].textContent;
  }
  addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  if (bar) bar.addEventListener('click', function (event) { if (event.target.closest('a')) bar.open = false; });
  update();
})();
