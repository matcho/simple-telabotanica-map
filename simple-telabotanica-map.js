// globals
var parametresURL = {};
var parametresAttendus = [
	'utilisateur',
	'num_taxon',
	'dept',
	'projet',
	'titre',
	'referentiel',
	'logo',
	'url_site',
	'image',
	'groupe_zones_geo'
];
var carte;
var couchePoints;
var requeteEnCours;


$(document).ready(function() {
	console.log('ready !');

	// 1. parse URL params
	lireParametresURL();
	console.log(parametresURL);

	// 2. init map
	var optionsCoucheOSM = {
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors,'
		+ ' <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
		maxZoom: 18
	};
	var optionsCoucheGoogle = {
		attribution: 'Map data &copy;'+new Date().getFullYear()+' <a href="http://maps.google.com">Google</a>',
		maxZoom: 18
	};
	var coucheOSM = new L.TileLayer(config.tuilesOsmfrURL, optionsCoucheOSM);
	var coucheSatellite = new L.TileLayer(config.tuilesGoogleURL, optionsCoucheGoogle);

	couchePoints = new L.MarkerClusterGroup({
		disableClusteringAtZoom : 10
	});

	var optionsCarte = {
		center : new L.LatLng(46, 2),
		zoom : 6,
		layers : [coucheOSM]
	};
	carte = L.map('map', optionsCarte);

	coucheOSM.addTo(carte);
	couchePoints.addTo(carte);
	
	// 2.1 map controls
	var baseMaps = {
		"Plan" : coucheOSM,
		"Satellite" : coucheSatellite
	};
	var overlayMaps = {
		"Points" : couchePoints
	};
	L.control.layers(baseMaps, overlayMaps).addTo(carte);


	// 3. call point WS on map move / load
	carte.on('moveend', (e) => {
		console.log('moooorduuuu');
		console.log(e);
		loadData();
	});
	loadData(); // initial loading

	var marker = L.marker([43.5, 3.09]).addTo(couchePoints);
	marker.bindPopup("<b>Hello world!</b><br>I am a popup.");

	// 4. set events listener

	// 5. trigger events listener to decorate map
});


function lireParametresURL(sParam) {
    var queryString = decodeURIComponent(window.location.search.substring(1)),
        morceaux = queryString.split('&'),
        paireParam,
        i;

    for (i=0; i < morceaux.length; i++) {
        paireParam = morceaux[i].split('=');
		var nomParam = paireParam[0];
		if (parametresAttendus.indexOf(nomParam) >= 0) {
			parametresURL[nomParam] = paireParam[1];
		}
    }
}

function loadData() {
	console.log('load data');
	
	// 0. set waiting curor

	var URLPoints = config.servicePointsURL;
	var URLStation = config.serviceStationURL;
	var serviceParams = [];
	// set bbox
	var bounds = carte.getBounds();
	var zoom = carte.getZoom();
	//console.log(bounds);
	//console.log(zoom);

	// if zoom is too low, use cluster service instead of regular one
	if (zoom < 11) {
		console.log('zoom trop faible: ' + zoom);
		return;
	}

	serviceParams.push('ne=' + bounds._northEast.lat + '|' + bounds._northEast.lng);
	serviceParams.push('sw=' + bounds._southWest.lat + '|' + bounds._southWest.lng);
	// &zoom=3&ne=72.8918633443125|176&sw=-1.5005593137338373|-156
	// add optional parameters

	// append parameters
	URLPoints += '?' + serviceParams.join('&');

	// cancel previous request
	if (requeteEnCours) {
		requeteEnCours.abort();
	}

	// call
	requeteEnCours = $.get(URLPoints, serviceParams, (data) => {
		console.log('got data !');
		console.log(data);
		console.log(data.stats.stations + ' stations, ' + data.stats.observations + ' observations');
		data.points.forEach((p) => {
			var marker = L.marker([p.lat, p.lng]).addTo(couchePoints);
			marker.bindPopup("Station " + p.id);
		});
		// 999. hide waiting cursor
	});
}
