<?php

require('settings.inc.php');

$pacific_iso2_codes = '("AS","AU","CK","FJ","PF","GU","KI","MH","FM","NR","NC","NZ","NU","NF","MP","PW","PG","PN","SB","TK","TO","TV","VU","WF","WS")';

$sql = "SELECT donor_iso, recipient_iso, year, aiddata_sector_name, commitment_amount_usd_constant AS $ FROM `aid` WHERE recipient_iso IN $pacific_iso2_codes AND donor_iso!='' AND year != 9999 ORDER BY year ASC";

$result = $db->query($sql);

$result = $result->fetch_all(MYSQLI_ASSOC);

foreach ($result as &$r) {
  $r['year'] = (int)$r['year'];
  $r['$'] = (int)$r['$'];
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
echo json_encode($result);