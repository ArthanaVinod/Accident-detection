import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Activity, Loader2, Info, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapView() {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [clickCoord, setClickCoord] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [placeName, setPlaceName] = useState(null);
    const searchTimeout = useRef(null);
    const markerRef = useRef(null);
    const abortRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        // Center on India
        mapInstance.current = L.map(mapRef.current, {
            center: [20.5937, 78.9629],
            zoom: 5,
            zoomControl: false,
            preferCanvas: true,
            fadeAnimation: false,
            zoomAnimation: true,
            markerZoomAnimation: false,
            tap: true
        });

        // Fast hybrid tiles (CartoDB Voyager + satellite blend via Esri)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri',
            maxZoom: 19,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2,
            tileSize: 256,
            crossOrigin: true
        }).addTo(mapInstance.current);

        // Lightweight labels overlay (CartoDB - very fast CDN)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
            attribution: '',
            subdomains: 'abcd',
            maxZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 2,
            pane: 'overlayPane'
        }).addTo(mapInstance.current);

        // Map Click → Predict + Reverse Geocode
        mapInstance.current.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            setClickCoord({ lat, lng });
            setLoading(true);
            setPrediction(null);
            setPlaceName(null);

            // Drop a marker
            if (markerRef.current) markerRef.current.remove();
            markerRef.current = L.circleMarker([lat, lng], {
                radius: 8, color: '#FF0000', fillColor: '#FF0000',
                fillOpacity: 0.6, weight: 2
            }).addTo(mapInstance.current);

            // 1. Risk prediction (critical - must succeed)
            try {
                const riskRes = await fetch('http://localhost:5000/api/predict_risk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lng })
                });
                const riskData = await riskRes.json();
                setPrediction(riskData);
            } catch (err) {
                console.error("Prediction failed:", err);
                setPrediction({ risk_score: 0, severity: 'ERROR', historical_count: 0, 
                    recommendation: 'Backend unreachable - restart Flask server', in_coverage: false,
                    coverage_region: 'Unknown', nearest_record_km: 0 });
            }
            setLoading(false);

            // 2. Reverse geocode (best-effort, non-blocking)
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&accept-language=en`);
                const geoData = await geoRes.json();
                if (geoData.display_name) {
                    setPlaceName(geoData.display_name.split(',').slice(0, 3).join(',').trim());
                }
            } catch (e) { /* geocode is optional */ }
        });

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // Debounced search (300ms)
    const handleSearchInput = (val) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.length < 3) { setSearchResults([]); return; }

        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=in&accept-language=en`);
                const data = await res.json();
                setSearchResults(data);
            } catch (e) { /* */ }
            setSearching(false);
        }, 300);
    };

    const flyToResult = (result) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        if (mapInstance.current) {
            mapInstance.current.flyTo([lat, lon], 14, { duration: 1.2 });
        }
        setSearchQuery(result.display_name.split(',').slice(0, 2).join(','));
        setSearchResults([]);
    };

    return (
        <div className="map-root">
            {/* HUD Header */}
            <div className="map-hud-header">
                <div className="map-hud-row">
                    <div>
                        <Link to="/" className="map-back-btn">
                            <ArrowLeft size={16} /> EXIT_STATION
                        </Link>
                        <h1 className="map-title">
                            Spatial <span style={{ color: '#FF0000' }}>Predictor</span>
                        </h1>
                        <p className="map-subtitle">
                            CLICK_ANY_SECTOR // 412K_RECORDS_INDEXED
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="map-search-wrap">
                        <div className="map-search-box">
                            <Search size={16} color="#FF0000" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                placeholder="Search location in India..."
                                className="map-search-input"
                            />
                            {searchQuery && (
                                <X size={14} color="#666" style={{ cursor: 'pointer', flexShrink: 0 }} 
                                   onClick={() => { setSearchQuery(''); setSearchResults([]); }} />
                            )}
                        </div>
                        
                        {searchResults.length > 0 && (
                            <div className="map-search-dropdown">
                                {searchResults.map((r, i) => (
                                    <div key={i} onClick={() => flyToResult(r)} className="map-search-item">
                                        <span style={{ color: '#FF0000', marginRight: '0.5rem' }}>⬤</span>
                                        {r.display_name.length > 55 ? r.display_name.slice(0, 55) + '...' : r.display_name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Map */}
            <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

            {/* Prediction HUD */}
            <div className="map-prediction-wrap">
                <AnimatePresence mode="wait">
                    {(loading || prediction) && (
                        <motion.div 
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.25 }}
                            className="map-prediction-card"
                        >
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                                    <Loader2 className="animate-spin" size={28} color="#FF0000" />
                                    <div>
                                        <p style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.1rem' }}>SCANNING...</p>
                                        <p style={{ fontSize: '0.6rem', color: '#666', fontFamily: 'monospace' }}>
                                            {clickCoord?.lat.toFixed(4)}, {clickCoord?.lng.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {placeName && (
                                        <div className="map-location-tag">
                                            <p style={{ fontSize: '0.5rem', color: '#888', marginBottom: '0.1rem', fontFamily: 'monospace' }}>LOCATION</p>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{placeName}</p>
                                        </div>
                                    )}

                                    {/* Out-of-coverage warning */}
                                    {prediction.in_coverage === false && (
                                        <div style={{ 
                                            padding: '0.7rem', marginBottom: '0.8rem',
                                            background: 'rgba(255,180,0,0.08)', borderLeft: '2px solid #FFB400',
                                            fontSize: '0.65rem', color: '#FFB400', lineHeight: 1.5
                                        }}>
                                            ⚠ OUT OF COVERAGE — Dataset covers <b>{prediction.coverage_region}</b> only. 
                                            Navigate to the UK for live predictions. Nearest record: <b>{prediction.nearest_record_km} km</b> away.
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                        <span style={{ fontSize: '0.65rem', color: prediction.in_coverage === false ? '#FFB400' : '#888', fontFamily: 'monospace' }}>
                                            {prediction.in_coverage === false ? 'NO_DATA_ZONE' : 'SCAN_COMPLETE'}
                                        </span>
                                        <div style={{ background: prediction.in_coverage === false ? '#FFB400' : (prediction.risk_score > 40 ? '#FF0000' : '#00FFBB'), height: '6px', width: '35px' }} />
                                    </div>
                                    
                                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: prediction.in_coverage === false ? '#FFB400' : (prediction.risk_score > 70 ? '#FF0000' : '#fff') }}>
                                        {prediction.in_coverage === false ? 'NO DATA' : prediction.severity} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#666' }}>RISK</span>
                                    </h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '1rem' }}>
                                        <div className="map-stat-box">
                                            <p className="map-stat-label">RISK_SCORE</p>
                                            <p className="map-stat-value">{prediction.risk_score.toFixed(1)}%</p>
                                        </div>
                                        <div className="map-stat-box">
                                            <p className="map-stat-label">CLUSTERS</p>
                                            <p className="map-stat-value">{prediction.historical_count}</p>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', padding: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.65rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                        <Info size={13} color="#FF0000" />
                                        <span>{prediction.recommendation.toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Scanline */}
            <div className="map-scanline" />

            <style>{`
                .map-root { height: 100vh; width: 100vw; background: #03050a; position: relative; overflow: hidden; }
                .leaflet-container { background: #03050a !important; cursor: crosshair !important; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .leaflet-bar { border: none !important; box-shadow: none !important; }
                .leaflet-control-attribution { background: rgba(0,0,0,0.6) !important; color: #444 !important; font-size: 0.45rem !important; }

                .map-hud-header {
                    position: absolute; top: 0; left: 0; width: 100%;
                    padding: 1.2rem 1.5rem; z-index: 1000; pointer-events: none;
                    background: linear-gradient(to bottom, rgba(3,5,10,0.95), transparent);
                }
                .map-hud-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
                .map-back-btn {
                    pointer-events: auto; color: #fff; text-decoration: none;
                    display: inline-flex; align-items: center; gap: 0.4rem;
                    font-size: 0.65rem; font-weight: 800; letter-spacing: 0.15rem;
                    border: 1px solid rgba(255,255,255,0.1); padding: 0.4rem 0.8rem;
                    background: rgba(255,255,255,0.02); backdrop-filter: blur(10px);
                }
                .map-title { font-size: 2.2rem; font-weight: 800; color: #fff; margin: 0.6rem 0 0; letter-spacing: -0.04em; }
                .map-subtitle { color: #555; font-size: 0.55rem; font-family: monospace; letter-spacing: 0.12rem; margin-top: 0.2rem; }

                .map-search-wrap { pointer-events: auto; position: relative; width: 300px; flex-shrink: 0; }
                .map-search-box {
                    display: flex; align-items: center; gap: 0.6rem;
                    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
                    padding: 0.6rem 0.8rem; backdrop-filter: blur(20px);
                }
                .map-search-input {
                    background: transparent; border: none; outline: none;
                    color: #fff; font-size: 0.8rem; font-weight: 600; width: 100%;
                }
                .map-search-input::placeholder { color: #555; }
                .map-search-dropdown {
                    position: absolute; top: 100%; left: 0; right: 0;
                    background: rgba(3,5,10,0.97); border: 1px solid rgba(255,255,255,0.08);
                    border-top: none; max-height: 220px; overflow-y: auto;
                    backdrop-filter: blur(30px);
                }
                .map-search-item {
                    padding: 0.7rem 0.8rem; cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    font-size: 0.7rem; color: #ccc; transition: background 0.12s;
                }
                .map-search-item:hover { background: rgba(255,0,0,0.08); }

                .map-prediction-wrap {
                    position: absolute; bottom: 2rem; left: 2rem; z-index: 1000;
                    width: 340px; pointer-events: auto;
                }
                .map-prediction-card {
                    background: rgba(3,5,10,0.95); border-left: 3px solid #FF0000;
                    padding: 1.5rem; backdrop-filter: blur(30px);
                    color: #fff; box-shadow: 0 15px 40px rgba(0,0,0,0.5);
                }
                .map-location-tag {
                    margin-bottom: 0.8rem; padding: 0.5rem 0.7rem;
                    background: rgba(255,0,0,0.05); border-left: 2px solid #FF0000;
                }
                .map-stat-box { background: rgba(255,255,255,0.03); padding: 0.7rem; }
                .map-stat-label { font-size: 0.5rem; color: #666; margin-bottom: 0.15rem; }
                .map-stat-value { font-size: 1.1rem; font-weight: 800; }

                .map-scanline {
                    position: absolute; inset: 0;
                    background: linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.12) 50%);
                    background-size: 100% 4px;
                    pointer-events: none; opacity: 0.15; z-index: 2;
                }

                /* RESPONSIVE */
                @media (max-width: 1024px) {
                    .map-prediction-wrap { width: 300px; }
                    .map-search-wrap { width: 260px; }
                    .map-title { font-size: 1.8rem; }
                }
                @media (max-width: 768px) {
                    .map-hud-row { flex-direction: column; gap: 0.5rem; }
                    .map-title { font-size: 1.4rem; }
                    .map-subtitle { display: none; }
                    .map-search-wrap { width: 100%; }
                    .map-prediction-wrap { left: 0.6rem; right: 0.6rem; bottom: 0.6rem; width: auto; }
                    .map-prediction-card { padding: 0.8rem; }
                    .map-hud-header { padding: 0.6rem 0.8rem; }
                    .map-stat-value { font-size: 0.95rem; }
                    .map-back-btn { font-size: 0.55rem; padding: 0.3rem 0.5rem; }
                }
                @media (max-width: 480px) {
                    .map-title { font-size: 1.1rem; }
                    .map-back-btn { font-size: 0.55rem; padding: 0.3rem 0.6rem; }
                    .map-prediction-card h3 { font-size: 1.4rem !important; }
                }
            `}</style>
        </div>
    );
}
