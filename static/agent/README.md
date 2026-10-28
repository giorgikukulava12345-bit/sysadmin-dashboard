# NOC Local Network Scanner

Free, standard-library Python agent for the NOC website. Python 3.10+ and the
operating system's `ping` command are required. No Python packages or paid API
are needed. No service is installed, and no scan starts when the agent launches.

## Windows

1. Download `noc_local_agent.py` from the site's Local Network Scanner section.
2. Open Terminal in the download folder and run:

   `py -3 noc_local_agent.py`

3. Keep the terminal open. Copy the printed session token into the website.
4. Click **Connect agent**, review your IPv4 range and click **Start scan**.
5. Click **Stop scan** to stop the current job. Ctrl+C in the terminal exits the agent.

On macOS or Linux, use `python3 noc_local_agent.py`. If `ping` is missing,
install your operating system's standard ping utility before scanning.

## Scope and results

- Supports private IPv4 addresses in 10/8, 172.16/12 and 192.168/16.
- Accepts a host, CIDR, `192.168.1.1-254` or a full start-end IPv4 range.
- Maximum 1024 addresses per job, 32 workers, one active job per agent.
- Sends one ICMP echo probe per address using the system ping command.
- **No response** does not prove a host is offline; ICMP may be filtered.
- Optional reverse DNS uses your system resolver and can add up to two seconds
  per responding host. Names may be unavailable or refer to old DNS records.
- MAC addresses come from the existing local neighbor cache after probing.
  They usually require the same Layer 2 subnet and can be absent or stale.
- Manufacturer names are blank unless an offline OUI CSV is supplied. Locally
  administered/randomized MAC addresses are not assigned a guessed vendor.
- Comments remain in the browser and CSV/JSON exports. They are not sent to the agent.

Use **Export CSV** or **Export JSON** to save results. All results, including those
hidden by a filter, are exported. The page keeps data in memory only.

## Optional offline manufacturer lookup

Prepare a UTF-8 CSV with two columns: six hexadecimal OUI digits and vendor name.
For example, replace `AABBCC,Your vendor` with entries from your trusted local
inventory. A header is optional. The CSV is read locally and never uploaded.

`py -3 noc_local_agent.py --oui-csv oui.csv`

## Connection troubleshooting

The agent listens only on `127.0.0.1:8765`. It accepts authenticated requests
from `https://giorgikukulava.vercel.app`. A new random token is generated each
time it starts. Tokens are not saved, accepted in URLs or printed in request logs.
Paste only into the website you trust. The browser may ask for local-network or
loopback access. Browser support and enterprise policies can block this connection.

If port 8765 is occupied, run `py -3 noc_local_agent.py --port 8766`, then enter
8766 in the website's Local agent port field.

If direct browser access is blocked, run a single scan and import its JSON file:

`py -3 noc_local_agent.py --once 192.168.1.0/24 --output scan-results.json`

Add `--resolve-names` if you want reverse DNS in this mode. An explicit output
path is overwritten when exporting, so choose a filename you intend to replace.
Ctrl+C interrupts this command; partial results are not exported on interruption.

For another trusted deployment or local development, explicitly add its exact origin:

`py -3 noc_local_agent.py --allow-origin http://127.0.0.1:8785`

Wildcards, credentials and URL paths are rejected. HTTP is accepted only for
loopback development origins. Binding to LAN/public interfaces is not supported.
The website talks directly to this process; scanning is never executed on Vercel.

## Limits

This is an IPv4 discovery tool, not a clone of every Advanced IP Scanner feature.
It does not perform port enumeration, SMB enumeration, remote control, Wake-on-LAN,
automatic network changes or continuous background monitoring. Only scan networks
you own or have authorization to assess. Stop and restart the agent to revoke its token.
