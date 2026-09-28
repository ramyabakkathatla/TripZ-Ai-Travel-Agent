"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Clock3,
  CloudRain,
  CloudSun,
  Hotel as HotelIcon,
  Lightbulb,
  Map,
  MapPinned,
  Menu,
  Star,
  Sun,
  Moon,
  Ticket,
  Utensils,
  Wallet,
  CalendarDays,
  ChevronDown,
  Compass,
  MapPin,
  Plane,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

type TripResult = {
  trip_overview?: any;
  flights?: {
    outbound?: any[];
    return?: any[];
  };
  hotels?: any[];
  weather?: any[] | any;
  attractions?: any[];
  itinerary?: any[];
  maps?: {
    routes?: any[];
  };
  expenses?: {
    estimated_total?: string | number;
    details?: any[];
  };
  tips?: string[] | any[];
  local_food?: any[];
};

const FALLBACK_ATTRACTION_IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470214304380-aadaedcfff1b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
];

const getValue = (obj: any, keys: string[], fallback = "") => {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const toArray = (value: any): any[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};
const ItineraryBullets = ({ value }: { value: any }) => {
  if (!value) return null;

  const rawItems = Array.isArray(value)
    ? value
    : String(value)
        .split(/\n+|•|(?:^|\n)\s*[-*]\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

  // Convert paragraph-style itinerary text into separate bullet points.
  // Existing bullets/new lines are preserved, while multiple sentences
  // in one paragraph become individual bullet items.
  const items = rawItems.flatMap((item) => {
    const content =
      typeof item === "object"
        ? item?.activity ||
          item?.description ||
          item?.details ||
          JSON.stringify(item)
        : String(item);

    return String(content)
      .replace(/^\d+[.)]\s*/, "")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((point) => point.trim())
      .filter(Boolean);
  });

  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};
const renderItineraryBullets = (value: any) => {
  if (!value) return null;

  const text = String(value).trim();

  const points = text
    .split(/\n+|•|(?<=\.)\s+(?=[A-Z])/)
    .map((point) => point.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
      {points.map((point, index) => (
        <li key={index}>{point}</li>
      ))}
    </ul>
  );
};

const parseMaybeJson = (value: any): any => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getDuration = (from: string, to: string) => {
  if (!from || !to) return "";
  const a = new Date(from);
  const b = new Date(to);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff > 0 ? `${diff} days` : "";
};
const cleanWeatherValue = (
  value: any,
  suffix: string = ""
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "";
  }

  return String(value)
    .replace(new RegExp(`${suffix}$`, "i"), "")
    .trim();
};

const extractWeather = (raw: any, destination: string) => {
  let weather: any = parseMaybeJson(raw);

  // Unwrap possible response structures
  if (weather?.weather) weather = weather.weather;
  if (weather?.data?.weather) weather = weather.data.weather;
  if (weather?.result?.weather) weather = weather.result.weather;

  // Weather may be returned as an array
  if (Array.isArray(weather)) {
    weather = weather[0] || {};
  }

  const current =
    weather?.current ||
    weather?.current_weather ||
    weather?.weather?.current ||
    {};

  const location =
    typeof weather?.location === "object"
      ? weather.location
      : {
          name:
            weather?.location ||
            destination,
        };

  // -------------------------------------------------------
  // CURRENT WEATHER
  // -------------------------------------------------------

  const temperature = getValue(current, [
    "temperature_c",
    "temp_c",
    "temperature",
    "temp",
  ]);

  const feelsLike = getValue(current, [
    "feels_like_c",
    "feelslike_c",
    "feels_like",
    "feelslike",
    "feels_like_temperature_c",
  ]);

  const humidity = getValue(current, [
    "humidity",
    "humidity_percent",
  ]);

  const wind = getValue(current, [
    "wind_kph",
    "wind_speed_kph",
    "wind",
    "max_wind_kph",
  ]);

  const rainChance = getValue(current, [
    "chance_of_rain",
    "rain_chance",
    "daily_chance_of_rain",
  ]);

  const condition =
    getValue(current, [
      "condition",
      "weather",
      "description",
    ]) ||
    getValue(weather, [
      "condition",
      "weather",
      "description",
    ]);

  // -------------------------------------------------------
  // FORECAST
  // -------------------------------------------------------

  let rawForecast =
    weather?.forecast ||
    weather?.forecast_days ||
    weather?.daily_forecast ||
    weather?.daily ||
    [];

  // Handle:
  // forecast: { forecastday: [...] }
  if (Array.isArray(rawForecast?.forecastday)) {
    rawForecast = rawForecast.forecastday;
  }

  // Handle direct array
  if (!Array.isArray(rawForecast)) {
    rawForecast = [];
  }

  const forecast = rawForecast.map((day: any) => {
    const dayData = day?.day || day;

    return {
      date:
        day?.date ||
        dayData?.date ||
        "",

      max_temperature_c: getValue(dayData, [
        "max_temperature_c",
        "maxtemp_c",
        "max_temp_c",
        "max_temp",
        "temperature_max_c",
        "max_temperature",
      ]),

      min_temperature_c: getValue(dayData, [
        "min_temperature_c",
        "mintemp_c",
        "min_temp_c",
        "min_temp",
        "temperature_min_c",
        "min_temperature",
      ]),

      condition: getValue(dayData, [
        "condition",
        "weather",
        "description",
      ]),

      chance_of_rain: getValue(dayData, [
        "chance_of_rain",
        "daily_chance_of_rain",
        "rain_chance",
      ]),
    };
  });

  return {
    name:
      getValue(location, [
        "name",
        "city",
        "location_name",
      ]) || destination,

    temperature,
    feelsLike,
    humidity,
    wind,
    rainChance,

    condition:
      typeof condition === "object"
        ? condition?.text
        : condition,

    forecast,
  };
};
const flightName = (flight: any) =>
  getValue(flight, [
    "airline",
    "airline_name",
    "carrier",
    "carrier_name",
    "airlineName",
  ], "Airline");

const flightNumber = (flight: any) =>
  getValue(flight, [
    "flight_number",
    "flightNumber",
    "flight_no",
    "flight",
  ]);

const flightPrice = (flight: any) =>
  getValue(flight, ["price", "cost", "fare", "total_price"], "Price unavailable");

const airportCode = (flight: any, side: "from" | "to") => {
  const keys =
    side === "from"
      ? ["departure_airport_code", "origin_code", "from_code", "departure_code"]
      : ["arrival_airport_code", "destination_code", "to_code", "arrival_code"];

  return getValue(flight, keys);
};

const airportName = (flight: any, side: "from" | "to") => {
  const keys =
    side === "from"
      ? [
          "departure_airport",
          "origin",
          "from",
          "departure",
          "departure_city",
          "origin_city",
        ]
      : [
          "arrival_airport",
          "destination",
          "to",
          "arrival",
          "arrival_city",
          "destination_city",
        ];

  return getValue(flight, keys);
};

const flightTime = (flight: any, side: "departure" | "arrival") => {
  const value = getValue(
    flight,
    side === "departure"
      ? ["departure_time", "departureTime", "departure"]
      : ["arrival_time", "arrivalTime", "arrival"]
  );

  if (!value) return "";

  if (typeof value === "object") {
    return value.time || value.date || "";
  }

  return String(value);
};

const attractionImage = (attraction: any, index: number) => {
  const supplied = getValue(attraction, [
    "image",
    "image_url",
    "imageUrl",
    "photo",
    "photo_url",
  ]);
  return supplied || FALLBACK_ATTRACTION_IMAGES[index % FALLBACK_ATTRACTION_IMAGES.length];
};

export default function Home() {
  const [tripType, setTripType] = useState("Round Trip");
  const [from, setFrom] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travelers, setTravelers] = useState("1");
  const [userRequest, setUserRequest] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [pageReady, setPageReady] = useState(false);
  const [activeAgent, setActiveAgent] = useState("overview");
  const [attractionPhotos, setAttractionPhotos] = useState<
  Record<number, string>
>({});
useEffect(() => {
  const savedTheme = localStorage.getItem("tripz-theme");

  if (savedTheme === "dark" || savedTheme === "light") {
    setTheme(savedTheme);
  }
}, []);

useEffect(() => {
  localStorage.setItem("tripz-theme", theme);
}, [theme]);
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const isGeneratedView = params.get("view") === "generated";

  // Normal visit to "/" → show fresh user-details form
  if (!isGeneratedView) {
    setResult(null);
    setLoading(false);
    setError("");

    setTripType("Round Trip");
    setFrom("");
    setDestination("");
    setDeparture("");
    setReturnDate("");
    setTravelers("1");
    setUserRequest("");
    setActiveAgent("overview");

    setPageReady(true);
    return;
  }

  // Returning from a separate tab → restore generated trip
  const savedResult = localStorage.getItem("tripzResult");
  const savedDetails = localStorage.getItem("tripzTripDetails");

  if (savedResult) {
    try {
      const parsedResult = JSON.parse(savedResult);
      setResult(parsedResult);
    } catch (error) {
      console.error("Unable to restore TripZ result:", error);
      setResult(null);
    }
  } else {
    setResult(null);
  }

  if (savedDetails) {
    try {
      const details = JSON.parse(savedDetails);

      setTripType(details.tripType || "Round Trip");
      setFrom(details.from || "");
      setDestination(details.destination || "");
      setDeparture(details.departure || "");
      setReturnDate(details.returnDate || "");
      setTravelers(String(details.travelers || "1"));
    } catch (error) {
      console.error("Unable to restore trip details:", error);
    }
  }

  setPageReady(true);
}, []);

  const handlePlanTrip = async () => {
    setError("");
    setActiveAgent("overview");
    setResult(null);

    if (!from.trim()) {
      setError("Please enter your starting location.");
      return;
    }

    if (!destination.trim()) {
      setError("Please enter your destination.");
      return;
    }

    if (!departure) {
      setError("Please select a departure date.");
      return;
    }

    if (tripType === "Round Trip" && !returnDate) {
      setError("Please select a return date.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/plan-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trip_type:
            tripType === "Round Trip" ? "round_trip" : "one_way",
          from_location: from.trim(),
          destination: destination.trim(),
          departure,
          return_date:
            tripType === "Round Trip" ? returnDate : null,
          travelers: Number(travelers),
          user_request: userRequest.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

console.log("TripZ response:", data);

setResult(data);

localStorage.setItem("tripzResult", JSON.stringify(data));

localStorage.setItem(
  "tripzTripDetails",
  JSON.stringify({
    tripType,
    from,
    destination,
    departure,
    returnDate,
    travelers,
  })
);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to connect to the TripZ backend. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const parseTripResponse = (): TripResult | null => {
    if (!result?.response) return null;

    try {
      let text = result.response.trim();

      text = text
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();

      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
      }

      return JSON.parse(text);
    } catch (err) {
      console.error("Unable to parse AI response:", err);
      return null;
    }
  };

  const tripData = parseTripResponse();

  const weatherData = useMemo(
    () => extractWeather(tripData?.weather, destination),
    [tripData?.weather, destination]
  );

  const outboundFlights = toArray(tripData?.flights?.outbound);
  const returnFlights = toArray(tripData?.flights?.return);
  const attractions = toArray(tripData?.attractions);
  const hotels = toArray(tripData?.hotels);
  const itinerary = toArray(tripData?.itinerary);
  const localFood = toArray(tripData?.local_food);
  const tips = toArray(tripData?.tips);

  // Fetch real sightseeing photos from Google Places.
  // Use the original attractions value as the dependency so this effect
  // does not re-run on every render.
  useEffect(() => {
    const currentAttractions = toArray(tripData?.attractions);

    if (!currentAttractions.length || !destination) {
      return;
    }

    let cancelled = false;

    const fetchAttractionPhotos = async () => {
      const photos: Record<number, string> = {};

      for (let index = 0; index < currentAttractions.length; index++) {
        const attraction = currentAttractions[index];

        const suppliedImage = getValue(attraction, [
          "image",
          "image_url",
          "imageUrl",
          "photo",
          "photo_url",
        ]);

        // Keep an image already supplied by the backend.
        if (suppliedImage) continue;

        const placeName =
          attraction?.name ||
          attraction?.title ||
          attraction?.place ||
          "";

        if (!placeName) continue;

        try {
          const response = await fetch("/api/place-photo", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              placeName,
              destination,
            }),
          });

          if (!response.ok) continue;

          const data = await response.json();

          if (data?.photoUri) {
            photos[index] = data.photoUri;
          }
        } catch (error) {
          console.error(
            `Unable to fetch image for ${placeName}:`,
            error
          );
        }
      }

      if (!cancelled) {
        setAttractionPhotos(photos);
      }
    };

    fetchAttractionPhotos();

    return () => {
      cancelled = true;
    };
  }, [result?.response, destination]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const openMaps = () => {
    const input = document.getElementById("mapsSearch") as HTMLInputElement;
    const value = input?.value.trim();

    const url = value
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`
      : "https://www.google.com/maps";

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const SectionHeader = ({
    icon,
    label,
    title,
  }: {
    icon: ReactNode;
    label: string;
    title: string;
  }) => (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 tripz-accent">
          {label}
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
      </div>
     
    </div>
  );

  const EmptyState = ({
    icon,
    text,
  }: {
    icon: ReactNode;
    text: string;
  }) => (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="flex justify-center text-blue-500">{icon}</div>
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  );

  const FlightCard = ({
    flight,
    index,
    returnFlight = false,
  }: {
    flight: any;
    index: number;
    returnFlight?: boolean;
  }) => {
    const airline = flightName(flight);
    const number = flightNumber(flight);
    const fromName = airportName(flight, "from") || (returnFlight ? destination : from);
    const toName = airportName(flight, "to") || (returnFlight ? from : destination);
    const fromCode =
      airportCode(flight, "from") ||
      (returnFlight ? destination.slice(0, 3).toUpperCase() : from.slice(0, 3).toUpperCase());
    const toCode =
      airportCode(flight, "to") ||
      (returnFlight ? from.slice(0, 3).toUpperCase() : destination.slice(0, 3).toUpperCase());

    return (
      <div className="group rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex tripz-accent-badge rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              <Plane className="tripz-accent mr-1 inline h-3.5 w-3.5" />
              {returnFlight ? "Return" : "Departure"} {index + 1}
            </span>
            <h3 className="mt-3 text-base font-bold text-slate-900">{airline}</h3>
            {number && (
              <p className="mt-1 text-xs font-medium text-slate-400">
                Flight {number}
              </p>
            )}
          </div>

          <span className="tripz-accent-badge rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600">
            {flightPrice(flight)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">{fromCode}</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{fromName}</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {flightTime(flight, "departure") || "Time unavailable"}
            </p>
          </div>

          <div className="flex items-center gap-1 text-slate-300">
            <span className="h-px w-7 bg-slate-300" />
            <Plane className="tripz-accent h-4 w-4 text-blue-500" />
            <span className="h-px w-7 bg-slate-300" />
          </div>

          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">{toCode}</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{toName}</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {flightTime(flight, "arrival") || "Time unavailable"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {getValue(flight, ["duration"]) && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {getValue(flight, ["duration"])}
            </span>
          )}
          {flight.stops !== undefined && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      </div>
    );
  };

  const WeatherCard = () => {
    const forecast = weatherData.forecast;
    const hasCurrent =
      weatherData.temperature !== "" ||
      weatherData.condition ||
      weatherData.humidity !== "";

    return (
      <section
        id="weather"
        className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 tripz-accent">
              {weatherData.name || destination} WEATHER
            </p>

            <div className="mt-3 flex items-center gap-4">
              <CloudSun className="h-12 w-12 text-sky-500" />
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">
                  {hasCurrent && weatherData.temperature !== ""
  ? `${cleanWeatherValue(weatherData.temperature, "°C")}°C`
  : "Weather unavailable"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {weatherData.condition || "Current weather"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="min-w-[88px] rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-[11px] text-slate-400">Feels like</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
{weatherData.feelsLike !== ""
  ? `${cleanWeatherValue(weatherData.feelsLike, "°C")}°C`
  : "—"}              </p>
            </div>

            <div className="min-w-[88px] rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-[11px] text-slate-400">Humidity</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
{weatherData.feelsLike !== ""
  ? `${cleanWeatherValue(weatherData.feelsLike, "°C")}°C`
  : "—"}              </p>
            </div>

            <div className="min-w-[88px] rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-[11px] text-slate-400">Wind</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
{weatherData.humidity !== ""
  ? `${cleanWeatherValue(weatherData.humidity, "%")}%`
  : "—"}              </p>
            </div>

            <div className="min-w-[88px] rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-[11px] text-slate-400">Rain chance</p>
              <p className="tripz-accent mt-1 text-sm font-bold text-slate-800">
{weatherData.rainChance !== ""
  ? `${cleanWeatherValue(weatherData.rainChance, "%")}%`
  : "—"}              </p>
            </div>
          </div>
        </div>

        {forecast.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Forecast
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {forecast.slice(0, 5).map((day: any, index: number) => {
                const condition = getValue(day, ["condition", "weather"]);
                return (
                  <div
                    key={index}
                    className="rounded-xl bg-slate-50 p-3 transition hover:bg-blue-50"
                  >
                    <p className="text-xs font-semibold text-slate-400">
                      {formatDate(getValue(day, ["date"])) || `Day ${index + 1}`}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {getValue(day, ["max_temperature_c", "maxtemp_c", "max_temp"]) || "—"}° /{" "}
                      {getValue(day, ["min_temperature_c", "mintemp_c", "min_temp"]) || "—"}°
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {typeof condition === "object" ? condition?.text : condition || "Forecast"}
                    </p>
                    <p className="tripz-accent mt-2 text-xs font-semibold text-blue-600">
                      <CloudRain className="tripz-accent mr-1 inline h-3.5 w-3.5" />
                      {getValue(day, ["chance_of_rain", "daily_chance_of_rain"]) || "—"}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  };

  const AttractionCard = ({
  attraction,
  index,
}: {
  attraction: any;
  index: number;
}) => {
  const image =
    attraction.image ||
    attraction.image_url ||
    attraction.imageUrl ||
    attraction.photo ||
    attraction.photo_url ||
    attractionPhotos[index] ||
    FALLBACK_ATTRACTION_IMAGES[index % FALLBACK_ATTRACTION_IMAGES.length];

  const name =
    attraction.name ||
    attraction.title ||
    attraction.place ||
    "Attraction";

  const description =
    attraction.description ||
    attraction.details ||
    attraction.activity ||
    "A beautiful place to discover during your journey.";

  const location =
    attraction.location ||
    attraction.address ||
    "Explore this destination";

  const rating =
    attraction.rating ||
    attraction.stars ||
    attraction.review_score ||
    null;

  const entryFee =
    attraction.entry_fee ||
    attraction.entryFee ||
    null;

  const bestTime =
    attraction.best_time ||
    attraction.bestTime ||
    null;

  /*
   * Different visual treatment for each attraction.
   * This makes the section feel like a travel story
   * instead of five identical cards.
   */
  const layouts = [
    "md:col-span-2 md:row-span-2",
    "md:col-span-1 md:row-span-1",
    "md:col-span-1 md:row-span-1",
    "md:col-span-1 md:row-span-1",
    "md:col-span-2 md:row-span-1",
  ];

  const gradients = [
    "from-slate-900/90 via-slate-900/20 to-transparent",
    "from-black/80 via-black/10 to-transparent",
    "from-black/80 via-black/10 to-transparent",
    "from-black/80 via-black/10 to-transparent",
    "from-slate-900/90 via-slate-900/20 to-transparent",
  ];

  return (
    <article
      className={`group relative min-h-[280px] overflow-hidden rounded-[28px] bg-slate-200 ${layouts[index % layouts.length]}`}
    >
      {/* Background image */}
      {image && (
        <img
          src={image}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.remove();
          }}
        />
      )}

      {/* Beautiful fallback when image is unavailable */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          index === 0
            ? "from-blue-100 via-indigo-100 to-slate-200"
            : index === 1
            ? "from-amber-100 via-orange-50 to-slate-200"
            : index === 2
            ? "from-emerald-100 via-teal-50 to-slate-200"
            : index === 3
            ? "from-rose-100 via-pink-50 to-slate-200"
            : "from-violet-100 via-purple-50 to-slate-200"
        }`}
      >
        <div className="flex h-full items-center justify-center">
          <div className="text-center opacity-40">
            <Sparkles className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              TripZ discovery
            </p>
          </div>
        </div>
      </div>

      {/* Dark gradient over image */}
      <div
        className={`absolute inset-0 bg-gradient-to-t ${gradients[index % gradients.length]}`}
      />

      {/* Top information */}
      <div className="absolute left-5 right-5 top-5 flex items-start justify-between">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm backdrop-blur">
          {index === 0 ? "Must Visit" : `Pick ${index + 1}`}
        </span>

        {rating && (
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
            {rating}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
        <div className="max-w-xl">

          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
            SIGHTSEEING {String(index + 1).padStart(2, "0")}
          </p>

          <h3
            className={`font-bold leading-tight text-white ${
              index === 0
                ? "text-2xl md:text-3xl"
                : index === 4
                ? "text-xl md:text-2xl"
                : "text-lg md:text-xl"
            }`}
          >
            {name}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
            <MapPinned className="h-3.5 w-3.5 shrink-0" />
            <span>{location}</span>
          </div>

          {/* Show description mainly on larger cards */}
          {(index === 0 || index === 4) && (
            <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-5 text-white/80">
              {description}
            </p>
          )}

          {/* Extra information */}
          {(index === 0 || index === 4) && (entryFee || bestTime) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {entryFee && (
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                  <Ticket className="mr-1 inline h-3.5 w-3.5" />
                  {entryFee}
                </span>
              )}

              {bestTime && (
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                  <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                  {bestTime}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute bottom-5 right-5 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-white/90 text-slate-800 opacity-0 shadow-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <ArrowRight className="h-4 w-4" />
      </div>
    </article>
  );
};

  const HotelCard = ({
    hotel,
    index,
  }: {
    hotel: any;
    index: number;
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hotel {index + 1}
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            {getValue(hotel, ["name", "hotel_name", "hotel"], "Hotel")}
          </h3>
        </div>

        {getValue(hotel, ["rating", "stars"]) && (
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-sm font-bold text-amber-600">
            <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {getValue(hotel, ["rating", "stars"])}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {getValue(hotel, ["location", "address", "area"], "Location unavailable")}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {getValue(hotel, ["price", "price_per_night", "cost"]) && (
          <span className="tripz-accent-badge rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
            {(() => {
              const value = String(
                getValue(hotel, ["price", "price_per_night", "cost"])
              );
              return /night/i.test(value) ? value : `${value} / night`;
            })()}
          </span>
        )}
        {toArray(hotel?.amenities).slice(0, 3).map((amenity: any, i: number) => (
          <span
            key={i}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
          >
            {typeof amenity === "string" ? amenity : amenity?.name || "Amenity"}
          </span>
        ))}
      </div>
    </div>
  );

  const LocalFoodCard = ({
    food,
    index,
  }: {
    food: any;
    index: number;
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl">
          <Utensils className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className="tripz-accent text-xs font-semibold text-orange-600">DISH {index + 1}</p>
          <h3 className="mt-1 font-bold text-slate-900">
            {getValue(food, ["name", "dish", "title", "food_name"], "Local Dish")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {getValue(
              food,
              ["description", "details", "reason", "about"],
              "A local specialty worth trying."
            )}
          </p>
        </div>
      </div>
    </div>
  );

  const ItineraryCard = ({ day }: { day: any }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#BB86FC] text-sm font-bold text-white">
          {getValue(day, ["day"], "•")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-slate-900">
              Day {getValue(day, ["day"], "")}
            </h3>
            {getValue(day, ["date"]) && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {formatDate(getValue(day, ["date"]))}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Morning", "morning"],
              ["Afternoon", "afternoon"],
              ["Evening", "evening"],
            ].map(([label, key]) => {
              const value = getValue(day, [key]);
              if (!value) return null;

              return (
                <div key={key} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600 tripz-accent">
                    {label}
                  </p>
<ItineraryBullets value={value} />                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ==================================================
  // ESTIMATED COST — complete and consistent calculation
  // ==================================================
  const expenseDetails = toArray(tripData?.expenses?.details);

  const getNumericAmount = (value: any): number => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const text = value.trim().toLowerCase();
      if (!text) return 0;

      // Support common Indian price formats such as ₹12,61,202,
      // 12.5 lakh and 1.2 crore.
      const multiplier =
        text.includes("crore") || text.includes("cr")
          ? 10000000
          : text.includes("lakh") || text.includes("lac")
            ? 100000
            : text.includes("k")
              ? 1000
              : 1;

      const cleaned = text
        .replace(/,/g, "")
        .replace(/₹|rs\.?|inr|crore|cr|lakh|lac|k/g, "")
        .trim();

      const number = Number.parseFloat(cleaned);
      return Number.isFinite(number) ? number * multiplier : 0;
    }

    if (value && typeof value === "object") {
      return (
        getNumericAmount(value.amount) ||
        getNumericAmount(value.value) ||
        getNumericAmount(value.price) ||
        getNumericAmount(value.cost) ||
        getNumericAmount(value.total) ||
        getNumericAmount(value.total_price)
      );
    }

    return 0;
  };

  const formatRupees = (value: number) =>
    `₹${Math.round(value).toLocaleString("en-IN")}`;

  const getPriceInfo = (
    item: any,
    type: "flight" | "hotel"
  ): { amount: number; isTotal: boolean } => {
    if (!item) return { amount: 0, isTotal: false };

    // Prefer explicit total/stay-total fields before generic price fields.
    const totalKeys = [
      "total_price",
      "totalPrice",
      "stay_total",
      "stayTotal",
      "booking_total",
      "bookingTotal",
      "total",
    ];

    for (const key of totalKeys) {
      const amount = getNumericAmount(item?.[key]);
      if (amount > 0) return { amount, isTotal: true };
    }

    const priceKeys =
      type === "hotel"
        ? [
            "price_per_night",
            "pricePerNight",
            "nightly_price",
            "nightlyPrice",
            "price",
            "cost",
            "amount",
            "estimated_cost",
          ]
        : ["price", "fare", "cost", "amount", "estimated_cost"];

    for (const key of priceKeys) {
      const amount = getNumericAmount(item?.[key]);
      if (amount > 0) return { amount, isTotal: false };
    }

    return { amount: 0, isTotal: false };
  };

  const findFirstPrice = (
    items: any[],
    type: "flight" | "hotel"
  ): { amount: number; isTotal: boolean } => {
    if (!Array.isArray(items)) return { amount: 0, isTotal: false };

    for (const item of items) {
      const info = getPriceInfo(item, type);
      if (info.amount > 0) return info;
    }

    return { amount: 0, isTotal: false };
  };

  const outboundFlightInfo = findFirstPrice(outboundFlights, "flight");
  const returnFlightInfo = findFirstPrice(returnFlights, "flight");
  const hotelInfo = findFirstPrice(hotels, "hotel");

  // Flight prices returned by search providers are treated as the displayed
  // price for the selected option. We do not multiply them by travelers here
  // because providers may already return the total fare for the party.
  const calculatedFlightPrice =
    outboundFlightInfo.amount + returnFlightInfo.amount;

  const nights =
    departure && returnDate
      ? Math.max(
          1,
          Math.ceil(
            (new Date(`${returnDate}T00:00:00`).getTime() -
              new Date(`${departure}T00:00:00`).getTime()) /
              86400000
          )
        )
      : 1;

  const travelerCount = Math.max(1, Number(travelers) || 1);

  // If the hotel provider explicitly gives a stay total, use it as-is.
  // Otherwise treat the nightly price as per night.
  // Ignore obviously malformed hotel values (for example multi-billion-rupee
  // prices caused by provider formatting) and use TripZ's fallback estimate.
  const MAX_REASONABLE_HOTEL_NIGHTLY = 500000;
  const validHotelPrice =
    hotelInfo.amount > 0 &&
    (hotelInfo.isTotal || hotelInfo.amount <= MAX_REASONABLE_HOTEL_NIGHTLY)
      ? hotelInfo.amount
      : 0;

  const accommodationPrice =
    validHotelPrice > 0
      ? hotelInfo.isTotal
        ? validHotelPrice
        : validHotelPrice * nights
      : 0;

  // Backend details can supply category-specific values. We use only valid
  // categories from those details and fill any missing categories with
  // TripZ estimates so the displayed breakdown is always complete.
  const detailItems = expenseDetails
    .map((item: any) => {
      const name = String(
        item?.category ?? item?.name ?? item?.type ?? ""
      ).trim();
      const numeric = getNumericAmount(
        item?.amount ??
          item?.cost ??
          item?.price ??
          item?.total ??
          item?.estimated_cost
      );

      return { name, numeric };
    })
    .filter((item) => item.name && item.numeric > 0);

  const findDetailAmount = (patterns: RegExp[], maxAmount = Number.POSITIVE_INFINITY) => {
    const match = detailItems.find((item) =>
      patterns.some((pattern) => pattern.test(item.name.toLowerCase())) &&
      item.numeric <= maxAmount
    );
    return match?.numeric || 0;
  };

  const fallbackAccommodation = Math.round(
    nights * travelerCount * 5000
  );
  const fallbackTransportation = Math.round(
    nights * travelerCount * 500
  );
  const fallbackFood = Math.round(nights * travelerCount * 1000);
  const fallbackActivities = Math.round(nights * travelerCount * 700);
  const fallbackShopping = Math.round(travelerCount * 1000);

  const flightsAmount =
    findDetailAmount([/flight/, /airfare/, /air ticket/]) ||
    calculatedFlightPrice;

  const accommodationAmount =
    findDetailAmount(
      [/accommodation/, /hotel/, /stay/, /lodging/],
      5000000
    ) ||
    accommodationPrice ||
    fallbackAccommodation;

  const transportationAmount =
    findDetailAmount([/transport/, /taxi/, /cab/, /local travel/]) ||
    fallbackTransportation;

  const foodAmount =
    findDetailAmount([/food/, /dining/, /meal/, /restaurant/]) ||
    fallbackFood;

  const activitiesAmount =
    findDetailAmount([/activit/, /attraction/, /sightseeing/, /experience/]) ||
    fallbackActivities;

  const shoppingAmount =
    findDetailAmount([/shopping/, /souvenir/, /other/]) ||
    fallbackShopping;

  const parsedExpenseItems = [
    { name: "Flights", numeric: flightsAmount },
    { name: "Accommodation", numeric: accommodationAmount },
    { name: "Local Transportation", numeric: transportationAmount },
    { name: "Food & Dining", numeric: foodAmount },
    { name: "Activities & Attractions", numeric: activitiesAmount },
    { name: "Shopping & Souvenirs", numeric: shoppingAmount },
  ]
    .filter((item) => item.numeric > 0)
    .map((item) => ({
      ...item,
      amount: formatRupees(item.numeric),
    }));

  // The total is ALWAYS the sum of the amounts shown below it.
  // This keeps the headline, bars and percentages mathematically consistent.
  const expenseTotal = parsedExpenseItems.reduce(
    (sum, item) => sum + item.numeric,
    0
  );

  if (!pageReady) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="tripz-loading-spinner mx-auto h-8 w-8 rounded-full border-4 border-slate-200 border-t-blue-600" />
        <p className="mt-4 text-sm font-medium text-slate-500">
          Loading TripZ...
        </p>
      </div>
    </main>
  );
}

return (
<main
  className={`tripz-app min-h-screen ${
    theme === "dark" ? "tripz-dark" : "tripz-light"
  }`}
>
       {/* HEADER */}
<header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
  <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 md:px-8">

    {/* LEFT — TRIPZ BRAND */}
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
        <img
          src="/tripz-logo.jpeg"
          alt="TripZ"
          className="h-full w-full object-contain"
        />
      </div>

      <div>
        <h1 className="text-xl font-extrabold tracking-tight">
          TRIPZ
        </h1>

        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          AI Travel Planner
        </p>
      </div>
    </div>

    {/* RIGHT — LIGHT / DARK TOGGLE */}
    <div className="theme-toggle flex items-center rounded-full border-[3px] border-slate-900 bg-white p-1.5 shadow-sm">

      {/* LIGHT */}
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`theme-toggle-light flex h-9 items-center gap-2 rounded-full px-4 text-base font-medium transition-all duration-300 ${
          theme === "light"
            ? "bg-slate-100 text-slate-500 shadow-sm"
            : "bg-transparent text-slate-300 hover:text-slate-500"
        }`}
        aria-label="Light theme"
      >
        <Sun className="h-6 w-6" strokeWidth={2} />
       
      </button>

      {/* DARK */}
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`theme-toggle-dark flex h-9 items-center gap-2 rounded-full px-4 text-base font-medium transition-all duration-300 ${
          theme === "dark"
            ? "bg-slate-500 text-white shadow-sm"
            : "bg-transparent text-slate-300 hover:text-slate-500"
        }`}
        aria-label="Dark theme"
      >
        <Moon className="h-6 w-6" strokeWidth={2} />
        
      </button>
    </div>
  </div>
</header>

      {/* ========================= INPUT SCREEN ========================= */}
      {!result && !loading && (
        <section className="min-h-[calc(100vh-64px)] bg-[#faf8f3]">
          <div className="mx-auto max-w-[1050px] px-5 py-10 md:px-8 md:py-12 lg:py-14">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-12">
              {/* LEFT SIDE */}
              <div className="min-w-0">
                

                <h2 className="max-w-[500px] text-[40px] font-black leading-[0.95] tracking-[-0.04em] text-[#171514] md:text-[48px] lg:text-[52px]">
                  Plan your next
                  <br />
                  adventure,
                  <br />
                  <span className="font-serif font-semibold italic">
                    all in one place.
                  </span>
                </h2>

                <p className="mt-4 max-w-[490px] text-[12px] leading-5 text-slate-600 md:text-[13px]">
                  Tell TripZ where you want to go, when you want to travel, and what
                  you need. Our travel agents will build the complete trip for you.
                </p>

                <section className="mt-5 rounded-[17px] border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(20,20,20,0.07)] md:p-4.5">
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                      <Compass className="h-3 w-3 text-blue-500" />
                      Trip Type
                    </label>

                    <div className="flex h-7 rounded-lg bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setTripType("Round Trip")}
                        className={`flex-1 rounded-md text-[10px] font-medium transition ${
                          tripType === "Round Trip"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Round Trip
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTripType("One Way");
                          setReturnDate("");
                        }}
                        className={`flex-1 rounded-md text-[10px] font-medium transition ${
                          tripType === "One Way"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        One Way
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        From
                      </label>
                      <input
                        type="text"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        placeholder="Hyderabad"
                        className="h-7 w-full rounded-md border border-slate-200 bg-[#fafbfc] px-2.5 text-[10px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        Destination
                      </label>
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Goa"
                        className="h-7 w-full rounded-md border border-slate-200 bg-[#fafbfc] px-2.5 text-[10px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] gap-2.5">
                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                        <CalendarDays className="h-3 w-3 text-sky-500" strokeWidth={2.5} />
                        Departure
                      </label>
                      <input
                        type="date"
                        value={departure}
                        onChange={(e) => setDeparture(e.target.value)}
                        className="h-7 w-full rounded-md border border-slate-200 bg-[#fafbfc] px-2 text-[9px] text-slate-600 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                        <CalendarDays className="h-3 w-3 text-sky-500" strokeWidth={2.5} />
                        Return
                      </label>
                      <input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        disabled={tripType === "One Way"}
                        className={`h-7 w-full rounded-md border px-2 text-[9px] outline-none transition ${
                          tripType === "One Way"
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-slate-200 bg-[#fafbfc] text-slate-600 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                        <Users className="h-3 w-3 text-blue-500" />
                        Travelers
                      </label>
                      <div className="relative">
                        <select
                          value={travelers}
                          onChange={(e) => setTravelers(e.target.value)}
                          className="h-7 w-full appearance-none rounded-md border border-slate-200 bg-[#fafbfc] px-2 text-[9px] text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n} Traveler{n !== 1 ? "s" : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-700">
                        What do you need?
                      </label>
                      <span className="text-[9px] text-slate-400">Optional</span>
                    </div>

                    <textarea
                      value={userRequest}
                      onChange={(e) => setUserRequest(e.target.value)}
                      placeholder="Example: Plan a complete Goa trip with flights, a good hotel, weather, places to visit, local food and a day-by-day itinerary."
                      rows={3}
                      className="mt-1.5 w-full resize-none rounded-md border border-slate-200 bg-[#fafbfc] p-2.5 text-[9px] leading-4 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {[
                      "Complete trip",
                      "Flights + Hotels",
                      "Weather + Food",
                      "Itinerary + Routes",
                    ].map((label, index) => {
                      const requests = [
                        "Plan a complete trip with flights, hotel, weather, places to visit, local food and a day-by-day itinerary.",
                        "Find the best flight options and suitable hotels for this trip.",
                        "Tell me about the weather, local food and the best places to visit.",
                        "Create a day-by-day itinerary with useful routes between the places.",
                      ];

                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setUserRequest(requests[index])}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[8px] font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {error && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-medium text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handlePlanTrip}
                    disabled={loading}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#211e1c] text-[10px] font-bold text-white shadow-md transition-all duration-200 hover:bg-[#302c29] hover:shadow-lg dark:bg-blue-600 dark:hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plane className="h-3.5 w-3.5" />
                    Plan My Trip
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </section>

              </div>

              {/* RIGHT SIDE — TRAVEL COLLAGE */}
<div className="relative hidden h-[600px] w-[490px] shrink-0 lg:block">

  <div className="grid h-full w-full grid-cols-[235px_1fr] grid-rows-[290px_1fr] gap-[8px]">

    {/* 1 — POSITANO */}
    <div className="relative overflow-hidden rounded-[28px_28px_6px_6px]">
      <img
        src="https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=900&q=90"
        alt="Positano"
        className="h-full w-full object-cover"
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-16">
        <p className="font-serif text-[13px] font-semibold italic text-white">
          Positano
        </p>
      </div>
    </div>


    {/* 2 — HALONG BAY */}
    <div className="relative overflow-hidden rounded-[14px]">
      <img
        src="https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1400&q=90"
        alt="Halong Bay"
        className="h-full w-full object-cover"
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-14">
        <p className="font-serif text-[13px] font-semibold italic text-white">
          Halong Bay
        </p>
      </div>
    </div>


    {/* 3 — MARRAKECH */}
    <div className="relative overflow-hidden rounded-[6px_6px_10px_10px]">
      <img
        src="https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1400&q=90"
        alt="Marrakech"
        className="h-full w-full object-cover"
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-3 pt-16">
        <p className="font-serif text-[13px] font-semibold italic text-white">
          Marrakech
        </p>
      </div>
    </div>


    {/* 4 + 5 — BOTTOM RIGHT */}
    <div className="grid h-full grid-cols-[1fr_1fr] gap-[4px]">

      {/* TOKYO */}
      <div className="relative overflow-hidden rounded-[6px_6px_6px_20px]">
        <img
          src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=90"
          alt="Tokyo"
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-12">
          <p className="font-serif text-[12px] font-semibold italic text-white">
            Tokyo
          </p>
        </div>
      </div>


      {/* AMALFI COAST */}
      <div className="relative overflow-hidden rounded-[6px_6px_10px_6px]">
        <img
          src="https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1000&q=90"
          alt="Amalfi Coast"
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-3 pt-12">
          <p className="font-serif text-[12px] font-semibold italic text-white">
            Amalfi Coast
          </p>
        </div>
      </div>

    </div>

  </div>
</div>
          
          </div>
          </div>
        </section>
      )}

      {/* ========================= LOADING ========================= */}
      {loading && (
        <section className="mx-auto max-w-[1000px] px-5 py-16 md:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
<div className="tripz-loading-spinner mx-auto h-8 w-8 rounded-full border-4 border-slate-200 border-t-blue-600 dark-spinner" />            <h3 className="mt-5 text-lg font-bold text-slate-900">
              TripZ is working on your trip
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Finding the best flights, stays, places, food & routes for you.
            </p>
          </div>
        </section>
      )}

      {/* ========================= GENERATED DASHBOARD ========================= */}
      {result && !loading && (
        <div className="mx-auto flex max-w-[1500px]">
          {/* SIDEBAR */}
          <aside
            className={`sticky top-16 hidden h-[calc(100vh-64px)] shrink-0 border-r border-slate-200 bg-white transition-all duration-300 md:block ${
            navOpen ? "w-64" : "w-16"
            }`}
            >
            <div className="flex h-full flex-col p-3">
            {/* HAMBURGER BUTTON */}
            <button
            type="button"
            onClick={() => setNavOpen((prev) => !prev)}
            className={`mb-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 transition-all duration-200 hover:scale-105 hover:bg-sky-200 ${
            navOpen ? "ml-0" : "mx-auto"
            }`}
            title={navOpen ? "Collapse navigation" : "Open navigation"}
            aria-label={navOpen ? "Collapse navigation" : "Open navigation"}
            >
<Menu className="h-5 w-5 text-slate-700" />
            </button>

            {/* NAVIGATION */}
            <div
              className={`overflow-hidden transition-all duration-300 ${
              navOpen
              ? "visible max-h-[700px] opacity-100"
              : "invisible max-h-0 opacity-0"
              }`}
            > 
          

            <nav className="space-y-2">
                
            {/* WEATHER */}
            <button
              type="button"
              onClick={() => setActiveAgent("weather")}
              className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "weather" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
            >
            <CloudSun className="inline h-4 w-4" /> <span className="ml-2">Weather</span>
            </button>

              {/* SIGHTSEEING */}
            <button
            type="button"
            onClick={() => setActiveAgent("sightseeing")}
            className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "sightseeing" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
            >
          <MapPinned className="inline h-4 w-4" /> <span className="ml-2">Sightseeing</span>
          </button>

        {/* ITINERARY */}
        <button
          type="button"
          onClick={() => setActiveAgent("itinerary")}
          className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "itinerary" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
        >
          <CalendarDays className="inline h-4 w-4" /> <span className="ml-2">Itinerary</span>
        </button>

        {/* TRANSPORTATION */}
        <button
          type="button"
          onClick={() => setActiveAgent("transportation")}
          className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "transportation" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
        >
          <Plane className="inline h-4 w-4" /> <span className="ml-2">Transportation</span>
        </button>

        {/* LOCAL FOOD */}
        <button
          type="button"
          onClick={() => setActiveAgent("local-food")}
          className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "local-food" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
        >
          <Utensils className="inline h-4 w-4" /> <span className="ml-2">Local Food</span>
        </button>

        {/* HOTEL */}
        <button
          type="button"
          onClick={() => setActiveAgent("hotel")}
          className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "hotel" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
        >
          <HotelIcon className="inline h-4 w-4" /> <span className="ml-2">Hotel</span>
        </button>

        {/* ESTIMATED COST */}
        <button
          type="button"
          onClick={() => setActiveAgent("expenses")}
          className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "expenses" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
        >
          <Wallet className="inline h-4 w-4" /> <span className="ml-2">Estimated Cost</span>
        </button>

        {/* TRAVEL TIPS */}
        <button
          type="button"
          onClick={() => setActiveAgent("tips")}
          className={`tripz-sidebar-item w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 hover:bg-sky-50 hover:pl-4 ${activeAgent === "tips" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-blue-600"}`}
        >
          <Lightbulb className="inline h-4 w-4" /> <span className="ml-2">Travel Tips</span>
        </button>

      </nav>
    </div>
  </div>
</aside>
          {/* MAIN */}
          <section className="min-w-0 flex-1 p-5 md:p-8">
            {/* TRIP SUMMARY */}
            <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-7 text-white md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
                      TRAVEL PLANNER
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                      {from} → {destination}
                    </h2>
                    <p className="mt-2 text-sm text-blue-100">
                      {formatDate(departure)}
                      {tripType === "Round Trip" && returnDate
                        ? ` — ${formatDate(returnDate)}`
                        : ""}{" "}
                      · {travelers} traveler{Number(travelers) !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-5 py-3 backdrop-blur">
<p className="text-xs font-semibold uppercase tracking-wider text-white">                      Trip Type
                    </p>
                    <p className="mt-1 text-sm font-bold">{tripType}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ACTIVE AGENT PANEL */}
            {activeAgent !== "overview" && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
                  
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {activeAgent === "weather" && "Weather"}
                  {activeAgent === "sightseeing" && "Sightseeing"}
                  {activeAgent === "itinerary" && "Itinerary"}
                  {activeAgent === "transportation" && "Transportation"}
                  {activeAgent === "local-food" && "Local Food"}
                  {activeAgent === "hotel" && "Hotel"}
                  {activeAgent === "expenses" && "Estimated Cost"}
                  {activeAgent === "tips" && "Travel Tips"}
                </h2>
               <p className="mt-1 text-sm text-slate-500">
  {activeAgent === "weather" && "Explore the weather before you plan your days."}
  {activeAgent === "sightseeing" && "Explore must-see places and unforgettable experiences."}
  {activeAgent === "itinerary" && "Explore your journey with a day-by-day plan."}
  {activeAgent === "transportation" && "Explore the best flight options for your journey."}
  {activeAgent === "local-food" && "Explore local flavors and must-try dishes."}
  {activeAgent === "hotel" && "Explore comfortable stays that fit your trip."}
  {activeAgent === "expenses" && "Explore your complete travel budget breakdown."}
  {activeAgent === "tips" && "Explore useful tips for a smoother travel experience."}
</p>
              </div>
            )}

            { (activeAgent === "overview" || activeAgent === "weather") && (
              <>
                {/* WEATHER */}
                <WeatherCard />
              </>
            ) }

            { (activeAgent === "overview" || activeAgent === "transportation") && (
              <>
                {/* TRANSPORTATION */}
                <section
              id="transportation"
              className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <SectionHeader
                icon={<Plane className="tripz-accent h-5 w-5 text-blue-600" />}
                label=""
                title="Flight Options"
              />

              {outboundFlights.length > 0 ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Departure</p>
                    <span className="text-xs text-slate-400">
                      {outboundFlights.length} option{outboundFlights.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {outboundFlights.map((flight, index) => (
                      <FlightCard key={index} flight={flight} index={index} />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState icon={<Plane className="h-5 w-5 text-blue-600" />} text="No departure flight options were returned." />
              )}

              {returnFlights.length > 0 && (
                <div className="mt-7">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Return</p>
                    <span className="text-xs text-slate-400">
                      {returnFlights.length} option{returnFlights.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {returnFlights.map((flight, index) => (
                      <FlightCard
                        key={index}
                        flight={flight}
                        index={index}
                        returnFlight
                      />
                    ))}
                  </div>
                </div>
              )}
                </section>
              </>
            )}

            { (activeAgent === "overview" || activeAgent === "itinerary") && (
              <>
                {/* ITINERARY */}
                <section
              id="itinerary"
              className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <SectionHeader
                icon={<CalendarDays className="tripz-accent h-5 w-5 text-blue-600" />}
                label=""
                title="Your Day-by-Day Plan"
              />

              {itinerary.length > 0 ? (
                <div className="space-y-4">
                  {itinerary.map((day, index) => (
                    <ItineraryCard key={index} day={day} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<CalendarDays className="h-5 w-5 text-blue-600" />} text="Your itinerary will appear here." />
              )}
                </section>
              </>
            )}

            { (activeAgent === "overview" || activeAgent === "sightseeing") && (
              <>
                {/* SIGHTSEEING + MAP */}
                <div className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <section
                id="attractions"
                className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
              >
                <SectionHeader
                  icon={<MapPinned className="tripz-accent h-5 w-5 text-blue-600" />}
                  label=""
                  title="Places to Explore"
                />

                {attractions.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {attractions.map((attraction, index) => (
                      <AttractionCard
                        key={index}
                        attraction={attraction}
                        index={index}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<MapPinned className="h-5 w-5 text-blue-600" />} text="Recommended attractions will appear here." />
                )}
              </section>

              <section
                id="map"
                className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
              >
                <SectionHeader
                  icon={<Map className="h-5 w-5 text-blue-600" />}
                  label=""
                  title="Explore Maps"
                />

                <div className="rounded-2xl bg-slate-50 p-5">
                  <div className="mb-5 flex h-40 items-center justify-center rounded-xl bg-slate-200 text-center">
                    <div>
                      <Map className="mx-auto h-10 w-10 text-blue-500" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        Trip Map
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Search anything in Google Maps
                      </p>
                    </div>
                  </div>

                  <p className="mb-3 text-sm leading-6 text-slate-500">
                    Search for any place, restaurant, hotel or route.
                  </p>

                  <input
                    id="mapsSearch"
                    type="text"
                    placeholder="Search places or routes..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openMaps();
                    }}
                  />

                  <button
                    type="button"
                    onClick={openMaps}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 hover:shadow-lg"
                  >
                    <Map className="mr-2 inline h-4 w-4" />
                    Open Maps
                  </button>
                </div>
              </section>
                </div>
              </>
            )}

            { (activeAgent === "overview" || activeAgent === "local-food") && (
              <>
                {/* LOCAL FOOD */}
                <section
              id="local-food"
              className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <SectionHeader
                icon={<Utensils className="h-5 w-5 text-orange-500" />}
                label=""
                title="Flavors to Discover"
              />

              {localFood.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {localFood.map((food, index) => (
                    <LocalFoodCard key={index} food={food} index={index} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Utensils className="h-5 w-5 text-orange-500" />}
                  text="Local food recommendations were not returned for this trip."
                />
              )}
                </section>
              </>
            )}

            { (activeAgent === "overview" || activeAgent === "hotel") && (
              <>
                {/* HOTEL */}
                <section
              id="hotel"
              className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <SectionHeader icon={<HotelIcon className="tripz-accent h-5 w-5 text-blue-600" />} label="" title="Where You'll Stay" />

              {hotels.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {hotels.map((hotel, index) => (
                    <HotelCard key={index} hotel={hotel} index={index} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<HotelIcon className="h-5 w-5 text-blue-600" />} text="Hotel options will appear here." />
              )}
                </section>
              </>
            )}

            { (activeAgent === "overview" || activeAgent === "expenses") && (
              <>
                {/* ESTIMATED COST */}
                <section
              id="expenses"
              className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <SectionHeader
                icon={<Wallet className="h-5 w-5 text-emerald-600" />}
                label=""
                title=""
              />

              <div className="rounded-2xl bg-slate-50 p-6">
               
                  <div>
     
                    <div className="mt-2 flex items-baseline gap-3">
  <p className="text-2xl font-extrabold text-slate-800">
   Estimated cost may vary based on your travel preferences:
  </p>

  <p className="text-2xl font-extrabold text-slate-800">
    {expenseTotal
      ? formatRupees(expenseTotal)
      : "Not available"}
  </p>
</div>
                

                  <p className="text-sm font-medium text-slate-500">
                    For {travelers} traveler{Number(travelers) !== 1 ? "s" : ""}
                  </p>
                </div>

                {parsedExpenseItems.length > 0 ? (
                  <div className="mt-7 space-y-5">
                    {parsedExpenseItems.map((item, index) => {
                      const rawPercentage =
                        expenseTotal > 0
                          ? (item.numeric / expenseTotal) * 100
                          : 0;

                      const percentage =
                        rawPercentage > 0
                          ? Math.min(100, Math.round(rawPercentage))
                          : 0;

                      const barWidth =
                        rawPercentage > 0
                          ? Math.max(2, Math.min(100, rawPercentage))
                          : 0;

                      return (
                        <div key={index}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-600">
                              {item.name}
                            </span>
                            <span className="font-bold text-slate-900">
                              {item.amount}
                            </span>
                          </div>

                          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-700"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>

                          <p className="tripz-accent mt-1 text-right text-[11px] font-semibold text-blue-600">
                            {percentage}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                    No cost breakdown is available yet.
                  </div>
                )}
              </div>
                </section>
              </>
            )}

            { (activeAgent === "overview" || activeAgent === "tips") && (
              <>
                {/* TRAVEL TIPS */}
                <section
              id="tips"
              className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <SectionHeader
                icon={null}
                label=""
                title="Useful Tips for Your Trip"
              />

              {tips.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {tips.map((tip: any, index: number) => (
                    <div
                      key={index}
                      className="flex gap-3 rounded-xl bg-slate-50 p-4 transition hover:bg-blue-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                      </div>
                      <p className="text-sm leading-6 text-slate-600">
                        {typeof tip === "string"
                          ? tip
                          : getValue(tip, ["tip", "text", "description"], "Travel tip")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
                  text="Travel tips were not returned for this trip."
                />
              )}
                </section>
              </>
            )}
          </section>
        </div>
      )}

<style jsx global>{`

  /* ==========================================
     TRIPZ DARK THEME
     ========================================== */

  .tripz-dark {
    background: #0f172a !important;
    color: #e2e8f0 !important;
    min-height: 100vh;
  }

  /* Main backgrounds */
  .tripz-dark .bg-slate-50 {
    background-color: #0f172a !important;
  }

  .tripz-dark .bg-white {
    background-color: #111827 !important;
  }

  /* Header */
  .tripz-dark header {
    background-color: rgba(15, 23, 42, 0.96) !important;
    border-color: #334155 !important;
  }

  /* Sidebar */
  .tripz-dark aside {
    background-color: #111827 !important;
    border-color: #334155 !important;
  }

  /* Main cards */
  .tripz-dark section {
    border-color: #334155 !important;
  }

  /* Common borders */
  .tripz-dark .border-slate-200 {
    border-color: #334155 !important;
  }
    .tripz-dark .dark-spinner {
  border-color: #334155 !important;
  border-top-color: #bb86fc !important;
}

  .tripz-dark .border-slate-300 {
    border-color: #475569 !important;
  }

  /* Text */
  .tripz-dark .text-slate-900 {
    color: #f8fafc !important;
  }

  .tripz-dark .text-slate-800 {
    color: #f1f5f9 !important;
  }

  .tripz-dark .text-slate-700 {
    color: #e2e8f0 !important;
  }

  .tripz-dark .text-slate-600 {
    color: #cbd5e1 !important;
  }

  .tripz-dark .text-slate-500 {
    color: #94a3b8 !important;
  }

  .tripz-dark .text-slate-400 {
    color: #94a3b8 !important;
  }

  /* Secondary cards */
  .tripz-dark .bg-slate-100 {
    background-color: #1e293b !important;
  }

  .tripz-dark .bg-slate-50 {
    background-color: #0f172a !important;
  }

  /* Hover states */
  .tripz-dark .hover\\:bg-blue-50:hover {
    background-color: #1e3a5f !important;
  }

  /* Navigation active state */
  .tripz-dark .bg-blue-50 {
    background-color: #172554 !important;
  }

  /* Small information cards */
  .tripz-dark .bg-slate-50\\/80 {
    background-color: #1e293b !important;
  }

  /* Inputs */
  .tripz-dark input,
  .tripz-dark textarea,
  .tripz-dark select {
    background-color: #1e293b !important;
    color: #f8fafc !important;
    border-color: #475569 !important;
  }

  .tripz-dark input::placeholder,
  .tripz-dark textarea::placeholder {
    color: #94a3b8 !important;
  }

  /* White text stays white */
  .tripz-dark .text-white {
    color: #ffffff !important;
  }

  /* Dividers */
  .tripz-dark hr {
    border-color: #334155 !important;
  }

  /* Expense progress background */
  .tripz-dark .bg-slate-200 {
    background-color: #334155 !important;
  }

  /* Navigation button */
  .tripz-dark .bg-sky-100 {
    background-color: #172554 !important;
  }

  .tripz-dark .hover\\:bg-sky-200:hover {
    background-color: #1e3a5f !important;
  }

  /* Cards inside cards */
  .tripz-dark .bg-slate-50.p-4,
  .tripz-dark .bg-slate-50.p-5,
  .tripz-dark .bg-slate-50.p-6 {
    background-color: #1e293b !important;
  }

  /* Shadows */
  .tripz-dark .shadow-sm,
  .tripz-dark .shadow-md,
  .tripz-dark .shadow-lg {
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25) !important;
  }

  /* Theme toggle */
  .tripz-dark .theme-toggle {
    background-color: #020617 !important;
    border-color: #cbd5e1 !important;
  }

  .tripz-dark .theme-toggle-light {
    color: #94a3b8 !important;
    background-color: transparent !important;
  }

  .tripz-dark .theme-toggle-dark {
    background-color: #475569 !important;
    color: #ffffff !important;
  }

  /* Landing page colors */
  .tripz-dark [class*="bg-[#faf8f3]"] {
    background-color: #0f172a !important;
  }

  .tripz-dark [class*="text-[#171514]"] {
    color: #f8fafc !important;
  }

  .tripz-dark [class*="bg-[#fafbfc]"] {
    background-color: #1e293b !important;
  }

  .tripz-dark .bg-\[\#faf8f3\] {
    background-color: #0f172a !important;
  }

  .tripz-dark label {
    color: #cbd5e1 !important;
  }

  .tripz-dark option {
    background-color: #1e293b !important;
    color: #f8fafc !important;
  }

  /* Date controls */
  .tripz-dark input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(1) brightness(1.7);
    opacity: 0.9;
  }

  /* Sidebar hover */
  .tripz-dark .hover\:bg-sky-50:hover {
    background-color: #172554 !important;
  }

  /* Plan My Trip */
  .tripz-dark .dark\:bg-blue-600 {
    background-color: #2563eb !important;
  }

  /* Requested dark-theme accent from the supplied reference */
  .tripz-dark .tripz-accent {
    color: #bb86fc !important;
  }

  .tripz-dark .tripz-accent-badge {
    color: #bb86fc !important;
    background-color: rgba(187, 134, 252, 0.12) !important;
    border-color: rgba(187, 134, 252, 0.28) !important;
  }

  /* Sidebar hover + active state */
  .tripz-dark .tripz-sidebar-item:hover {
    background-color: rgba(187, 134, 252, 0.10) !important;
    color: #bb86fc !important;
  }

  .tripz-dark .tripz-sidebar-item:hover svg {
    color: #bb86fc !important;
  }

  .tripz-dark .tripz-sidebar-item[class*="bg-blue-50"] {
    background-color: rgba(187, 134, 252, 0.16) !important;
    color: #bb86fc !important;
  }

  .tripz-dark .tripz-sidebar-item[class*="bg-blue-50"] svg {
    color: #bb86fc !important;
  }

  /* Make the generation spinner visibly rotate */
  .tripz-loading-spinner {
    animation: tripz-spin 0.9s linear infinite !important;
    transform-origin: center;
  }

  @keyframes tripz-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Smooth theme transition */
  .tripz-app,
  .tripz-app header,
  .tripz-app aside,
  .tripz-app section,
  .tripz-app div,
  .tripz-app input,
  .tripz-app textarea,
  .tripz-app select {
    transition:
      background-color 250ms ease,
      border-color 250ms ease,
      color 250ms ease;
  }
`}</style>
    </main>
  );
}