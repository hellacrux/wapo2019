const ejs = require('ejs');
const marked = require('marked');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const empty = require('empty-folder');
const ncp = require('ncp');
const download = require('image-downloader');

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const rand_hash = (new Date()).valueOf().toString();

/**
 * fetchGoogleSheet - Fetch a Google spreadsheet's worksheet and store it in
 * session storage so that subsequent requests don't require an AJAX request.
 *
 * @param {string} spreadsheet Spreadsheet's ID
 * @param {string} worksheet Worksheet's ID
 *
 * @return {object} Promise
 */
const fetchGoogleSheet = ({ spreadsheet, worksheet }) => {

  const url = `https://spreadsheets.google.com/feeds/list/${spreadsheet}/${worksheet}/public/values?alt=json`;

  // Get the spreadsheet's JSON
  const getJSON = url => {
    return new Promise(resolve => {
      fetch(url).then(resp => resp.json()).then(data => {
        resolve(data);
      });
    });
  }

  return getJSON(url);

};

const injectContent = content => {
  Object.keys(content).forEach(id => {
    try {
      document.querySelector(`[data-content=${id}]`).innerText = content[id];
    } catch(e) {};
  });
};

async function downloadIMG(opts) {
  try {
    const { filename, image } = await download.image(opts)
    console.log(`Downloaded ${filename}`) // => /path/to/dest/image.jpg
  } catch (e) {
    console.error(e)
  }
}

const fetchContent = fetchGoogleSheet({
  spreadsheet: '1f9vGEmN5lgemlOnWdgSB0Ma3zxda-B4R04jBpK77OaI',
  worksheet: '1'
});

fetchContent.then(data => {
  let articles = [];
  data.feed.entry.forEach(article => {
    const content = {
      headline: article.gsx$headline.$t,
      slug: article.gsx$slug.$t,
      author: article.gsx$author.$t,
      date: article.gsx$date.$t,
      blurb: article.gsx$socialmediablurb.$t,
      keywords: article['gsx$keywordscomma-separated'].$t,
      image: article.gsx$image1836x1287.$t,
      caption: article.gsx$imagecaption.$t,
      oneparagraphsummary: article.gsx$oneparagraphsummary.$t,
      onesentencesummary: article.gsx$onesentencesummary.$t,
      body: marked(article.gsx$fullarticlehtml.$t)
    };
    articles.push(content);
  });

  let template = path.join(__dirname, '..', 'templates', 'individual-article', 'index.html');
  const dir = path.join(__dirname, '..', 'docs');
  const staticFiles = path.join(__dirname, '..', 'templates', 'static');
  const homepage = path.join(__dirname, '..', 'templates', 'homepage', 'index.html');

  mkdirp(`${dir}`, err => {
    if (err) console.error('Error creating /docs directory');
  });

  const assetsToRev = [
    `${dir}/static/css/article.css`,
    `${dir}/static/css/wapo.css`,
    `${dir}/static/css/custom.css`,
    `${dir}/static/css/swg-button.css`,
    `${dir}/static/js/ads.js`,
    `${dir}/static/js/custom.js`,
    `${dir}/static/js/hi.js`,
    `${dir}/static/js/fitty.min.js`
  ]

  empty(dir, false, o => {
    if (o.error) console.error(o.error);
    ncp(staticFiles, `${dir}/static/`, function (err) {
      if (err) return console.error(err);
      assetsToRev.forEach(asset => {
        fs.rename(asset, asset.replace(/(.*)\.(css|js)/, '$1' + rand_hash + '.$2'), function(err) {
            if (err) return console.error('ERROR: ' + err);
            console.log(`Revved ${asset}`);
        });
      })
    });

    articles = articles.map((article, i) => {
      var related = articles.slice();
      related.splice(i, 1);
      article.related = shuffle(related);
      article.root_url = process.env.WAPO_ROOT_URL || '#';
      return article;
    });

    articles.forEach( context => {
      context.rand_hash = rand_hash;
      const video = context.body.match(/https:\/\/archive\.org\/embed\/([\w\-]*)/);
      if (video) {
        context.video_embed_url = `https://archive.org/embed/${video[1]}`
        template = path.join(__dirname, '..', 'templates', 'individual-article', 'video.html');
      }
      ejs.renderFile(template, context, function(err, data) {
        if (err) return console.error(`Oh no! Error generating ${context.slug}!`);
        mkdirp(`${dir}/${context.slug}`, err => {
          if (err) return console.error(err);
          fs.writeFile(`${dir}/${context.slug}/index.html`, data, function(err) {
              if (err) return console.error(err);
              downloadIMG({
                url: context.image,
                dest: `${dir}/static/img/${context.slug}.jpg`
              });
              console.log(`${context.slug} was successfully generated`)
          });
        });
      });
    });

    let homepageContext = {
      articles: articles,
      root_url: process.env.WAPO_ROOT_URL || '#',
      rand_hash: rand_hash
    };

    ejs.renderFile(homepage, homepageContext, function(err, data) {
      if (err) return console.error(`Oh no! Error generating the homepage!`);
      fs.writeFile(`${dir}/index.html`, data, function(err) {
          if (err) return console.error(err);
          console.log('Succesfully generated the homepage');
      });
    });

  });

  // console.log(articles);
});
