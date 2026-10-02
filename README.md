# CRE Market Monitor

A dashboard of interest rates, construction costs and commercial real estate markets.
It refreshes every hour on GitHub's servers, so it runs even when your computer is off.
It works in any browser and can be added to a phone's home screen like an app.

## What's in here

| File | What it does |
|---|---|
| `config.yaml` | **The list of what's tracked.** Edit this to add or remove anything. |
| `fetch_data.py` | Pulls the data from Yahoo Finance and FRED. |
| `.github/workflows/update.yml` | Runs the fetch every hour and publishes the site. |
| `docs/` | The dashboard website. |

## One-time setup (about 15 minutes)

1. **Create a free GitHub account** at https://github.com/signup.
2. **Create a repository.** Click **+** (top right) → **New repository**.
   - Name: `cre-market-monitor`
   - Visibility: **Public**. Free GitHub Pages needs a public repository; it only holds public market data.
   - Click **Create repository**.
3. **Upload the files.** On the new repository page, click **uploading an existing file**.
   Drag in **everything inside** the `market-monitor` folder, including the `.github` folder,
   then click **Commit changes**.
4. **Turn on the website.** Go to **Settings → Pages**. Under **Source**, choose **GitHub Actions**.
5. **Add a free FRED API key** (needed for Treasury, SOFR, PPI and other official data):
   - Sign up at https://fredaccount.stlouisfed.org, then open **API Keys** and request one.
   - In your repository, go to **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FRED_API_KEY`. Value: your key. Click **Add secret**.
6. **Run it the first time.** Go to the **Actions** tab → **Update market data** → **Run workflow**.
   After about a minute, your dashboard is live at:
   `https://YOUR-USERNAME.github.io/cre-market-monitor/`

From then on it updates by itself every hour.

## Put it on your phone

Open the dashboard link on your phone, then:
- **iPhone (Safari):** Share button → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Add to Home screen** (or **Install app**)

## Change what's tracked

On GitHub, open `config.yaml`, click the pencil icon, and edit. Each line looks like:

```yaml
- {label: "Prologis", symbol: "PLD", source: yahoo, unit: usd}
```

- **Yahoo symbols** (stocks, futures, yields): search at https://finance.yahoo.com
- **FRED series** (official economic data): search at https://fred.stlouisfed.org; the ID is in the page URL

Click **Commit changes**. The dashboard updates within a few minutes.

## Good to know

- Yahoo prices can be delayed by about 15 minutes. Values only move while markets are open.
- FRED data updates daily, weekly, monthly or quarterly depending on the series.
- GitHub sometimes starts hourly runs 5 to 30 minutes late when its servers are busy.
- If a source fails, the dashboard keeps the last good value and marks it **stale**.
- To refresh right now: **Actions → Update market data → Run workflow**.
- If GitHub ever pauses the schedule, the Actions tab shows an **Enable workflow** button.
