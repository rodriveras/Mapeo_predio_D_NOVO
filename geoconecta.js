// --- CONFIGURACIÓN GITHUB API ---
// IMPORTANTE: Asegúrate de usar un token con permisos limitados solo para este repositorio.
const GITHUB_TOKEN = 'TU_TOKEN_DE_GITHUB_AQUI'; // <- ¡Pega el token largo aquí!
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
        minZoom: 7                 // Evita que se alejen a ver todo el mundo
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
    
    // Añadimos el control para cambiar entre capas
    L.control.layers(
        {"Satélite (Google)": googleSat, "Calles (OSM)": osm}, 
        {"Catastro Frutícola (CIREN)": cirenWMS}
    ).addTo(map);

    // 4. Configurar Leaflet.draw
    var drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    var drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
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
            polyline: false,
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

        let areaStr = "N/A (Punto)";
        if (type === 'polygon') {
            var geojson = currentLayer.toGeoJSON();
            var areaM2 = turf.area(geojson);
            var areaHa = (areaM2 / 10000).toFixed(3);
            areaStr = areaHa + " Ha";
        }

        document.getElementById('gc-superficie').innerText = areaStr;
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
                    <label>Superficie</label>
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
