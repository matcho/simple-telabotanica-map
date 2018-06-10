// globals
var MAXZOOM = 20; // Leaflet default: 18

var parametresURL = {};
var parametresAttendus = [
	'utilisateur',
	'num_taxon',
	'dept',
	'projet',
	'titre',
	'referentiel',
	'logo',
	'nbjours',
	'url_site',
	'image',
	'groupe_zones_geo'
];
var carte;
var bornesCarte = [[-85.0, -180.0], [85.0, 180.0]];
var couchePoints;
var paramsService;
var requeteEnCours;
var premierChargement = true;
var inhiberProchainDeplacement = false;


$(document).ready(function() {

	// 1. parse URL params
	lireParametresURL();
	//console.log(parametresURL);
	paramsService = parametresURL;

	// 2. init map
	var optionsCoucheOSM = {
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors,'
		+ ' <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
		maxZoom: MAXZOOM,
		noWrap: true
	};
	var optionsCoucheGoogle = {
		attribution: 'Map data &copy;'+new Date().getFullYear()+' <a href="http://maps.google.com">Google</a>',
		maxZoom: MAXZOOM,
		noWrap: true
	};
	var coucheOSM = new L.TileLayer(config.tuilesOsmfrURL, optionsCoucheOSM);
	var coucheSatellite = new L.TileLayer(config.tuilesGoogleURL, optionsCoucheGoogle);
	couchePoints = new L.featureGroup();

	var optionsCarte = {
		center : [46.0, 2.0],
		zoom : 6,
		maxBounds: bornesCarte,
		maxZoom: MAXZOOM
	};
	carte = L.map('map', optionsCarte);
	// empêche de trop dézoomer
	carte.setMinZoom(carte.getBoundsZoom(optionsCarte.maxBounds) + 1);

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

	// 3. charger les points quand on déplace la carte / zoome
	carte.on('moveend', (e) => {
		// sauf si on a sorti un joker !
		console.log('inhiberProchainDeplacement :', inhiberProchainDeplacement);
		if (inhiberProchainDeplacement) {
			console.log('ON PASSE UN TOUR');
			inhiberProchainDeplacement = false;
		} else {
			loadData();
		}
	});
	loadData(); // initial loading
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
	// config
	var URLPoints = config.servicePointsURL;
	var paramsPoints = JSON.parse(JSON.stringify(paramsService)); // clone

	// set bbox
	var bounds = carte.getBounds();
	var zoom = carte.getZoom();
	console.log(zoom);

	// debug
	//if (zoom < 11) { console.log('zoom trop faible: ' + zoom); return; }

	// ne charger que les points de la zone affichée, sauf la première fois
	if (premierChargement) {
		paramsPoints.ne = '85|180';
		paramsPoints.sw = '-85|-180';
	} else {
		paramsPoints.ne = (bounds._northEast.lat % 90) + '|' + (bounds._northEast.lng % 180);
		paramsPoints.sw = (bounds._southWest.lat % 90) + '|' + (bounds._southWest.lng % 180);
	}

	// cancel previous request
	if (requeteEnCours) {
		requeteEnCours.abort();
	}

	// curseur d'attente
	$('#zone-chargement-point').show();

	// appel service
	requeteEnCours = $.ajax({
		url: URLPoints,
		type: 'GET',
		data: paramsPoints,
		timeout: 60000, // important bicoz service kipu
		error: (data) => {
			$('#zone-chargement-point').hide();
			premierChargement = false;
		},
		success: (data) => {
			console.log('got data !');
			console.log(data);

			// clear current markers
			couchePoints.clearLayers();

			// nombre de taxons
			// @TODO appeler le service taxons
			var nombreTaxons = '?';
			//$('#nombre-taxons').html(nombreTaxons);
			//$('#info-taxons').show();

			// infos
			$('#zone-infos').show();
			$('#nombre-observations').html(data.stats.observations);
			$('#info-observations').show();
			$('#nombre-stations').html(data.stats.stations);
			$('#info-stations').show();

			// points
			data.points.forEach((p) => {
				// single station or cluster
				var cluster = (p.id.substring(0, 6) === 'GROUPE');
				var marker;
				if (cluster) {
					//marker = L.marker([p.lat, p.lng], { icon: new L.NumberedDivIcon({ number: p.nbreMarqueur }) }).addTo(couchePoints);
					marker = L.marker([p.lat, p.lng], { icon: iconeCluster(p.nbreMarqueur) }).addTo(couchePoints);
					// cliquer sur un cluster fait zoomer dessus (+1)
					$(marker).click((e) => {
						carte.setView([p.lat, p.lng], Math.min(MAXZOOM, zoom + 3));
					});
				} else {
					marker = L.marker([p.lat, p.lng]).addTo(couchePoints);
					// cliquer sur un marqueur affiche les infos de la station
					marker.bindPopup('chargement…');
					$(marker).click((e) => {
						chargerPopupStation(e, p.id);
					});
				}
			});
		
			// la première fois, ajuster la carte sans recharger les points
			if (premierChargement) {
				inhiberProchainDeplacement = true;
				carte.fitBounds(couchePoints.getBounds());
			}

			// hide waiting cursor
			$('#zone-chargement-point').hide();

			premierChargement = false;
		}
	});
}

function chargerPopupStation(e, idStation) {
	var popup = e.target.getPopup();
	var URLStation = config.serviceStationURL;
	var paramsStation = JSON.parse(JSON.stringify(paramsService)); // clone

	paramsStation.station = idStation;

	$.get(URLStation, paramsStation, (data) => {
		console.log(data);
		popup.setContent('station: ' + data.commune);
		popup.update();
	});
}

// copiée depuis Leaflet-MarkerCluster
// https://github.com/Leaflet/Leaflet.markercluster/blob/6f0f94c23bb51346488feb039288d2b0065acc00/src/MarkerClusterGroup.js
function iconeCluster (nb) {
	var c = ' marker-cluster-';
	if (nb < 10) {
		c += 'small';
	} else if (nb < 100) {
		c += 'medium';
	} else {
		c += 'large';
	}
	return new L.DivIcon({ html: '<div><span>' + nb + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(40, 40) });
}
