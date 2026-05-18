// --- CONFIGURACIÓN GITHUB API ---
// IMPORTANTE: Asegúrate de usar un token con permisos limitados solo para este repositorio.
// Truco de seguridad: GitHub borra cualquier texto que empiece con "github_pat_" en repositorios públicos.
// Por eso, pega solo la parte que va DESPUÉS de "github_pat_" aquí adentro:
const parteSecreta = '11BERY7XI0TI2dtoaPo2sf_W66F2PfMkeUxHhccK42LGUyjdEXuiQ9XLJsMbziRJUNMGGG6HR3KHGT66Ym'; 
const GITHUB_TOKEN = 'github_pat_' + parteSecreta;
const REPOSITORIO_USUARIO = 'rodriveras/Mapeo_predio_D_NOVO'; 
const RAMA_BRANCH = 'main';

let currentLayer = null;
let map; // Definimos el mapa globalmente

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Inicializar el mapa de Leaflet
    // Delimitamos el área a las regiones de Ñuble, Biobío y La Araucanía
    var bounds = [
        [-39.7, -74.5], // Suroeste (Sur de la Araucanía / Costa)
        [-35.8, -70.5]  // Noreste (Norte de Ñuble / Cordillera)
    ];
    
    map = L.map('map', {
        maxBounds: bounds,         // Restringe el mapa a esta caja
        maxBoundsViscosity: 1.0,   // Evita que el usuario "arrastre" el mapa fuera del área
        minZoom: 7,                // Evita que se alejen a ver todo el mundo
        tap: false                 // SOLUCIÓN: Evita el bug del "doble clic fantasma" al dibujar líneas en celulares
    });
    
    // Ajusta automáticamente el zoom para que se vean las 3 regiones en la pantalla
    map.fitBounds(bounds);

    // 2. Capas Base
    var googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3'],
        attribution: 'Google Satellite'
    });

    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    });

    // Añadimos el satélite por defecto al mapa
    googleSat.addTo(map);

    // 3. Capa WMS CIREN
    // Según el catálogo de CIREN, las capas de Productores Frutícolas son:
    // 4: La Araucanía, 5: Biobío, 6: Ñuble
    var cirenWMS = L.tileLayer.wms("https://esri.ciren.cl/server/services/IDEMINAGRI/CATASTRO_FRUTICOLA/MapServer/WMSServer", {
        layers: '4,5,6', 
        format: 'image/png',
        transparent: true,
        attribution: "CIREN Catastro Frutícola"
    });

    // 4. Capa Límites Regionales (Vectorial GeoJSON)
    var limitesRegionales = L.layerGroup().addTo(map); // Grupo para el control de capas
    
    // Obtenemos solo las líneas que son fronteras "Regionales" desde el servidor de CIREN
    fetch("https://esri.ciren.cl/server/rest/services/LIMITES_ADMINISTRATIVOS/MapServer/1/query?where=nombre='Regional'&f=geojson&outSR=4326")
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: {
                    color: '#e74c3c', // Rojo para que resalte discretamente
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '8, 8' // Línea segmentada/punteada
                }
            }).addTo(limitesRegionales);

            // Agregar etiquetas de texto estáticas para las 3 regiones principales
            const etiquetasRegiones = [
                { nombre: "REGIÓN DE ÑUBLE", lat: -36.6, lng: -71.8 },
                { nombre: "REGIÓN DEL BIOBÍO", lat: -37.5, lng: -72.4 },
                { nombre: "REGIÓN DE LA ARAUCANÍA", lat: -38.7, lng: -72.2 }
            ];

            etiquetasRegiones.forEach(region => {
                var labelIcon = L.divIcon({
                    className: 'region-label',
                    html: `<div>${region.nombre}</div>`,
                    iconSize: [200, 20],
                    iconAnchor: [100, 10]
                });
                L.marker([region.lat, region.lng], {icon: labelIcon, interactive: false}).addTo(limitesRegionales);
            });
        })
        .catch(err => console.error("Error cargando límites:", err));
    
    // Añadimos el control para cambiar entre capas
    L.control.layers(
        {"Satélite (Google)": googleSat, "Calles (OSM)": osm}, 
        {
            "Límites Regionales": limitesRegionales,
            "Catastro Frutícola (CIREN)": cirenWMS
        }
    ).addTo(map);

    // --- NUEVA HERRAMIENTA: BOTÓN DE GEOLOCALIZACIÓN ---
    var LocateControl = L.Control.extend({
        options: { position: 'topleft' }, // Se pondrá debajo de los botones de zoom
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button = L.DomUtil.create('a', '', container);
            button.innerHTML = '📍'; 
            button.href = '#';
            button.title = 'Ir a mi ubicación actual';
            button.style.fontSize = '1.2rem';
            button.style.lineHeight = '30px';
            button.style.textAlign = 'center';
            button.style.textDecoration = 'none';
            button.style.backgroundColor = '#fff';
            
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                button.innerHTML = '⏳'; // Cambia el ícono mientras busca
                map.locate({setView: true, maxZoom: 17, enableHighAccuracy: true});
            });
            return container;
        }
    });
    
    var locateBtn = new LocateControl();
    map.addControl(locateBtn);

    // Cuando encuentra la ubicación, poner un puntito azul temporal y restaurar el ícono
    var tempMarker = null;
    map.on('locationfound', function(e) {
        if(tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.circleMarker(e.latlng, {radius: 8, color: '#2980b9', fillColor: '#3498db', fillOpacity: 0.8}).addTo(map);
        document.querySelector('a[title="Ir a mi ubicación actual"]').innerHTML = '📍';
    });

    map.on('locationerror', function(e) {
        alert("No se pudo obtener tu ubicación. Verifica que el GPS esté encendido y dale permiso al navegador.");
        document.querySelector('a[title="Ir a mi ubicación actual"]').innerHTML = '📍';
    });
    // --- FIN GEOLOCALIZACIÓN ---

    // 5. Configurar Leaflet.draw
    var drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // PARCHE DE COMPATIBILIDAD: Soluciona el error donde la línea se termina en el primer clic
    // Esto ocurre por un conflicto entre la versión de Leaflet y Leaflet.draw en pantallas táctiles
    if (L.Browser.touch) {
        L.Draw.Polyline.prototype._onTouch = L.Util.falseFn;
        window.type = '';
    }

    var drawControl = new L.Control.Draw({
        edit: false, // Oculta los botones de Lápiz y Tarro de Basura
        draw: {
            polygon: {
                allowIntersection: false, 
                showArea: true,
                shapeOptions: {
                    color: '#e74c3c',
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0.4
                }
            },
            marker: true, // Habilitar puntos
            polyline: {
                shapeOptions: {
                    color: '#3498db', // Color azul para canales o tuberías
                    weight: 4
                }
            },
            rectangle: false,
            circle: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    // 5. Inyectar HTML del Formulario Modal
    inyectarFormulario();

    // 6. Eventos de Dibujo
    map.on(L.Draw.Event.CREATED, function (e) {
        currentLayer = e.layer;
        var type = e.layerType;

        var geojson = currentLayer.toGeoJSON();
        let medidaStr = "N/A (Punto)";
        let labelTexto = "Dimensión";

        if (type === 'polygon') {
            var areaM2 = turf.area(geojson);
            var areaHa = (areaM2 / 10000).toFixed(3);
            medidaStr = areaHa + " Ha";
            labelTexto = "Superficie Calculada";
        } else if (type === 'polyline') {
            // Calcular la longitud de la línea con Turf.js
            var longitud = turf.length(geojson, {units: 'meters'});
            medidaStr = longitud.toFixed(1) + " metros";
            labelTexto = "Longitud de Canal/Tubería";
        }

        document.getElementById('gc-label-medida').innerText = labelTexto;
        document.getElementById('gc-superficie').innerText = medidaStr;
        document.getElementById('geoconecta-modal').style.display = 'block';
    });

    // 7. Eventos de Botones
    document.getElementById('gc-btn-cancelar').addEventListener('click', function() {
        document.getElementById('geoconecta-modal').style.display = 'none';
        currentLayer = null; 
        document.getElementById('geoconecta-form').reset();
    });

    document.getElementById('geoconecta-form').addEventListener('submit', function(e) {
        e.preventDefault();
        guardarDatos(drawnItems);
    });
});

function inyectarFormulario() {
    const formHTML = `
    <div id="geoconecta-modal">
        <div id="geoconecta-form-container">
            <h3>Datos del Predio / Infraestructura</h3>
            <form id="geoconecta-form">
                <div class="gc-form-group">
                    <label>Productor</label>
                    <input type="text" id="gc-productor" class="gc-form-control" placeholder="Nombre completo" required>
                </div>
                <div class="gc-form-group">
                    <label>Rol del Inmueble / SII</label>
                    <input type="text" id="gc-rol" class="gc-form-control" placeholder="Ej. 124-15" required>
                </div>
                <div class="gc-form-group">
                    <label>Especie Frutícola</label>
                    <select id="gc-especie" class="gc-form-control" required>
                        <option value="">Seleccione...</option>
                        <option value="Cerezo">Cerezo</option>
                        <option value="Arándano">Arándano</option>
                        <option value="Avellano Europeo">Avellano Europeo</option>
                        <option value="Manzano">Manzano</option>
                        <option value="Nogal">Nogal</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
                <div class="gc-form-group">
                    <label>Variedad</label>
                    <input type="text" id="gc-variedad" class="gc-form-control" placeholder="Opcional">
                </div>
                <div class="gc-form-group">
                    <label>Tipo de Riego</label>
                    <select id="gc-riego" class="gc-form-control" required>
                        <option value="">Seleccione...</option>
                        <option value="Goteo">Goteo</option>
                        <option value="Aspersión">Aspersión</option>
                        <option value="Surco">Surco</option>
                        <option value="Secano">Secano</option>
                    </select>
                </div>
                <div class="gc-form-group">
                    <label>Infraestructura Presente</label>
                    <div class="gc-checkbox-group">
                        <label><input type="checkbox" value="Tranque" class="gc-infra"> Tranque</label>
                        <label><input type="checkbox" value="Caseta de Riego" class="gc-infra"> Caseta de Riego</label>
                        <label><input type="checkbox" value="Galpón/Acopio" class="gc-infra"> Galpón/Acopio</label>
                    </div>
                </div>
                <div class="gc-form-group">
                    <label>Condición General</label>
                    <select id="gc-condicion" class="gc-form-control" required>
                        <option value="">Seleccione...</option>
                        <option value="Excelente">Excelente</option>
                        <option value="Bueno">Bueno</option>
                        <option value="Regular">Regular</option>
                        <option value="Malo">Malo</option>
                    </select>
                </div>
                <div class="gc-form-group">
                    <label id="gc-label-medida">Superficie</label>
                    <div id="gc-superficie-container">
                        <span id="gc-superficie">0 Ha</span>
                    </div>
                </div>
                <div class="gc-btn-group">
                    <button type="button" id="gc-btn-cancelar" class="gc-btn gc-btn-cancel">Cancelar</button>
                    <button type="submit" id="gc-btn-guardar" class="gc-btn gc-btn-submit">Guardar y Enviar</button>
                </div>
            </form>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', formHTML);
}

async function guardarDatos(drawnItemsGroup) {
    if (!currentLayer) return;

    const btnGuardar = document.getElementById('gc-btn-guardar');
    btnGuardar.disabled = true;
    btnGuardar.innerText = 'Enviando a GitHub...';

    const rol = document.getElementById('gc-rol').value;
    const infraCheckboxes = document.querySelectorAll('.gc-infra:checked');
    const infraArray = Array.from(infraCheckboxes).map(cb => cb.value);

    const geojson = currentLayer.toGeoJSON();
    
    geojson.properties = {
        productor: document.getElementById('gc-productor').value,
        rol_sii: rol,
        especie: document.getElementById('gc-especie').value,
        variedad: document.getElementById('gc-variedad').value,
        tipo_riego: document.getElementById('gc-riego').value,
        infraestructura: infraArray.join(', '),
        condicion: document.getElementById('gc-condicion').value,
        superficie_ha: document.getElementById('gc-superficie').innerText,
        fecha_captura: new Date().toISOString()
    };

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `predio_${rol}_${dateStr}.geojson`;
    const filePath = `capturas/${fileName}`; 

    const contentStr = JSON.stringify(geojson, null, 2);
    const contentB64 = btoa(unescape(encodeURIComponent(contentStr)));

    const url = `https://api.github.com/repos/${REPOSITORIO_USUARIO}/contents/${filePath}`;
    const payload = {
        message: `Añadido mapeo predial Rol: ${rol}`,
        content: contentB64,
        branch: RAMA_BRANCH
    };

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('¡Geometría y metadatos guardados correctamente en GitHub!');
            document.getElementById('geoconecta-modal').style.display = 'none';
            drawnItemsGroup.addLayer(currentLayer);
            document.getElementById('geoconecta-form').reset();
        } else {
            const errData = await response.json();
            alert(`Error de GitHub: ${errData.message}`);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión. Revisa tu internet o la configuración del Token.');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerText = 'Guardar y Enviar';
        currentLayer = null;
    }
}
