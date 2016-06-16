#!/usr/bin/env python
import json
from pprint import pprint

with open('lowy.json') as f:
  data = json.load(f)

with open('../cc_names.json') as f:
  cc_names = json.load(f)

reverse_cc_names = {v: k for k,v in cc_names.items()}

for entry in data['feed']['entry']:
  d = {}
  for k,v in entry.items():
    if '$t' in v:
      key = k[4:]
      val = v['$t']
      if key == 'amount':
        try:
          val = float(val) * 1E6
        except ValueError:
          val = 0
      if key == 'country':
        d['recipient_iso'] = reverse_cc_names[val]
      d[key] = val
  print(u"INSERT INTO aid SET year={startdate}, donor='China', donor_iso='CN', donor_region='Far East Asia', implementing_agency='{actorschina}', commitment_amount_usd_constant={amount}, recipient='{country}', recipient_iso='{recipient_iso}', recipient_region='Oceania', title='{project}', long_description='{description}', aiddata_sector_name='{sector}', flow_name='{type}', source='LOWY';".format(**d).encode('utf8'))