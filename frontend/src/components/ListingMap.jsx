import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DHAKA_CENTER = [23.8103, 90.4125];

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function hasValidLocation(listing) {
  return validCoordinate(listing?.location?.lat, -90, 90) &&
    validCoordinate(listing?.location?.lng, -180, 180);
}

function popupContent(listing) {
  const content = document.createElement("div");
  content.className = "listing-map-popup";

  const title = document.createElement("strong");
  title.textContent = listing.title || "OfficeKhoj listing";

  const area = document.createElement("span");
  area.textContent = listing.area || "Dhaka";

  const address = document.createElement("p");
  address.textContent = listing.address || "Address not available";

  content.append(title, area, address);
  return content;
}

export default function ListingMap({ listings = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  const validListings = useMemo(() => listings.filter(hasValidLocation), [listings]);
  const skippedCount = listings.length - validListings.length;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: DHAKA_CENTER,
      zoom: 12,
      minZoom: 8,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    resizeObserver.observe(containerRef.current);
    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    const bounds = [];

    validListings.forEach((listing) => {
      const lat = Number(listing.location.lat);
      const lng = Number(listing.location.lng);
      const markerType = listing.listingType === "service" ? "service" : "property";
      const marker = L.marker([lat, lng], {
        title: listing.title || "OfficeKhoj listing",
        alt: listing.title || "OfficeKhoj listing",
        icon: L.divIcon({
          className: `listing-map-pin ${markerType}`,
          html: `<span><b>${markerType === "service" ? "S" : "P"}</b></span>`,
          iconSize: [34, 42],
          iconAnchor: [17, 42],
          popupAnchor: [0, -38]
        })
      });

      marker.bindPopup(popupContent(listing), { maxWidth: 260 });
      marker.addTo(markerLayer);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 14, { animate: false });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14, animate: false });
    } else {
      map.setView(DHAKA_CENTER, 12, { animate: false });
    }

    window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));
  }, [validListings]);

  return (
    <div className="city-map real-city-map">
      <div ref={containerRef} className="leaflet-map" aria-label="Interactive map of Dhaka listings" />
      <div className="map-legend" aria-label="Map marker legend">
        <span><i className="property" />Property</span>
        <span><i className="service" />Service</span>
      </div>
      {skippedCount > 0 && (
        <p className="map-coordinate-note">{skippedCount} listing{skippedCount === 1 ? "" : "s"} omitted: coordinates unavailable.</p>
      )}
    </div>
  );
}
