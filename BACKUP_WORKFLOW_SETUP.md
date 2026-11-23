# Backup GitHub Actions Workflow Setup

This provides **independent daily monitoring** that runs on GitHub's servers, so it works even if the Claude session isn't running.

## Why You Need This

The Claude-based monitoring is great but session-dependent. This GitHub Actions backup:
- ✅ Runs automatically on GitHub's schedule (9 AM UTC daily)
- ✅ Works even if Claude session ends
- ✅ Provides redundancy - both systems monitor independently
- ✅ No manual intervention needed

## Setup Steps

### 1. Add the Monitoring Script

1. In your repository, add a new file: `monitor.js`
2. Copy the contents from the `monitor.js` file
3. Commit and push:

```bash
git add monitor.js
git commit -m "Add website monitoring script"
git push origin main
```

### 2. Add the GitHub Actions Workflow

1. Create the file: `.github/workflows/monitor-websites.yml`
2. Copy contents from the `monitor-websites.yml` file
3. Commit and push:

```bash
git add .github/workflows/monitor-websites.yml
git commit -m "Add backup GitHub Actions monitoring workflow"
git push origin main
```

### 3. Verify It Works

The workflow will:
- Run daily at **9:00 AM UTC** (you can adjust the cron time in monitor-websites.yml if needed)
- Automatically email the report to shane@cybersecurityjoe.com
- Use the same Gmail credentials you set up earlier

You can also **manually trigger** it:
1. Go to your repository
2. Click **"Actions"** tab
3. Select **"Daily Website Monitoring"**
4. Click **"Run workflow"**

## How It Works

1. **GitHub Actions runs at 9 AM UTC** (every day)
2. **Starts a Node.js environment** with Playwright
3. **Crawls all 8 websites** checking:
   - HTTPS security
   - Page loading (HTTP status codes)
   - Broken links and images
   - Accessibility issues (alt text, headings)
4. **Generates comprehensive report**
5. **Sends via Gmail** to shane@cybersecurityjoe.com

## Timezone Adjustment

The workflow runs at 9:00 AM **UTC**. To change it:

1. Open `.github/workflows/monitor-websites.yml`
2. Find the line: `- cron: '0 9 * * *'`
3. Adjust the time:
   - `'0 9 * * *'` = 9:00 AM UTC
   - `'0 14 * * *'` = 2:00 PM UTC (UTC+5)
   - `'0 13 * * *'` = 1:00 PM UTC (UTC+4)

## Logs & Debugging

If something goes wrong:

1. Go to your repository
2. Click **"Actions"** tab
3. Click the failed workflow run
4. See the error logs

## Notes

- First run may take 2-3 minutes as it installs dependencies
- Subsequent runs are faster
- If a page takes too long, it times out after 30 seconds
- Maximum 50 pages per website (to avoid excessive scan time)
