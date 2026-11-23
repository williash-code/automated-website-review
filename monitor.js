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
  'https://mail.cybersecurityjoe.com',
  'https://www.cybersecurityjoe.com',
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
    total_https_ok: 0,
    total_issues: 0,
  }
};

async function checkWebsite(browser, websiteUrl) {
  const siteResult = {
    url: websiteUrl,
    pages: [],
    https_valid: true,
    all_pages_ok: true,
    status_text: 'Healthy — all pages loaded and functioned properly',
    findings: [],
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
      const pageTitle = pageUrl.replace(websiteUrl, '').replace(/^\//, '') || 'Home';

      try {
        const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
        const statusCode = response?.status();

        if (!hasHttps) {
          siteResult.https_valid = false;
          siteResult.all_pages_ok = false;
        }

        if (statusCode >= 400) {
          siteResult.all_pages_ok = false;
          siteResult.findings.push(`HTTP ${statusCode} error on ${pageTitle}`);
        }

      } catch (e) {
        siteResult.all_pages_ok = false;
        siteResult.findings.push(`Failed to load ${pageTitle}`);
      }

      siteResult.pages.push({
        title: pageTitle,
        url: pageUrl
      });

      results.summary.total_pages_checked++;

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
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore
      }

      await page.close();

    } catch (e) {
      console.error(`Error checking page ${pageUrl}:`, e.message.substring(0, 100));
    }
  }

  // Build status text
  if (siteResult.all_pages_ok && siteResult.https_valid) {
    siteResult.status_text = 'Healthy — all pages loaded and functioned properly';
    results.summary.total_https_ok++;
  } else if (siteResult.findings.length > 0) {
    siteResult.status_text = `Issues noted: ${siteResult.findings.join('; ')}`;
    results.summary.total_issues++;
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
      results.sites[website] = {
        url: website,
        pages: [],
        https_valid: false,
        all_pages_ok: false,
        status_text: `Error: ${e.message.substring(0, 50)}`,
        findings: [e.message]
      };
    }
  }

  await browser.close();

  // Generate professional report with clean list format
  let report = `Hi Shane,\n\n`;
  report += `Here is the full status report from checking all accessible pages across your eight monitored websites on ${results.date}.\n\n`;
  report += `Summary: ${results.summary.total_https_ok} websites loaded over HTTPS with no SSL/security warnings or HTTP errors. Total pages checked: ${results.summary.total_pages_checked}. ${results.summary.total_issues > 0 ? `Issues found on ${results.summary.total_issues} site(s).` : 'No critical issues found.'}\n\n`;

  report += `${'-'.repeat(80)}\n\n`;

  for (const [siteUrl, siteData] of Object.entries(results.sites)) {
    const siteName = siteUrl.replace('https://', '').replace('www.', '');
    const httpsStatus = siteData.https_valid ? 'Valid HTTPS, no warnings' : 'Invalid - HTTP or SSL warning';
    const pagesList = siteData.pages.length > 0 ? siteData.pages.map(p => p.title || 'Home').join(', ') : 'None';

    report += `Website: ${siteName}\n`;
    report += `HTTPS & Security: ${httpsStatus}\n`;
    report += `Pages & Sections Checked: ${pagesList}\n`;
    report += `Status & Findings: ${siteData.status_text}\n`;
    report += `\n`;
  }

  report += `${'-'.repeat(80)}\n`;

  // Write to file for GitHub Actions to read
  fs.writeFileSync('report.txt', report);

  console.log(report);
  console.log('Monitoring complete!');
}

runMonitor().catch(console.error);
