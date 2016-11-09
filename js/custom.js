$(function() {
  function get_query() {
    var url = location.href;
    var qs = url.substring(url.indexOf('#') + 1).split('&');
    for (var i = 0, result = {}; i < qs.length; i++) {
      qs[i] = qs[i].split('=');
      result[qs[i][0]] = decodeURIComponent(qs[i][1]);
    }
    return result;
  }

  var $_GET = get_query();
  
  // Currency formatter
  
  window.$format = function(sum) {
    sum /= 1E4;
    sum = Math.round(sum);
    sum /= 1E2
    return '$' + sum.toLocaleString() + 'M';
  }
  
  // Timeline
  
  $(".resizable").resizable()
  
  window.min = 1973;
  window.max = 1974;
  window.range = {'min': 1973, 'max': 2012}
  
  window.slider = document.getElementById('timeline');
  
  noUiSlider.create(window.slider, {
    start: [ window.min, window.max ],
    step: 1,
    connect: true,
    behaviour: 'tap-drag',
    range: window.range,
    pips: {
      mode: 'steps',
      density: 2
    },
    //tooltips: [true, true],
    animate: false,
    format: {
      to: function(value) {
        return parseInt(value);
      },
      from: function(value) {
        return parseInt(value);
      }
    }
  });
  
  window.slider.noUiSlider.on('update', function() {
    var values = this.get();
    window.min = values[0];
    window.max = values[1];
    renderData();
  });
    
  $('.play').click(function() {
    if (!window.t) {
      window.t = setInterval(function() {
        if (window.range['max'] == window.max) {
          window.max = window.min // go back to start
        }
        window.slider.noUiSlider.set([null, window.max+1]);
      }, 1000);
      $('.play i').text('pause');
    } else {
      clearInterval(window.t);
      window.t = false;
      $('.play i').text('play_arrow');
    }
  });
  
  // Map
  
  var mapStyle = [
    {
      "stylers": [
        { "visibility": "off" }
      ]
    },{
      "featureType": "landscape.natural",
      "elementType": "geometry.fill",
      "stylers": [
        { "visibility": "on" }
      ]
    },{
      "featureType": "water",
      "elementType": "geometry.fill",
      "stylers": [
        { "visibility": "on" },
        { "hue": "#007fff" },
        { "lightness": -13 }
      ]
    }
  ];
  
  window.map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: -7.7, lng: -180},
    zoom: 4,
    styles: mapStyle,
    disableDefaultUI: true,
    zoomControl: true
  });

  map.data.loadGeoJson('eez.json');
  map.data.setStyle(function(feature) {
    var name = feature.getProperty("Name");
    if (name == "Countries") {
      return {fillColor: "green", fillOpacity: .5, strokeColor: "green", strokeWeight: 1, strokeOpacity: .5}
    }
    return {visible: false}
  });
    
  // Load knowledge
  
  $.getJSON("cc_latlng.json", function(cc_map) {
    window.cc_map = cc_map;
    var color_map = {}
    var getColorAtScalar = function (n, maxLength) {
      var n = n * 360 / maxLength;
      return 'hsl(' + n + ',100%,50%)';
    }
    var countries = Object.keys(cc_map);
    for (var i in countries) {
      var c = countries[i];
      color_map[c] = getColorAtScalar(i, countries.length);
    }
    window.color_map = color_map;
    $.getJSON("cc_names.json", function(cc_names) {
      window.cc_names = cc_names;
      $.getJSON("cc_pop.json", function(cc_pop) {
        window.cc_pop = cc_pop;
        $.getJSON("data.json", function(data) {
          window.data = data;
          renderData();
          renderChart();
          renderFilters();
        });
      });
    });
  });
  
  window.countryCircles = {}
  window.countryLabels = {}
  
  window.drawnTraces = [];
  
  function renderChart(recipient) {
    if (drawnTraces.indexOf(recipient) > -1) return;
    drawnTraces.push(recipient);
    var by_year = {}
    var chart = $("#chart")[0];
    $("#chartContainer").resizable({
      handles: "n, s, w",
      stop: function(event, ui) {
        console.log("resized");
        Plotly.Plots.resize(chart);
      }
    });
    for (var i in window.data) {
      var e = window.data[i];
      if (recipient && e.recipient_iso != recipient) {
        continue;
      }
      if (!by_year[e.year]) by_year[e.year] = 0;
      by_year[e.year] += e.$;
    }
    Plotly.plot(
      chart,
      [{
        name: recipient || "all",
        line: {
          color: color_map[recipient],
        },
        x: Object.keys(by_year),
        y: Object.values(by_year),
      }],
      {
        margin: { t: 0 }
      }
    );
  }
  
  function renderFilters() {
    var sectors = {}
    var donor_countries = {}
    for (var i in window.data) {
      var e = window.data[i];
      if (e.aiddata_sector_name == " " || e.aiddata_sector_name == "Unallocated/  unspecified") {
        e.aiddata_sector_name = "Unallocated/ unspecified";
      }
      if (!sectors[e.aiddata_sector_name]) sectors[e.aiddata_sector_name] = 0;
      sectors[e.aiddata_sector_name] += e.$;
      
      var donor = cc_names[e.donor_iso];
      if (!donor_countries[donor]) donor_countries[donor] = 0;
      donor_countries[donor] += e.$;
    }
    
    console.log(sectors);
    console.log(donor_countries);
    
    var keys = Object.keys(sectors).sort()
    for (var i in keys) {
      var s = keys[i];
      var sum = sectors[s];
      $("#sector").append("<option selected>" + s + "</option>");
    }
    var keys = Object.keys(donor_countries).sort()
    for (var i in keys) {
      var c = keys[i];
      var sum = donor_countries[c];
      $("#countries").append("<option selected>" + c + "</option>");
    }
  }
  
  $("#sector").change(function(e) {
    window.sector_filter = $(this).val();
    renderData();
  });
  
  $("#countries").change(function(e) {
    window.donor_country_filter = $(this).val();
    renderData();
  });
  
  function renderData() {
    if (!window.data) return;
    console.log('rendering');
    var dest = {}
    for (var i in window.data) {
      var e = window.data[i];
      var yearInRange = e.year >= window.min && e.year <= window.max;
      var inSectorFilter = !window.sector_filter || window.sector_filter.indexOf(e.aiddata_sector_name) > -1;
      var inDonorCountryFilter = !window.donor_country_filter || window.donor_country_filter.indexOf(window.cc_names[e.donor_iso]) > -1;
      if (yearInRange && inSectorFilter && inDonorCountryFilter) {
        if (!dest[e.recipient_iso]) dest[e.recipient_iso] = 0;
        dest[e.recipient_iso] += e.$;
      }
    }
    for (var i in dest) {
      var aid_sum = dest[i];
      var radius = aid_sum / 30000;
      var latlng = window.cc_map[i];
      var center = new google.maps.LatLng(latlng[0], latlng[1]);
      var countryName = window.cc_names[i];
      
      if (!window.countryCircles[i]) window.countryCircles[i] = {}
      if (window.countryCircles[i]['aid']) {
        window.countryCircles[i]['aid'].setRadius(radius);
        window.countryCircles[i]['aid'].setVisible(true);
        window.countryLabels[i].set('text', countryName + ': ' + window.$format(aid_sum));
      } else {
        window.countryCircles[i]['aid'] = new google.maps.Circle({
          strokeColor: color_map[i],
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color_map[i],
          fillOpacity: 0.35,
          map: window.map,
          center: center,
          radius: radius,
          recipient_iso: i
        });
        window.countryLabels[i] = new MapLabel({
          text: countryName + ': ' + window.$format(aid_sum),
          position: center,
          map: map,
          fontSize: 15,
          fontColor: 'black',
          strokeColor: 'white',
          strokeWeight: 0,
          align: 'center',
          minZoom: 4,
          recipient_iso: i
        });
        window.countryCircles[i]['aid'].addListener('click', function() {
          window.selected_country = this.recipient_iso;
          displayInfoWindow(this);
          displayLines(this);
          renderChart(this.recipient_iso);
        });
      }
    }
    for (var i in countryCircles) {
      if (!dest[i] && countryCircles[i]['aid']) {
        countryCircles[i]['aid'].setVisible(false);
        countryLabels[i].set('text', '');
      }
    }
    refreshInfoWindow();
    refreshLines();
    renderPopCircles();
  }
  
  function renderPopCircles() {
    for (var i in window.cc_pop) {
      if (!window.cc_map[i] || !window.countryCircles[i]) continue;
      var count = 0;
      var sum = 0;
      for (var year in window.cc_pop[i]) {
        if (year >= window.min && year <= window.max) {
          sum += window.cc_pop[i][year];
          count++;
        }
      }
      var avg = sum / count;
      var radius = avg / 10;
      var latlng = window.cc_map[i];
      var center = new google.maps.LatLng(latlng[0], latlng[1]);
      if (window.countryCircles[i]['pop']) {
        window.countryCircles[i]['pop'].setRadius(radius);
      } else {
        window.countryCircles[i]['pop'] = new google.maps.Circle({
          strokeColor: 'black',
          strokeOpacity: 0.5,
          strokeWeight: 2,
          fillColor: 'red',
          fillOpacity: 0,
          map: window.map,
          center: center,
          radius: radius,
          clickable: false
        });
      }
    }
  }
  
  function displayLines(target) {
    var donors = {};
    for (var i in window.data) {
      var e = window.data[i];
      if (target.recipient_iso == e.recipient_iso && e.year >= window.min && e.year <= window.max) {
        if (donors[e.donor_iso]) {
          donors[e.donor_iso] += e.$;
        } else {
          donors[e.donor_iso] = e.$;
        }
      }
    }
    var latlng_recipient = window.cc_map[target.recipient_iso];
    latlng_recipient = {lat: latlng_recipient[0], lng: latlng_recipient[1]}
    if (window.lines) {
      for (var i in window.lines) {
        window.lines[i].setMap(null);
      }
    }
    window.lines = {};
    for (var i in donors) {
      var latlng_donor = window.cc_map[i];
      latlng_donor = {lat: latlng_donor[0], lng: latlng_donor[1]};
      var aid_sum = donors[i];
      var weight = aid_sum / 1E9;
      if (weight < .5) weight = .5;
      window.lines[i] = new google.maps.Polyline({
        map: map,
        path: [latlng_recipient, latlng_donor],
        geodesic: false,
        strokeColor: color_map[i],
        strokeOpacity: 1.0,
        strokeWeight: weight
      });
    }
  }
  
  function refreshLines() {
    if (!window.selected_country) return;
    var donors = {};
    for (var i in window.data) {
      var e = window.data[i];
      if (window.selected_country == e.recipient_iso && e.year >= window.min && e.year <= window.max) {
        if (donors[e.donor_iso]) {
          donors[e.donor_iso] += e.$;
        } else {
          donors[e.donor_iso] = e.$;
        }
      }
    }
    var latlng_recipient = window.cc_map[window.selected_country];
    latlng_recipient = {lat: latlng_recipient[0], lng: latlng_recipient[1]}
    for (var i in donors) {
      var latlng_donor = window.cc_map[i];
      latlng_donor = {lat: latlng_donor[0], lng: latlng_donor[1]};
      var aid_sum = donors[i];
      var weight = aid_sum / 1E9;
      if (weight < .5) weight = .5;
      if (window.lines[i]) {
        window.lines[i].setOptions({strokeWeight: weight});
      } else {
        window.lines[i] = new google.maps.Polyline({
          map: map,
          path: [latlng_recipient, latlng_donor],
          geodesic: false,
          strokeColor: color_map[i],
          strokeOpacity: 1.0,
          strokeWeight: weight
        });
      }
    }
    donors = Object.keys(donors);
    for (var i in window.lines) {
      if (donors.indexOf(i) == -1) {
        window.lines[i].setOptions({strokeWeight: 0});
      }
    }
  }
  
  function getDonorsForRecipient(recipient, aid_type) {
    var donors = {}
    for (var i in window.data) {
      var e = window.data[i];
      if (recipient == e.recipient_iso && e.year >= window.min && e.year <= window.max) {
        if (!aid_type || !aid_type.length || aid_type.indexOf(e.aiddata_sector_name) != -1) {
          if (donors[e.donor_iso]) {
            donors[e.donor_iso] += e.$;
          } else {
            donors[e.donor_iso] = e.$;
          }
        }
      }
    }
    var array = [];
    for (var i in donors) {
      array.push([window.cc_names[i], '$' + donors[i].toLocaleString()]);
    }
    return array;
  }
  
  function getAidTypesForRecipient(recipient, donor) {
    var types = {}
    for (var i in window.data) {
      var e = window.data[i];
      if (recipient == e.recipient_iso && e.year >= window.min && e.year <= window.max) {
        if (!donor || !donor.length || donor.indexOf(window.cc_names[e.donor_iso]) != -1) {
          if (types[e.aiddata_sector_name]) {
            types[e.aiddata_sector_name] += e.$;
          } else {
            types[e.aiddata_sector_name] = e.$;
          }
        }
      }
    }
    var array = [];
    for (var i in types) {
      array.push([i, '$' + types[i].toLocaleString()]);
    }
    return array;
  }
  
  function displayInfoWindow(target) {
    var donors = getDonorsForRecipient(target.recipient_iso);
    var aid_types = getAidTypesForRecipient(target.recipient_iso);
    var contentString = '<div style="width: 100%"><div style="width: 50%; float: left"><table id="donors" width="100%"></table></div><div style="width: 50%; float: left"><table id="aid_types" width="100%"></table></div></div><span class="help">Click one of the rows to filter the opposite table by that country/sector.</span>';
    
    if (window.infowindow) window.infowindow.close();
    window.infowindow = new google.maps.InfoWindow({
      content: contentString,
      position: target.center,
      target: target,
      zIndex: 1000
    });
    window.infowindow.addListener('domready', function() {
      $('#donors').DataTable({
        data: donors,
        lengthChange: false,
        pageLength: 5,
        order: [[1, 'desc']],
        columns: [
            { title: "Donor country" },
            { title: "Amount donated" },
        ]
      });
      $('#aid_types').DataTable({
        data: aid_types,
        lengthChange: false,
        pageLength: 5,
        order: [[1, 'desc']],
        columns: [
            { title: "Sector" },
            { title: "Amount donated" }
        ]
      });
      $('table.dataTable tbody').on( 'click', 'tr', function () {
        $(this).toggleClass('selected');
        refreshInfoWindow();
      });
    });
    window.infowindow.open(map);
  }
  
  function refreshInfoWindow() {
    if (!window.infowindow) return;

    var donor_table = $('#donors').DataTable({
      retrieve: true
    });
    
    var aid_type_table = $('#aid_types').DataTable({
      retrieve: true
    });
    
    var selected_donors = donor_table.rows('.selected').data().toArray();
    var selected_aid_types = aid_type_table.rows('.selected').data().toArray();
    
    var selected_donors_names = [];
    for (var i in selected_donors) {
      selected_donors_names.push(selected_donors[i][0]);
    }
    var selected_aid_types_names = [];
    for (var i in selected_aid_types) {
      selected_aid_types_names.push(selected_aid_types[i][0]);
    }
    
    console.log(selected_donors_names, selected_aid_types_names);
    
    var donors = getDonorsForRecipient(window.infowindow.target.recipient_iso, selected_aid_types_names);
    var aid_types = getAidTypesForRecipient(window.infowindow.target.recipient_iso, selected_donors_names);
    
    var seen_countries = [];
    // Update existing rows
    donor_table.rows().every(function(rowIdx, tableLoop, rowLoop) {
      var d = this.data();
      for (var i in donors) {
        var pair = donors[i];
        if (pair[0] == d[0]) {
          d[1] = pair[1];
          seen_countries.push(d[0]);
          this.invalidate();
          return;
        }
      }
      $(this.node()).addClass('marked-for-deletion');
    });
    // Remove no longer existing rows
    donor_table.rows('.marked-for-deletion').remove();
    // Add non-existing rows
    for (var i in donors) {
      var pair = donors[i];
      if (seen_countries.indexOf(pair[0]) == -1) {
        donor_table.row.add(pair);
      }
    }
    // Re-render the table
    donor_table.draw(false);
    
    var seen_aid_types = [];
    // Update existing rows
    aid_type_table.rows().every(function(rowIdx, tableLoop, rowLoop) {
      var d = this.data();
      for (var i in aid_types) {
        var pair = aid_types[i];
        if (pair[0] == d[0]) {
          d[1] = pair[1];
          seen_aid_types.push(d[0]);
          this.invalidate();
          return;
        }
      }
      $(this.node()).addClass('marked-for-deletion');
    });
    // Remove no longer existing rows
    aid_type_table.rows('.marked-for-deletion').remove();
    // Add non-existing rows
    for (var i in aid_types) {
      var pair = aid_types[i];
      if (seen_aid_types.indexOf(pair[0]) == -1) {
        aid_type_table.row.add(pair);
      }
    }
    // Re-render the table
    aid_type_table.draw(false);
  }
});