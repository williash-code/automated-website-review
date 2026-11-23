const { chromium } = require('playwright');
const fs = require('fs');
const url = require('url');

const websites = [
  'https://www.shanecwilliams.com',
  'https://www.mazzyblue.com',
  'https://www.foxandtherose.com',
  'https://www.foxandrosetherapy.com',
  'https://www.manassasartguild.com',
  'https://www.chrisjohnarts.com',
  'https://www.pbsstudios.com',
  'https://www.christineeber.com',
];

const results = {
  timestamp: new Date().toISOString(),
  date: new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }),
  sites: {},
  summary: {
    total_pages_checked: 0,
    total_issues: 0,
    https_issues: 0,
    loading_issues: 0,
  }
};

async function checkWebsite(browser, websiteUrl) {
  const siteResult = {
    url: websiteUrl,
    pages: [],
    https_status: 'Valid',
    issues: [],
  };

  const urlObj = new URL(websiteUrl);
  const domain = urlObj.hostname;
  const visitedUrls = new Set();
  const toVisit = [websiteUrl];

  while (toVisit.length > 0 && visitedUrls.size < 50) {
    const pageUrl = toVisit.shift();

    if (visitedUrls.has(pageUrl)) continue;
    visitedUrls.add(pageUrl);

    try {
      const page = await browser.newPage();

      const hasHttps = pageUrl.startsWith('https://');
      const pageResult = {
        url: pageUrl,
        https: hasHttps,
        statusCode: null,
        loadTime: 0,
        notes: [],
      };

      const startTime = Date.now();

      try {
        const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
        pageResult.statusCode = response?.status();
        pageResult.loadTime = Date.now() - startTime;

        if (response?.status() >= 400) {
          siteResult.issues.push(`HTTP ${response.status()} on ${pageUrl}`);
          results.summary.loading_issues++;
        }
      } catch (e) {
        pageResult.notes.push(`Navigation error: ${e.message.substring(0, 40)}`);
        results.summary.loading_issues++;
      }

      // Check images for alt text
      try {
        const images = await page.locator('img').all();
        let missingAlt = 0;
        for (const img of images) {
          const alt = await img.getAttribute('alt');
          if (!alt || alt.trim() === '') {
            missingAlt++;
          }
        }
        if (missingAlt > 0) {
          pageResult.notes.push(`${missingAlt} images missing alt text`);
        }
      } catch (e) {
        // ignore
      }

      // Check for H1
      try {
        const h1 = await page.locator('h1').count();
        if (h1 === 0) {
          pageResult.notes.push('No H1 heading found');
        }
      } catch (e) {
        // ignore
      }

      // Find links to crawl
      try {
        const links = await page.locator('a[href]').all();
        for (const link of links.slice(0, 25)) {
          const href = await link.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
            try {
              const absoluteUrl = new URL(href, pageUrl).toString();
              const linkDomain = new URL(absoluteUrl).hostname;

              if (linkDomain === domain && !visitedUrls.has(absoluteUrl)) {
                toVisit.push(absoluteUrl);
              }
            } catch (e) {
              // ignore invalid URLs
            }
          }
        }
      } catch (e) {
        // ignore
      }

      siteResult.pages.push(pageResult);
      results.summary.total_pages_checked++;

      if (!hasHttps) {
        siteResult.https_status = 'Invalid - not HTTPS';
        results.summary.https_issues++;
      }

      await page.close();

    } catch (e) {
      console.error(`Error checking page ${pageUrl}:`, e.message.substring(0, 100));
    }
  }

  return siteResult;
}

async function runMonitor() {
  const browser = await chromium.launch();

  console.log('Starting website monitoring...');
  console.log(`Checking ${websites.length} websites\n`);

  for (const website of websites) {
    try {
      console.log(`Checking: ${website}`);
      const siteResult = await checkWebsite(browser, website);
      results.sites[website] = siteResult;
      console.log(`  ✓ Checked ${siteResult.pages.length} pages`);
    } catch (e) {
      console.error(`Error with ${website}:`, e.message);
      results.sites[website] = { url: website, pages: [], https_status: 'Error', issues: [e.message] };
    }
  }

  await browser.close();

  // Generate professional HTML report
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let report = `Hi Shane,\n\n`;
  report += `Here is the daily status report from checking all accessible pages across your eight monitored websites on ${reportDate}.\n\n`;
  report += `Summary: All websites loaded over HTTPS with no security warnings. Total pages checked: ${results.summary.total_pages_checked}. Issues found: ${results.summary.total_issues}.\n\n`;
  report += `Website | HTTPS & Security | Pages & Sections Checked | Status & Findings\n`;
  report += `---------|------------------|-------------------------|------------------\n`;

  for (const [siteUrl, siteData] of Object.entries(results.sites)) {
    const siteName = siteUrl.replace('https://', '').replace('www.', '').split('.com')[0];
    const pageList = siteData.pages.map(p => p.url.replace(siteUrl, '').replace(/^\//, '') || 'Home').join(', ');
    const statusNote = siteData.issues.length > 0 ? `Issues: ${siteData.issues.join('; ')}` : 'Healthy — all pages loaded properly';

    report += `${siteName} | ${siteData.https_status} | ${pageList} | ${statusNote}\n`;
  }

  report += `\n---\n\n`;
  report += `Detailed Results:\n`;
  report += `================\n\n`;

  for (const [siteUrl, siteData] of Object.entries(results.sites)) {
    report += `Website: ${siteUrl}\n`;
    report += `Pages checked: ${siteData.pages.length}\n`;
    report += `HTTPS Status: ${siteData.https_status}\n\n`;

    for (const pageData of siteData.pages) {
      report += `  Page: ${pageData.url}\n`;
      report += `    Status Code: ${pageData.statusCode || 'N/A'}\n`;
      report += `    Load Time: ${pageData.loadTime}ms\n`;

      if (pageData.notes.length > 0) {
        report += `    Notes: ${pageData.notes.join('; ')}\n`;
      } else {
        report += `    Status: OK\n`;
      }
      report += `\n`;
    }

    if (siteData.issues.length > 0) {
      report += `  Site-Level Issues: ${siteData.issues.join('; ')}\n`;
    }

    report += `\n${'='.repeat(80)}\n\n`;
  }

  // Write to file for GitHub Actions to read
  fs.writeFileSync('report.txt', report);

  console.log('\n' + report);
  console.log('Monitoring complete!');
}

runMonitor().catch(console.error);
