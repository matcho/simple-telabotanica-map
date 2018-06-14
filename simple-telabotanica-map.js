// globals
var MAXZOOM = 20; // Leaflet default: 18

var parametresURL = {};
var parametresAttendus = [
	'dept',
	'groupe_zones_geo',
	'image', // wtf ce vieuw param ? http://www.tela-botanica.org/widget:cel:cartoPoint?utilisateur=21236&image=http://www.trendastic.com/wp-content/uploads/433.jpg
	'logo',
	'nbjours',
	'num_taxon',
	'projet',
	'referentiel',
	'titre',
	'url_site',
	'utilisateur'
];
var filtres = { // @TODO trouver le meilleur ordre
	'dept': 'département %s',
	'groupe_zones_geo': 'zone géographique "%s"',
	'referentiel': 'référentiel %s',
	'num_taxon': 'taxon n°%s',
	'projet': 'projet "%s"',
	'utilisateur': 'utilisateur %s',
	'nbjours': 'depuis %s jours'
};
var carte;
var bornesCarte = [[-85.0, -180.0], [85.0, 180.0]];
var couchePoints;
var paramsService;
var requeteEnCours;
var premierChargement = true;
var inhiberProchainDeplacement = false;
var inhiber = false;


$(document).ready(function() {

	// 1. parse URL params
	lireParametresURL();
	//console.log(parametresURL);
	paramsService = parametresURL;
	
	// 1.5 titre et logo personnalisés
	if ('titre' in parametresURL) {
		$('#zone-titre').html(parametresURL.titre);
		$('#zone-titre').show();
	}
	if ('logo' in parametresURL) {
		$('#image-logo').prop('src', parametresURL.logo);
		// URL perso ?
		var nouvelleURL = '#'; // par défaut, désactiver le lien vers Tela Botanica
		if ('url_site' in parametresURL) {
			nouvelleURL = parametresURL.url_site;
		}
		$('#logo > a').prop('href', nouvelleURL);
	}

	// 1.6 affichage infos filtres
	var infosFiltres = [];
	for (var filtre in parametresURL) {
		if (Object.keys(filtres).indexOf(filtre) !== -1) {
			infosFiltres.push(
				filtres[filtre].replace('%s', parametresURL[filtre]) // le sprintf du clodo
			);
		}
	}
	infosFiltres = infosFiltres.join(', ');
	infosFiltres = infosFiltres.charAt(0).toUpperCase() + infosFiltres.slice(1);
	$('#zone-filtres').html(infosFiltres);
	$('#zone-filtres-wrapper').show();

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
		//console.log('inhiberProchainDeplacement :', inhiberProchainDeplacement);
		if (inhiberProchainDeplacement) {
			//console.log('ON PASSE UN TOUR');
			inhiberProchainDeplacement = false;
		} else if (inhiber) {
			//console.log('ON NE BOUGE PLUS JUSQU\'À NOUVEL ORDRE');
		} else {
			loadData();
		}
	});
	loadData(); // initial loading

	// 4. événements divers
	// réactiver le chargement des points quand le popup est fermé
	couchePoints.on('popupclose', (e) => {
		//console.log('désinhibationnage du cul');
		inhiber = false;
	});
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
	//console.log(zoom);
	//console.log(bounds._northEast);
	//console.log(bounds._southWest);

	// ne charger que les points de la zone affichée, sauf la première fois
	if (premierChargement) {
		/*paramsPoints.ne = '85|180';
		paramsPoints.sw = '-85|-180';
		paramsPoints.zoom = 1;*/
		// conformité avec cartoPoint
		paramsPoints.ne = '64|178';
		paramsPoints.sw = '-64|-158';
		paramsPoints.zoom = 3;
	} else {
		paramsPoints.ne = ((bounds._northEast.lat % 90) || 90) + '|' + ((bounds._northEast.lng % 180) || 180);
		paramsPoints.sw = ((bounds._southWest.lat % 90) || 90) + '|' + ((bounds._southWest.lng % 180) || 180);
		paramsPoints.zoom = zoom;
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
			//console.log(data);

			// clear current markers
			couchePoints.clearLayers();

			// nombre de taxons
			// @TODO appeler le service taxons
			//var nombreTaxons = '?';
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
					// cliquer sur un cluster fait zoomer dessus (+2)
					$(marker).click((e) => {
						carte.setView([p.lat, p.lng], Math.min(MAXZOOM, zoom + 2));
					});
				} else {
					marker = L.marker([p.lat, p.lng]).addTo(couchePoints);
					// cliquer sur un marqueur affiche les infos de la station
					marker.bindPopup('chargement…', { autoPan: true, maxWidth: 450, maxHeight: 450 });
					$(marker).click((e) => {
						inhiber = true;
						chargerPopupStation(e, p);
					});
				}
			});
		
			// la première fois, ajuster la carte sans recharger les points
			if (premierChargement) {
				inhiberProchainDeplacement = true;
				//console.log('ajustement aux bornes:', couchePoints.getBounds());
				//console.log('infos bornes service:', data.stats.coordmax);
				//carte.fitBounds(couchePoints.getBounds());
				if (data.stats.coordmax.latMax && data.stats.coordmax.lngMax && data.stats.coordmax.latMin && data.stats.coordmax.lngMin) {
					carte.fitBounds([
						[data.stats.coordmax.latMax, data.stats.coordmax.lngMax],
						[data.stats.coordmax.latMin, data.stats.coordmax.lngMin]
					]);
				}
			}

			// hide waiting cursor
			$('#zone-chargement-point').hide();

			premierChargement = false;
		}
	});
}

function chargerPopupStation(e, point) {
	var popup = e.target.getPopup();
	var URLStation = config.serviceStationURL;
	var paramsStation = JSON.parse(JSON.stringify(paramsService)); // clone
	
	// ID station
	paramsStation.station = point.id;

	// chargement du popup s'il n'est pas déjà en cache
	if (! popup.cache) {
		$.get(URLStation, paramsStation, (data) => {
			//console.log(data);
			// construction du contenu du popup
			// @TODO utiliser un template handlebars plutôt que ce tas de vomi
			var contenu = '';
			contenu += '<div class="popup-obs">';
			var titre = (point.nom || data.commune).replace('()', '').trim();
			if (titre == '') {
				titre = 'station inconnue';
			}
			contenu += '<div class="titre-obs">' + titre + ' <span class="titre-obs-details">(' + data.observations.length + ')</span></div>';
			contenu += '<div class="liste-obs">';
			data.observations.forEach((o) => {
				contenu += '<div class="obs">';
				var image = 'pasdimagenb.png';
				if (o.images && o.images.length > 0) {
					image = o.images[0].miniature.replace('CXS', 'CRXS');
				}
				var baliseImage = '<img class="image-obs" src="' + image + '">';
				if (o.images && o.images.length > 0 && o.images[0].normale) {
					baliseImage = '<a href="' + o.images[0].normale + '" target="_blank">' + baliseImage + '</a>';
				}
				contenu += baliseImage;
				contenu += '<div class="details-obs">';
				var taxon = (o.nomSci || 'espèce inconnue');
				if (o.nn && o.nn != 0 && o.urlEflore) {
					taxon = '<a href="' + o.urlEflore + '" target="_blank">' + taxon + '</a>';
				}
				contenu += '<div class="taxon-obs">' + taxon + '</div>';
				contenu += '<div class="date-obs">' + (o.datePubli || 'date inconnue') + '</div>';
				contenu += '<div class="lieu-obs">' + (o.lieu || 'lieu inconnu') + '</div>';
				contenu += '<div class="auteur-obs">';
				var auteur = (o.observateur || 'auteur⋅e inconnu⋅e');
				if (o.observateurId && o.observateurId != 0) {
					auteur = '<a href="' + config.profilURL + o.observateurId + '" target="_blank">' + auteur + '</a>';
				}
				contenu += auteur;
				contenu += '</div>';
				contenu += '</div>'; // details-obs
				contenu += '</div>'; // obs
			});
			contenu += '</div>'; // liste-obs
			contenu += '</div>'; // popup-obs

			// fouzy
			popup.setContent(contenu);
			popup.update();
			// cache
			popup.cache = true;
		});
	} // else popup en cache
}

// copiée depuis Leaflet-MarkerCluster, utilisée manuellement pour dessiner les
// clusters calculés côté serveur
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
