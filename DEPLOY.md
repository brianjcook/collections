# Deploy Guide: thecookblog.com/tools/collections

This repo is configured for GitHub Actions FTP deploy on every push to `main`.

## 1) Required GitHub Secrets

In `brianjcook/collections` -> `Settings` -> `Secrets and variables` -> `Actions`, add:

1. `FTP_SERVER` -> FTP host (example: `ftp.thecookblog.com`)
2. `FTP_USERNAME` -> FTP username
3. `FTP_PASSWORD` -> FTP password
4. `FTP_PROTOCOL` -> `ftp` or `ftps` (use your host's documented setting)
5. `FTP_PORT` -> usually `21` for FTP/explicit FTPS
6. `FTP_SERVER_DIR` -> `/public_html/tools/collections/`

## 2) Deploy

Push to `main` and GitHub Actions will deploy files to:

- `https://thecookblog.com/tools/collections/`

You can also run the workflow manually from Actions: `Deploy Collections to FTP`.

## 3) Daily puzzle data update

This repo includes a second workflow, `Update Connections Data`, that runs daily and writes:

- `data/connections-YYYY-MM-DD.json`
- `data/connections-latest.json`

Those commits to `main` automatically trigger deploy, so the app can auto-load same-origin puzzle data without browser CORS issues.
