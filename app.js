const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEO_API = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

const CITY_ALIASES = {
  서울: "Seoul",
  부산: "Busan",
  대구: "Daegu",
  인천: "Incheon",
  광주: "Gwangju",
  대전: "Daejeon",
  울산: "Ulsan",
  세종: "Sejong",
  제주: "Jeju",
  수원: "Suwon",
  도쿄: "Tokyo",
  오사카: "Osaka",
  베이징: "Beijing",
  상하이: "Shanghai",
  뉴욕: "New York",
  런던: "London",
  파리: "Paris",
  베를린: "Berlin",
  시드니: "Sydney",
  싱가포르: "Singapore",
  방콕: "Bangkok",
  로마: "Rome",
  마드리드: "Madrid",
  모스크바: "Moscow",
  두바이: "Dubai",
  홍콩: "Hong Kong",
  타이베이: "Taipei",
  하노이: "Hanoi",
  자카르타: "Jakarta",
  뭄바이: "Mumbai",
  카이로: "Cairo",
  리우데자네이루: "Rio de Janeiro",
};

const WMO_CODES = {
  0: { desc: "맑음", icon: "☀️" },
  1: { desc: "대체로 맑음", icon: "🌤️" },
  2: { desc: "부분적으로 흐림", icon: "⛅" },
  3: { desc: "흐림", icon: "☁️" },
  45: { desc: "안개", icon: "🌫️" },
  48: { desc: "서리 안개", icon: "🌫️" },
  51: { desc: "이슬비", icon: "🌦️" },
  53: { desc: "이슬비", icon: "🌦️" },
  55: { desc: "이슬비", icon: "🌦️" },
  61: { desc: "약한 비", icon: "🌧️" },
  63: { desc: "비", icon: "🌧️" },
  65: { desc: "강한 비", icon: "🌧️" },
  71: { desc: "약한 눈", icon: "🌨️" },
  73: { desc: "눈", icon: "🌨️" },
  75: { desc: "강한 눈", icon: "🌨️" },
  77: { desc: "진눈깨비", icon: "🌨️" },
  80: { desc: "소나기", icon: "🌦️" },
  81: { desc: "소나기", icon: "🌦️" },
  82: { desc: "강한 소나기", icon: "⛈️" },
  85: { desc: "눈 소나기", icon: "🌨️" },
  86: { desc: "강한 눈 소나기", icon: "🌨️" },
  95: { desc: "뇌우", icon: "⛈️" },
  96: { desc: "우박 뇌우", icon: "⛈️" },
  99: { desc: "강한 우박 뇌우", icon: "⛈️" },
};

const els = {
  searchForm: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  locationBtn: document.getElementById("locationBtn"),
  unitToggle: document.getElementById("unitToggle"),
  unitLabelC: document.getElementById("unitLabelC"),
  unitLabelF: document.getElementById("unitLabelF"),
  weatherCard: document.getElementById("weatherCard"),
  emptyState: document.getElementById("emptyState"),
  errorMessage: document.getElementById("errorMessage"),
  cityName: document.getElementById("cityName"),
  countryName: document.getElementById("countryName"),
  weatherIcon: document.getElementById("weatherIcon"),
  temperature: document.getElementById("temperature"),
  weatherDesc: document.getElementById("weatherDesc"),
  feelsLike: document.getElementById("feelsLike"),
  humidity: document.getElementById("humidity"),
  windSpeed: document.getElementById("windSpeed"),
  highLow: document.getElementById("highLow"),
  mapModal: document.getElementById("mapModal"),
  mapModalBackdrop: document.getElementById("mapModalBackdrop"),
  mapModalClose: document.getElementById("mapModalClose"),
  mapCancelBtn: document.getElementById("mapCancelBtn"),
  mapConfirmBtn: document.getElementById("mapConfirmBtn"),
  mapGpsBtn: document.getElementById("mapGpsBtn"),
  mapSelectedLabel: document.getElementById("mapSelectedLabel"),
  locationMap: document.getElementById("locationMap"),
};

let currentWeather = null;
let isFahrenheit = false;
let debounceTimer = null;
let searchRequestId = 0;

let leafletMap = null;
let mapMarker = null;
let selectedMapCoords = null;
let mapGeocodeRequestId = 0;

const DEBOUNCE_MS = 500;
const DEFAULT_MAP_CENTER = [36.5, 127.5];
const DEFAULT_MAP_ZOOM = 7;

function showError(message) {
  els.errorMessage.textContent = message;
  els.errorMessage.hidden = !message;
}

function updateUnitLabels() {
  els.unitLabelC.classList.toggle("active", !isFahrenheit);
  els.unitLabelF.classList.toggle("active", isFahrenheit);
}

function toDisplayTemp(celsius) {
  if (celsius == null) return "—";
  const value = isFahrenheit ? celsius * 9 / 5 + 32 : celsius;
  const unit = isFahrenheit ? "°F" : "°C";
  return `${Math.round(value)}${unit}`;
}

function getWeatherInfo(code) {
  return WMO_CODES[code] ?? { desc: "알 수 없음", icon: "🌡️" };
}

/** 입력한 도시의 좌표를 찾습니다 */
function resolveSearchQuery(query) {
  const trimmed = query.trim();
  return CITY_ALIASES[trimmed] ?? trimmed;
}

async function geocodeCity(query) {
  const searchTerm = resolveSearchQuery(query);
  const params = new URLSearchParams({ name: searchTerm, count: 1, language: "ko" });
  const res = await fetch(`${GEO_API}?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.results?.length) return null;

  const place = data.results[0];
  const displayName = CITY_ALIASES[query.trim()] ? query.trim() : place.name;
  return {
    lat: place.latitude,
    lon: place.longitude,
    name: displayName,
    country: place.country,
    admin1: place.admin1,
  };
}

/** 좌표로 날씨 API를 호출합니다 */
async function fetchWeatherData(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });

  const res = await fetch(`${WEATHER_API}?${params}`);
  if (!res.ok) throw new Error("날씨 정보를 불러오지 못했습니다.");
  return res.json();
}

/** 입력한 도시의 날씨를 찾아 이름·온도·설명·아이콘 데이터로 반환합니다 */
async function findCityWeather(cityInput) {
  const query = cityInput.trim();
  if (!query) throw new Error("도시 이름을 입력해 주세요.");

  const place = await geocodeCity(query);
  if (!place) throw new Error(`"${query}"에 해당하는 도시를 찾을 수 없습니다.`);

  const data = await fetchWeatherData(place.lat, place.lon);
  const info = getWeatherInfo(data.current.weather_code);

  return {
    name: place.name,
    country: place.country,
    admin1: place.admin1,
    temperature: toDisplayTemp(data.current.temperature_2m),
    description: info.desc,
    icon: info.icon,
    raw: {
      location: place,
      current: data.current,
      daily: data.daily,
    },
  };
}

/** 이름, 온도, 설명, 아이콘을 화면에 표시합니다 */
function displayCityWeather(weather) {
  els.cityName.textContent = weather.name;
  els.countryName.textContent = [weather.admin1, weather.country].filter(Boolean).join(", ");
  els.weatherIcon.textContent = weather.icon;
  els.temperature.textContent = weather.temperature;
  els.weatherDesc.textContent = weather.description;

  els.weatherCard.hidden = false;
  els.emptyState.hidden = true;
}

function renderWeatherDetails() {
  if (!currentWeather) return;

  const { current, daily } = currentWeather;
  els.feelsLike.textContent = toDisplayTemp(current.apparent_temperature);
  els.humidity.textContent = current.relative_humidity_2m != null ? `${current.relative_humidity_2m}%` : "—";
  els.windSpeed.textContent = current.wind_speed_10m != null ? `${Math.round(current.wind_speed_10m)} km/h` : "—";
  els.highLow.textContent = `${toDisplayTemp(daily.temperature_2m_max[0])} / ${toDisplayTemp(daily.temperature_2m_min[0])}`;
}

function setLoading(isLoading) {
  const btn = els.searchForm.querySelector('button[type="submit"]');
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "검색 중…" : "검색";
}

async function searchCity(city) {
  const requestId = ++searchRequestId;
  setLoading(true);
  showError("");

  try {
    const weather = await findCityWeather(city);
    if (requestId !== searchRequestId) return;

    currentWeather = weather.raw;
    displayCityWeather(weather);
    renderWeatherDetails();
  } catch (err) {
    if (requestId !== searchRequestId) return;

    if (err.message.includes("입력해") || err.message.includes("찾을 수 없")) {
      showError(err.message);
    } else {
      showError("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  } finally {
    if (requestId === searchRequestId) setLoading(false);
  }
}

function scheduleDebouncedSearch(city) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = city.trim();
    if (!query) return;
    searchCity(query);
  }, DEBOUNCE_MS);
}

async function fetchWeatherByCoords(lat, lon, locationInfo = {}) {
  const data = await fetchWeatherData(lat, lon);
  const info = getWeatherInfo(data.current.weather_code);

  const location = { ...locationInfo, lat, lon };
  currentWeather = {
    location,
    current: data.current,
    daily: data.daily,
  };

  displayCityWeather({
    name: locationInfo.name ?? "—",
    country: locationInfo.country ?? "",
    admin1: locationInfo.admin1 ?? "",
    temperature: toDisplayTemp(data.current.temperature_2m),
    description: info.desc,
    icon: info.icon,
  });
  renderWeatherDetails();
}

/** 역지오코딩 결과로 지역명 정보를 만듭니다 */
function buildLocationInfo(place, lat, lon) {
  if (!place) {
    const coords = `위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)}`;
    return {
      name: coords,
      country: "",
      admin1: "",
      regionLabel: coords,
    };
  }

  const name = place.name;
  const country = place.country ?? "";
  const admin1 = place.admin1 ?? "";
  const regionParts = [admin1, country].filter(Boolean);
  const uniqueRegion = regionParts.filter((part) => part !== name);
  const regionLabel = uniqueRegion.length
    ? `${name}, ${uniqueRegion.join(", ")}`
    : name;

  return { name, country, admin1, regionLabel };
}

/** GPS 좌표로 지역명을 조회합니다 */
async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    localityLanguage: "ko",
  });

  try {
    const res = await fetch(`${REVERSE_GEO_API}?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    const name = data.locality || data.city || data.principalSubdivision;
    if (!name) return null;

    return {
      name,
      country: data.countryName ?? "",
      admin1: data.principalSubdivision ?? "",
    };
  } catch {
    return null;
  }
}

async function resolveMapLocationInfo(lat, lon, existing = {}) {
  if (existing.placeName && existing.regionLabel) {
    return {
      name: existing.placeName,
      country: existing.country ?? "",
      admin1: existing.admin1 ?? "",
      regionLabel: existing.regionLabel,
    };
  }

  const place = await reverseGeocode(lat, lon);
  return buildLocationInfo(place, lat, lon);
}

/** 브라우저 GPS로 현재 좌표를 가져옵니다 */
function getGpsPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function getGeolocationErrorMessage(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해 주세요.";
    case error.POSITION_UNAVAILABLE:
      return "GPS 위치를 가져올 수 없습니다.";
    case error.TIMEOUT:
      return "GPS 응답 시간이 초과되었습니다. 다시 시도해 주세요.";
    default:
      return "위치를 가져오는 중 오류가 발생했습니다.";
  }
}

function initLocationMap() {
  if (leafletMap) return;

  leafletMap = L.map(els.locationMap, {
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_MAP_ZOOM,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(leafletMap);

  leafletMap.on("click", (e) => {
    selectMapLocation(e.latlng.lat, e.latlng.lng);
  });
}

function updateMapSelectedLabel(text) {
  els.mapSelectedLabel.innerHTML = text;
}

async function selectMapLocation(lat, lon) {
  const requestId = ++mapGeocodeRequestId;
  selectedMapCoords = { lat, lon };
  els.mapConfirmBtn.disabled = true;

  if (mapMarker) {
    mapMarker.setLatLng([lat, lon]);
  } else {
    mapMarker = L.marker([lat, lon], { draggable: true }).addTo(leafletMap);
    mapMarker.on("dragend", () => {
      const { lat: markerLat, lng: markerLon } = mapMarker.getLatLng();
      selectMapLocation(markerLat, markerLon);
    });
  }

  updateMapSelectedLabel("선택한 위치: <strong>지역명 확인 중…</strong>");

  try {
    const place = await reverseGeocode(lat, lon);
    if (requestId !== mapGeocodeRequestId) return;

    const locationInfo = buildLocationInfo(place, lat, lon);
    selectedMapCoords.placeName = locationInfo.name;
    selectedMapCoords.country = locationInfo.country;
    selectedMapCoords.admin1 = locationInfo.admin1;
    selectedMapCoords.regionLabel = locationInfo.regionLabel;

    mapMarker.bindPopup(`<strong>${locationInfo.regionLabel}</strong>`).openPopup();
    updateMapSelectedLabel(`선택한 위치: <strong>${locationInfo.regionLabel}</strong>`);
    els.mapConfirmBtn.disabled = false;
  } catch {
    if (requestId !== mapGeocodeRequestId) return;

    const locationInfo = buildLocationInfo(null, lat, lon);
    selectedMapCoords.placeName = locationInfo.name;
    selectedMapCoords.country = locationInfo.country;
    selectedMapCoords.admin1 = locationInfo.admin1;
    selectedMapCoords.regionLabel = locationInfo.regionLabel;

    updateMapSelectedLabel(`선택한 위치: <strong>${locationInfo.regionLabel}</strong>`);
    els.mapConfirmBtn.disabled = false;
  }
}

function openLocationMapModal() {
  clearTimeout(debounceTimer);
  showError("");
  els.mapModal.hidden = false;
  els.mapConfirmBtn.disabled = true;
  selectedMapCoords = null;
  updateMapSelectedLabel("선택한 위치: 지도를 클릭해 주세요");

  requestAnimationFrame(() => {
    initLocationMap();
    leafletMap.invalidateSize();

    if (currentWeather?.location?.lat != null) {
      const { lat, lon } = currentWeather.location;
      leafletMap.setView([lat, lon], 10);
      selectMapLocation(lat, lon);
    } else {
      leafletMap.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      if (mapMarker) {
        leafletMap.removeLayer(mapMarker);
        mapMarker = null;
      }
    }
  });
}

function closeLocationMapModal() {
  els.mapModal.hidden = true;
}

async function moveMapToGps() {
  if (!navigator.geolocation) {
    showError("이 브라우저는 GPS 위치 서비스를 지원하지 않습니다.");
    return;
  }

  els.mapGpsBtn.disabled = true;
  els.mapGpsBtn.textContent = "GPS 확인 중…";

  try {
    const pos = await getGpsPosition();
    const { latitude, longitude } = pos.coords;
    leafletMap.setView([latitude, longitude], 12);
    await selectMapLocation(latitude, longitude);
  } catch (err) {
    showError(getGeolocationErrorMessage(err));
  } finally {
    els.mapGpsBtn.disabled = false;
    els.mapGpsBtn.textContent = "내 GPS 위치";
  }
}

async function confirmMapSelection() {
  if (!selectedMapCoords) return;

  const { lat, lon } = selectedMapCoords;
  els.mapConfirmBtn.disabled = true;
  els.mapConfirmBtn.textContent = "불러오는 중…";

  try {
    searchRequestId++;
    const locationInfo = await resolveMapLocationInfo(lat, lon, selectedMapCoords);

    await fetchWeatherByCoords(lat, lon, {
      name: locationInfo.name,
      country: locationInfo.country,
      admin1: locationInfo.admin1,
    });
    els.cityInput.value = locationInfo.regionLabel;
    closeLocationMapModal();
  } catch {
    showError("선택한 위치의 날씨를 불러오지 못했습니다.");
  } finally {
    els.mapConfirmBtn.disabled = false;
    els.mapConfirmBtn.textContent = "이 위치 선택";
  }
}

els.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(debounceTimer);
  searchCity(els.cityInput.value);
});

els.cityInput.addEventListener("input", () => {
  scheduleDebouncedSearch(els.cityInput.value);
});

els.locationBtn.addEventListener("click", openLocationMapModal);

els.mapModalClose.addEventListener("click", closeLocationMapModal);
els.mapModalBackdrop.addEventListener("click", closeLocationMapModal);
els.mapCancelBtn.addEventListener("click", closeLocationMapModal);
els.mapConfirmBtn.addEventListener("click", confirmMapSelection);
els.mapGpsBtn.addEventListener("click", moveMapToGps);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.mapModal.hidden) closeLocationMapModal();
});

els.unitToggle.addEventListener("change", () => {
  isFahrenheit = els.unitToggle.checked;
  updateUnitLabels();
  if (!currentWeather) return;

  const info = getWeatherInfo(currentWeather.current.weather_code);
  displayCityWeather({
    name: currentWeather.location.name,
    country: currentWeather.location.country,
    admin1: currentWeather.location.admin1,
    temperature: toDisplayTemp(currentWeather.current.temperature_2m),
    description: info.desc,
    icon: info.icon,
  });
  renderWeatherDetails();
});

updateUnitLabels();
