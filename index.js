const puppeteer = require('puppeteer');
const mysql = require('mysql');
const dbCredentials = require('./db_credentials');
const allegroCredentials = require('./allegro_credentials');
const sqlstring = require('sqlstring');

let connection = mysql.createConnection({
  ...dbCredentials
});

async function run() {
  let browser = await puppeteer.launch({
    headless: false
  });

  let page = await browser.newPage();
  await page.goto('https://allegro.pl/login/form?authorization_uri=https:%2F%2Fallegro.pl%2Fauth%2Foauth%2Fauthorize%3Fclient_id%3Dtb5SFf3cRxEyspDN%26redirect_uri%3Dhttps:%2F%2Fallegro.pl%2Flogin%2Fauth%26response_type%3Dcode%26state%3Dnainn7&oauth=true');

  // Check, if policy dialog is shown, then click accept button
  let acceptConsentButtonSelector = 'button[data-role="accept-consent"]';
  if (await page.$('button[data-role="accept-consent"]') !== null) {
    await page.click(acceptConsentButtonSelector);
  }

  // Type credentials and login
  await page.click('#username');
  await page.keyboard.type(allegroCredentials.username);
  await page.click('#password');
  await page.keyboard.type(allegroCredentials.password);
  await page.click('#login-button');
  await page.waitForNavigation({
    waitUntil: 'networkidle0'
  });

  await page.goto('https://allegro.pl/kategoria/kuchnia-potrawy-79205');
  
  let articles = await page.evaluate(() => {
    let result = [];

    document.querySelectorAll('article').forEach(article => {
      result.push({
        title: article.querySelector('h2 a').innerHTML
      });
    });

    return result;
  });
  
  let articlesReduced = articles.reduce((result, article, index, articles) => {
    return result + `(${sqlstring.escape(article.title)})${index === articles.length - 1 ? '': ','}`;
  }, '');

  let sqlQuery = `INSERT INTO cookbooks (title) VALUES ${articlesReduced}`;

  connection.query(sqlQuery, (error, result, fields) => {
    if (error) throw error;
    console.log('Uploaded titles to database');
  });

  connection.end();
}

connection.connect((error) => {
  if (error) throw error;
  run();
});