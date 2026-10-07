import requests
import re
import json

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
try:
    res = requests.get('https://www.songsterr.com/a/wsa/metallica-master-of-puppets-tab-s455118', headers=headers, verify=False)
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', res.text)
    if m:
        data = json.loads(m.group(1))
        page_props = data.get('props', {}).get('pageProps', {})
        print("Keys in pageProps:", list(page_props.keys()))
        for k in ['current', 'song', 'track', 'tab', 'source']:
            if k in page_props:
                print(f"--- {k} ---")
                val = str(page_props[k])
                print(val[:400])
    else:
        print("No __NEXT_DATA__ found")
except Exception as e:
    print("Error:", e)
