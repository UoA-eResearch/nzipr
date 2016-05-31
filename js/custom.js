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
    $("#year").text(window.min + " - " + window.max);
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
        { "lightness": 100 },
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
    
  // Load knowledge
  
  $.getJSON("cc_latlng.json", function(cc_map) {
    window.cc_map = cc_map;
    $.getJSON("cc_names.json", function(cc_names) {
      window.cc_names = cc_names;
      $.getJSON("get_data.php", function(data) {
        window.data = data;
        renderData();
      });
    });
  });
  
  window.countryCircles = {}
  window.countryLabels = {}
  
  function renderData() {
    if (!window.data) return;
    console.log('rendering');
    var dest = {}
    for (var e of window.data) {
      if (e.year >= window.min && e.year <= window.max) {
        if (dest[e.recipient_iso]) {
          dest[e.recipient_iso] += e.$;
        } else {
          dest[e.recipient_iso] = e.$;
        }
      }
    }
    for (var i in dest) {
      var aid_sum = dest[i];
      var radius = aid_sum / 30000;
      var latlng = window.cc_map[i];
      var center = new google.maps.LatLng(latlng[0], latlng[1]);
      var countryName = window.cc_names[i];
      
      if (window.countryCircles[i]) {
        window.countryCircles[i].setRadius(radius);
        window.countryLabels[i].set('text', countryName + ': ' + window.$format(aid_sum));
      } else {
        window.countryCircles[i] = new google.maps.Circle({
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
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
          recipient_iso: i
        });
        window.countryCircles[i].addListener('click', function() {
          displayInfoWindow(this);
        });
      }
    }
    for (var i in countryCircles) {
      if (!dest[i]) {
        countryCircles[i].setRadius(0);
        countryLabels[i].set('text', '');
      }
    }
    refreshInfoWindow();
  }
  
  function getDonorsForRecipient(recipient) {
    var donors = {}
    for (var e of window.data) {
      if (recipient == e.recipient_iso && e.year >= window.min && e.year <= window.max) {
        if (donors[e.donor_iso]) {
          donors[e.donor_iso] += e.$;
        } else {
          donors[e.donor_iso] = e.$;
        }
      }
    }
    var array = [];
    for (var i in donors) {
      array.push([window.cc_names[i], '$' + donors[i].toLocaleString()]);
    }
    return array;
  }
  
  function getAidTypesForRecipientDonor(recipient, donor) {
    var types = {}
    for (var e of window.data) {
      if (recipient == e.recipient_iso && e.year >= window.min && e.year <= window.max) {
        if (!donor || donor == e.donor_iso) {
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
    var aid_types = getAidTypesForRecipientDonor(target.recipient_iso);
    var contentString = '<div style="width: 100%"><div style="width: 50%; float: left"><table id="donors" width="100%"></table></div><div style="width: 50%; float: left"><table id="aid_types" width="100%"><table></div>';
    
    if (window.infowindow) window.infowindow.close();
    window.infowindow = new google.maps.InfoWindow({
      content: contentString,
      position: target.center,
      target: target
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
    });
    window.infowindow.open(map);
  }
  
  function refreshInfoWindow() {
    var donors = getDonorsForRecipient(window.infowindow.target.recipient_iso);
    var aid_types = getAidTypesForRecipientDonor(window.infowindow.target.recipient_iso);
    var table = $('#donors').DataTable({
      retrieve: true
    });
    table.clear().rows.add(donors).draw();
    
    table = $('#aid_types').DataTable({
      retrieve: true
    });
    table.clear().rows.add(aid_types).draw();
  }
});