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

	var couchePoints = new L.MarkerClusterGroup({
		disableClusteringAtZoom : 10
	});

	var optionsCarte = {
		center : new L.LatLng(46, 2),
		zoom : 6,
		layers : [coucheOSM]
	};
	var carte = L.map('map', optionsCarte);

	coucheOSM.addTo(carte);
	couchePoints.addTo(carte);
	
	// 2.1 map controls
	var baseMaps = {
		"Plan" : coucheOSM,
		"Satellite" : coucheSatellite
	};
	var overlayMaps = {
		"Structures" : couchePoints
	};
	L.control.layers(baseMaps, overlayMaps).addTo(carte);


	// 3. call point WS
	var serviceURL = config.serviceURL;
	
	
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
};
