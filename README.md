# Route 53 JSON to BIND Zone file converter

## Overview
Route 53 JSON to BIND Zone file converter is a web-based application that converts DNS details obtained from AWS Route 53 into a BIND zone file format suitable for import into Cloudflare. This tool simplifies the migration process for users transitioning their DNS management.

## Features
- Drag and drop AWS Route 53 JSON output or paste JSON directly.
- Automatic conversion of DNS records to BIND zone file format.
- User-friendly interface styled with Tailwind CSS.

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
