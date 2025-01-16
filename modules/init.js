const puppeteer = require('puppeteer');
const fs = require('fs'); 
(async () => {
  const url = 'https://service2.diplo.de/rktermin/extern/choose_realmList.do?locationCode=kara&request_locale=en';
  const baseUrl = 'https://service2.diplo.de/rktermin/';
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to the main URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a.arrow');
    // Extract the links for each category
    const updatedUrls = await page.evaluate((baseUrl) => {
      const categories = [
        { name: 'Short-time visa (Schengen)', realmId: '771' },
        { name: 'Study, language course and research visa (long-term)', realmId: '967' },
        { name: 'Work visa (long-term)', realmId: '773' },
        { name: 'Opportunity Card/Chancenkarte (long-term)', realmId: '1116' },
        { name: 'Other Long-Term Visas (Family reunion, Vocational training etc)', realmId: '772' }
      ];
      const links = document.querySelectorAll('a.arrow');
      const urls = Array.from(links).map(link => ({
        name: link.closest('div').previousElementSibling.textContent.trim(),
        href: baseUrl + link.getAttribute('href')
      }));
      // Match extracted URLs with categories
      return categories.map(category => ({
        name: category.name,
        url: urls.find(url => url.href.includes(`realmId=${category.realmId}`))?.href || null
      }));
    }, baseUrl);
    // Save the updated URLs to a JSON file
    fs.writeFileSync('url.json', JSON.stringify(updatedUrls, null, 2), 'utf-8');
    const nestedData = [];
    for (const { name, url } of updatedUrls) {
      if (!url) {
        console.log(`Skipping ${name} as it has no URL.`);
        continue;
      }
      const newPage = await browser.newPage();
      try {
        console.log(`Navigating to ${name}: ${url}`);
        await newPage.goto(url, { waitUntil: 'domcontentloaded' });
        // Wait for the content to load
        await newPage.waitForSelector('#content');
        // Extract the main content and its child links
        const pageData = await newPage.evaluate((baseUrl) => {
          const contentDiv = document.querySelector('#content');
          if (!contentDiv) return null;
          // Extract sections with names and corresponding links
          const sections = Array.from(contentDiv.querySelectorAll('div[style*="font-size: 14pt; font-weight: bold"]')).map((section) => {
            const sectionName = section.textContent.trim();
            const linkElement = section.nextElementSibling?.querySelector('a.arrow');
            const linkUrl = linkElement ? linkElement.href.replace("choose_category", "appointment_showMonth") : null;
            return {
              name: sectionName,
              url: linkUrl,
            };
          });
          return sections;
        }, baseUrl);
        if (pageData) {
          nestedData.push({
            name,
            url,
            content: pageData,
          });
        }
      } catch (error) {
        console.error(`Error processing ${name}: ${error.message}`);
      } finally {
        await newPage.close();
      }
    }
    //Save the updated URLs to Json File
    fs.writeFileSync('url.json', JSON.stringify(nestedData, null, 2), 'utf-8');
    console.log('URLs saved to url.json');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
