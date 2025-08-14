

# Migrate DNS from AWS Route 53 to Cloudflare DNS


## Live Demo
Use the app instantly online: [https://route53-to-bind-zone.onrender.com/](https://route53-to-bind-zone.onrender.com/)

## About This Project
This project helps you <strong>migrate your DNS zones from AWS Route 53 to Cloudflare DNS</strong> quickly and securely. It converts Route 53 JSON exports to BIND zone files, which are compatible with Cloudflare’s DNS import. No data leaves your browser, making it a safe and private migration tool.


## Why Use This Tool?
- Effortlessly migrate DNS records from AWS Route 53 to Cloudflare DNS
- Converts Route 53 JSON to BIND zone file format for Cloudflare import
- 100% browser-based: your DNS data never leaves your device
- No installation, no server, no risk


## Features
- Drag and drop AWS Route 53 JSON output or paste JSON directly
- Automatic conversion of DNS records to BIND zone file format
- User-friendly interface styled with Tailwind CSS
- Designed for DNS migration from AWS to Cloudflare
## Frequently Asked Questions (FAQ)

**Q: Who is this tool for?**
A: Anyone who wants to migrate DNS zones from AWS Route 53 to Cloudflare DNS.

**Q: Is my DNS data safe?**
A: Yes. All processing happens in your browser. No data is uploaded or stored anywhere.

**Q: What file do I need from AWS Route 53?**
A: Export your DNS records as JSON using the AWS CLI (see instructions below).

**Q: What does this tool output?**
A: A BIND zone file you can import into Cloudflare DNS.

**Q: Does it work for large zones?**
A: For very large zones, browser performance may vary, but most typical zones work instantly.

## How to Export Your Route 53 DNS Records from AWS

To use this converter, you need to export your DNS records from AWS Route 53 as a JSON file. Here’s how:

1. **Open AWS CloudShell**
	- Go to the AWS Console and click the CloudShell icon in the top navigation bar.
	- Wait for the CloudShell terminal to load.

2. **List Your Hosted Zones**
	- Run:
	  ```
	  aws route53 list-hosted-zones
	  ```
	- Find the `Id` of the zone you want to export (it looks like `/hostedzone/XXXXXXXXXXXXXX`).

3. **Export DNS Records to JSON**
	- Replace `ZXXXXXXXXXXXXXX` with your actual hosted zone ID (omit the `/hostedzone/` prefix):
	  ```
	  aws route53 list-resource-record-sets --hosted-zone-id ZXXXXXXXXXXXXXX --output json > r53.json
	  ```
	- This creates a file named `r53.json` in your CloudShell home directory.

4. **Download the JSON File to Your Computer**
	- In CloudShell, click the **Actions** menu (top right of the terminal window) and choose **Download file**.
	- Enter `r53.json` as the file to download.
	- The file will be downloaded to your computer and is ready for use in this app.

## Disclaimer
This codebase was entirely vibecoded and is provided as-is, without any warranty or guarantee of fitness for any purpose. Use at your own risk.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file
