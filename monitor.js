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
  date: new Date().toLocaleDateString(),
  sites: {},
  summary: {
    total_pages_checked: 0,
    total_issues: 0,
    https_issues: 0,
    loading_issues: 0,
    accessibility_issues: 0,
  }
};

async function checkWebsite(browser, websiteUrl) {
  const siteResult = {
    url: websiteUrl,
    pages: {},
    issues: [],
  };

  const urlObj = new URL(websiteUrl);
  const domain = urlObj.hostname;
  const visitedUrls = new Set();
  const toVisit = [websiteUrl];

  try {
    while (toVisit.length > 0 && visitedUrls.size < 50) {
      const pageUrl = toVisit.shift();

      if (visitedUrls.has(pageUrl)) continue;
      visitedUrls.add(pageUrl);

      try {
        const context = await browser.createIncognitoBrowserContext();
        const page = await context.newPage();

        const hasHttps = pageUrl.startsWith('https://');
        const pageResult = {
          url: pageUrl,
          https: hasHttps,
          statusCode: null,
          loadTime: 0,
          broken_images: 0,
          broken_links: [],
          accessibility_issues: [],
          errors: [],
        };

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        const startTime = Date.now();

        try {
          const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
          pageResult.statusCode = response?.status();
          pageResult.loadTime = Date.now() - startTime;

          if (response?.status() >= 400) {
            pageResult.errors.push(`HTTP ${response.status()}`);
          }
        } catch (e) {
          pageResult.errors.push(`Navigation failed: ${e.message.substring(0, 50)}`);
          pageResult.statusCode = null;
        }

        const images = await page.locator('img').all();
        for (const img of images) {
          try {
            const src = await img.getAttribute('src');
            const alt = await img.getAttribute('alt');
            if (!alt || alt.trim() === '') {
              pageResult.accessibility_issues.push(`Image missing alt text: ${src?.substring(0, 50)}`);
            }
          } catch (e) {
            // ignore
          }
        }

        const links = await page.locator('a[href]').all();
        for (const link of links.slice(0, 20)) {
          try {
            const href = await link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
              const absoluteUrl = new URL(href, pageUrl).toString();
              const linkDomain = new URL(absoluteUrl).hostname;

              if (linkDomain === domain) {
                toVisit.push(absoluteUrl);
              }
            }
          } catch (e) {
            // ignore
          }
        }

        const h1 = await page.locator('h1').count();

        if (h1 === 0) {
          pageResult.accessibility_issues.push('No H1 heading found');
        }

        siteResult.pages[pageUrl] = pageResult;
        results.summary.total_pages_checked++;

        if (pageResult.errors.length > 0 || (pageResult.statusCode && pageResult.statusCode >= 400)) {
          results.summary.loading_issues++;
          pageResult.errors.length > 0 && results.summary.total_issues++;
        }
        if (!hasHttps) {
          results.summary.https_issues++;
          results.summary.total_issues++;
        }
        if (pageResult.accessibility_issues.length > 0) {
          results.summary.accessibility_issues++;
          results.summary.total_issues++;
        }

        await page.close();
        await context.close();

      } catch (e) {
        console.error(`Error checking page ${pageUrl}:`, e.message.substring(0, 100));
      }
    }
  } catch (e) {
    siteResult.issues.push(`Failed to check website: ${e.message}`);
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
      console.log(`  ✓ Checked ${Object.keys(siteResult.pages).length} pages`);
    } catch (e) {
      console.error(`Error with ${website}:`, e.message);
      results.sites[website] = { url: website, pages: {}, issues: [e.message] };
    }
  }

  await browser.close();

  // Generate report
  let report = `DAILY WEBSITE MONITORING REPORT\n`;
  report += `Generated: ${new Date().toLocaleString()}\n\n`;
  report += `SUMMARY:\n`;
  report += `  Total pages checked: ${results.summary.total_pages_checked}\n`;
  report += `  Total issues found: ${results.summary.total_issues}\n`;
  report += `  HTTPS issues: ${results.summary.https_issues}\n`;
  report += `  Loading/Error issues: ${results.summary.loading_issues}\n`;
  report += `  Accessibility issues: ${results.summary.accessibility_issues}\n\n`;

  report += `DETAILED RESULTS:\n`;
  report += `${'='.repeat(80)}\n\n`;

  for (const [siteUrl, siteData] of Object.entries(results.sites)) {
    report += `WEBSITE: ${siteUrl}\n`;
    report += `Pages checked: ${Object.keys(siteData.pages).length}\n\n`;

    for (const [pageUrl, pageData] of Object.entries(siteData.pages)) {
      report += `  Page: ${pageUrl}\n`;
      report += `    Status: ${pageData.statusCode || 'N/A'}\n`;
      report += `    HTTPS: ${pageData.https ? 'Yes' : 'No'}\n`;
      report += `    Load time: ${pageData.loadTime}ms\n`;

      if (pageData.errors.length > 0) {
        report += `    Errors: ${pageData.errors.join(', ')}\n`;
      }

      if (pageData.accessibility_issues.length > 0) {
        report += `    Accessibility issues: ${pageData.accessibility_issues.join(', ')}\n`;
      }

      report += `\n`;
    }

    if (siteData.issues.length > 0) {
      report += `  Site Issues: ${siteData.issues.join(', ')}\n`;
    }

    report += `${'='.repeat(80)}\n\n`;
  }

  // Write to file for GitHub Actions to read
  fs.writeFileSync('report.txt', report);

  // Also output to stdout
  console.log('\n' + report);
  console.log('Monitoring complete!');
}

runMonitor().catch(console.error);
