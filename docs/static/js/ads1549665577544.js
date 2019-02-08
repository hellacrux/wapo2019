var containers = document.querySelectorAll('.sick-ad-yo');
var ads = [
  'Neighbors',
  'Hills',
  'Sex'
];

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}
ads = shuffle(ads);

containers.forEach(function(container) {
  var ad = '/static/img/ads/' + ads.pop() + '_DIGITAL-600x1200.jpg';
  container.src = ad;
});
