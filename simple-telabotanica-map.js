// globals
var MAXZOOM = 18; // Leaflet default: 18

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
		maxZoom: MAXZOOM
	};
	var optionsCoucheGoogle = {
		attribution: 'Map data &copy;'+new Date().getFullYear()+' <a href="http://maps.google.com">Google</a>',
		maxZoom: MAXZOOM
	};
	var coucheOSM = new L.TileLayer(config.tuilesOsmfrURL, optionsCoucheOSM);
	var coucheSatellite = new L.TileLayer(config.tuilesGoogleURL, optionsCoucheGoogle);
	couchePoints = new L.layerGroup();

	var optionsCarte = {
		center : new L.LatLng(46, 2),
		zoom : 6,
		maxZoom: MAXZOOM
	};
	carte = L.map('map', optionsCarte);

	coucheOSM.addTo(carte);
	couchePoints.addTo(carte);

	// 2.1 custom zoom position
	var corners = carte._controlCorners;
	var container = carte._controlContainer;
	corners['topleft-custom-left'] = L.DomUtil.create('div', 'leaflet-topleft-custom leaflet-left', container);
	
	// 2.2 map controls
	var baseMaps = {
		"Plan" : coucheOSM,
		"Satellite" : coucheSatellite
	};
	var overlayMaps = {
		//"Points" : couchePoints
	};
	L.control.layers(baseMaps, overlayMaps).addTo(carte);// Create additional Control placeholders
	carte.zoomControl.setPosition('topleft-custom-left');
	carte.addControl(new L.Control.Fullscreen().setPosition('bottomleft'));
	carte.addControl(new L.control.scale({ metric: true, imperial: false }).setPosition('bottomright'));

	// 3. call point WS on map move / load
	carte.on('moveend', (e) => {
		console.log('moooorduuuu');
		loadData();
	});
	loadData(); // initial loading

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

	var URLPoints = config.servicePointsURL;
	var URLStation = config.serviceStationURL;
	var serviceParams = [];
	// set bbox
	var bounds = carte.getBounds();
	var zoom = carte.getZoom();
	//console.log(bounds);
	console.log(zoom);

	// debug
	if (zoom < 11) {
		console.log('zoom trop faible: ' + zoom);
		return;
	}
	// add BBOX
	serviceParams.push('ne=' + bounds._northEast.lat + '|' + bounds._northEast.lng);
	serviceParams.push('sw=' + bounds._southWest.lat + '|' + bounds._southWest.lng);

	// add optional parameters
	// @TODO

	// append parameters
	URLPoints += '?' + serviceParams.join('&');

	// cancel previous request
	if (requeteEnCours) {
		requeteEnCours.abort();
	}

	// curseur d'attente
	$('#zone-chargement-point').show();

	// appel service
	requeteEnCours = $.get(URLPoints, serviceParams, (data) => {
		console.log('got data !');
		console.log(data);
		// clear current markers
		couchePoints.clearLayers();

		console.log(data.stats.stations + ' stations, ' + data.stats.observations + ' observations');
		data.points.forEach((p) => {
			// single station or cluster
			var cluster = (p.id.substring(0, 6) === 'GROUPE');
			var marker;
			if (cluster) {
				console.log('oh le bo clustaire');
				marker = L.marker([p.lat, p.lng], { icon:	new L.NumberedDivIcon({ number: p.nbreMarqueur }) }).addTo(couchePoints);
				// cliquer sur un cluster fait zoomer dessus (+1)
				$(marker).click((e) => {
					console.log('ça zoome du cul !');
					carte.setView([p.lat, p.lng], Math.min(MAXZOOM, zoom + 3));
				});
				
			} else {
				marker = L.marker([p.lat, p.lng]).addTo(couchePoints);
				marker.bindPopup("Station " + p.id);
			}
		});
		// hide waiting cursor
		$('#zone-chargement-point').hide();
	});
}
