import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Major BR city coords
const CITY_COORDS: Record<string, [number, number]> = {
  "São Paulo": [-23.5505, -46.6333],
  "Rio de Janeiro": [-22.9068, -43.1729],
  "Brasília": [-15.7975, -47.8919],
  "Salvador": [-12.9714, -38.5124],
  "Fortaleza": [-3.7172, -38.5433],
  "Belo Horizonte": [-19.9167, -43.9345],
  "Manaus": [-3.1190, -60.0217],
  "Curitiba": [-25.4284, -49.2733],
  "Recife": [-8.0476, -34.8770],
  "Porto Alegre": [-30.0346, -51.2177],
  "Belém": [-1.4558, -48.5024],
  "Goiânia": [-16.6869, -49.2648],
  "Campinas": [-22.9099, -47.0626],
  "Guarulhos": [-23.4538, -46.5333],
  "Florianópolis": [-27.5954, -48.5480],
  "Vitória": [-20.3155, -40.3128],
  "Natal": [-5.7945, -35.2110],
  "São Luís": [-2.5297, -44.2825],
  "Maceió": [-9.6498, -35.7089],
  "João Pessoa": [-7.1195, -34.8450],
  "Teresina": [-5.0892, -42.8019],
  "Campo Grande": [-20.4697, -54.6201],
  "Cuiabá": [-15.5989, -56.0949],
  "Aracaju": [-10.9091, -37.0677],
  "Londrina": [-23.3045, -51.1696],
  "Joinville": [-26.3044, -48.8487],
  "Ribeirão Preto": [-21.1704, -47.8103],
  "Uberlândia": [-18.9186, -48.2772],
  "Sorocaba": [-23.5015, -47.4526],
  "Santos": [-23.9608, -46.3336],
};

// State capital coords as fallback
const STATE_COORDS: Record<string, [number, number]> = {
  AC: [-9.97, -67.81], AL: [-9.65, -35.73], AP: [0.034, -51.07],
  AM: [-3.12, -60.02], BA: [-12.97, -38.51], CE: [-3.72, -38.54],
  DF: [-15.80, -47.89], ES: [-20.32, -40.31], GO: [-16.69, -49.26],
  MA: [-2.53, -44.28], MT: [-15.60, -56.10], MS: [-20.47, -54.62],
  MG: [-19.92, -43.93], PA: [-1.46, -48.50], PB: [-7.12, -34.85],
  PR: [-25.43, -49.27], PE: [-8.05, -34.88], PI: [-5.09, -42.80],
  RJ: [-22.91, -43.17], RN: [-5.79, -35.21], RS: [-30.03, -51.22],
  RO: [-8.76, -63.90], RR: [2.82, -60.67], SC: [-27.60, -48.55],
  SP: [-23.55, -46.63], SE: [-10.91, -37.07], TO: [-10.18, -48.33],
};

interface Props {
  cityDistribution: Record<string, { count: number; state: string }>;
}

const AdminGeoMap = ({ cityDistribution }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current).setView([-14.235, -51.9253], 4);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Add circle markers for each city
    Object.entries(cityDistribution).forEach(([key, { count, state }]) => {
      const city = key.split("|")[0];
      const coords = CITY_COORDS[city] || STATE_COORDS[state];
      if (!coords) return;

      const radius = Math.max(8, Math.min(30, Math.sqrt(count) * 5));

      L.circleMarker(coords, {
        radius,
        fillColor: "hsl(220, 90%, 56%)",
        color: "hsl(220, 90%, 40%)",
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.5,
      })
        .addTo(map)
        .bindPopup(`<strong>${city}, ${state}</strong><br/>${count} usuário(s)`);
    });
  }, [cityDistribution]);

  return <div ref={mapRef} className="h-[400px] rounded-lg" />;
};

export default AdminGeoMap;
