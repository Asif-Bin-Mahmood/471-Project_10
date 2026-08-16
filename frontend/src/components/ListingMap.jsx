import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Member 1 - Module 1
// One Leaflet map is used for both commercial properties and service providers.
// P = property, S = service, circle = searched area.

const DHAKA_CENTER = [23.8103, 90.4125];

function isValidCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function hasValidLocation(listing) {
  return (
    isValidCoordinate(listing?.location?.lat, -90, 90) &&
    isValidCoordinate(listing?.location?.lng, -180, 180)
  );
}

function hasValidSearchLocation(location) {
  return (
    isValidCoordinate(location?.lat, -90, 90) &&
    isValidCoordinate(location?.lng, -180, 180)
  );
}

function createListingPopup(listing) {
  const popup = document.createElement("div");
  popup.className = "listing-map-popup";

  const title = document.createElement("strong");
  title.textContent = listing.title || "OfficeKhoj listing";

  const type = document.createElement("span");
  type.textContent = listing.listingType === "service"
    ? `Service - ${listing.category}`
    : `Commercial space - ${listing.category}`;

  const area = document.createElement("span");
  area.textContent = listing.area || "Bangladesh";

  const address = document.createElement("p");
  address.textContent = listing.address || "Address not available";

  const meta = document.createElement("small");
  const price = Number(listing.price || 0).toLocaleString("en-BD");
  const rating = Number(listing.rating || 0).toFixed(1);
  const distance = listing.searchDistanceKm !== undefined
    ? ` - ${Number(listing.searchDistanceKm).toFixed(2)} km away`
    : "";
  meta.textContent = `BDT ${price} - ${rating}/5${distance}`;

  popup.append(title, type, area, address, meta);
  return popup;
}

function createListingIcon(listingType) {
  const markerType = listingType === "service" ? "service" : "property";
  const letter = markerType === "service" ? "S" : "P";

  return L.divIcon({
    className: `listing-map-pin ${markerType}`,
    html: `<span><b>${letter}</b></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38]
  });
}

export default function ListingMap({ listings = [], searchLocation = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  const validListings = useMemo(
    () => listings.filter(hasValidLocation),
    [listings]
  );

  const skippedCount = listings.length - validListings.length;
  const searchedArea = hasValidSearchLocation(searchLocation) ? searchLocation : null;

  // Create the Leaflet map only once.
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

    // Leaflet sometimes needs a size refresh when its parent layout changes.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    resizeObserver.observe(containerRef.current);
    const frame = window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  // Redraw markers whenever the search results change.
  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    const visiblePoints = [];

    // Searched area marker.
    if (searchedArea) {
      const point = [Number(searchedArea.lat), Number(searchedArea.lng)];

      L.circleMarker(point, {
        radius: 9,
        weight: 3,
        fillOpacity: 0.2,
        className: "search-area-marker"
      })
        .bindTooltip(searchedArea.displayName || searchedArea.area || "Searched area", {
          direction: "top",
          offset: [0, -8]
        })
        .addTo(markerLayer);

      visiblePoints.push(point);
    }

    // Property and service result markers.
    for (const listing of validListings) {
      const lat = Number(listing.location.lat);
      const lng = Number(listing.location.lng);
      const markerType = listing.listingType === "service" ? "service" : "property";

      const marker = L.marker([lat, lng], {
        title: listing.title || "OfficeKhoj listing",
        alt: `${markerType} result: ${listing.title || "OfficeKhoj listing"}`,
        icon: createListingIcon(listing.listingType)
      });

      marker.bindPopup(createListingPopup(listing), { maxWidth: 280 });
      marker.addTo(markerLayer);
      visiblePoints.push([lat, lng]);
    }

    // Automatically move/zoom the map so all current results are visible.
    if (visiblePoints.length === 1) {
      map.setView(visiblePoints[0], 14, { animate: false });
    } else if (visiblePoints.length > 1) {
      map.fitBounds(visiblePoints, {
        padding: [36, 36],
        maxZoom: 14,
        animate: false
      });
    } else {
      map.setView(DHAKA_CENTER, 12, { animate: false });
    }

    window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));
  }, [validListings, searchedArea?.lat, searchedArea?.lng, searchedArea?.displayName]);

  return (
    <div className="city-map real-city-map">
      <div
        ref={containerRef}
        className="leaflet-map"
        aria-label="Interactive map of commercial spaces and service providers"
      />

      <div className="map-legend" aria-label="Map marker legend">
        <span><i className="property" />Property pin</span>
        <span><i className="service" />Service pin</span>
        <span><i className="search" />Searched area</span>
      </div>

      <div className="map-source-note">
        Map data & search: OpenStreetMap / Nominatim
      </div>

      {skippedCount > 0 && (
        <p className="map-coordinate-note">
          {skippedCount} listing{skippedCount === 1 ? "" : "s"} omitted: coordinates unavailable.
        </p>
      )}
    </div>
  );
}
