import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function formatValue(value) {
  return value?.trim() ? value : '-';
}

function LocationQuickSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchLocations(query);
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        }
      } catch (_error) {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const onSelect = (item) => {
    setQuery('');
    setResults([]);
    setOpen(false);

    navigate(`/locations?selected=${item.id}`, {
      state: {
        selectedLocation: item
      }
    });
  };

  const showDropdown = open && (loading || query.trim().length > 0);

  return (
    <div className="location-quick-search" ref={containerRef}>
      <input
        className="input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) {
            setOpen(true);
          }
        }}
        placeholder="Buscar local por nombre, key Aloha, CUIT o razon social"
        aria-label="Buscar local"
      />

      {showDropdown && (
        <div className="location-quick-search-dropdown">
          {loading && <div className="location-quick-search-status">Buscando...</div>}

          {!loading && results.length === 0 && (
            <div className="location-quick-search-status">Sin resultados</div>
          )}

          {!loading &&
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="location-quick-search-item"
                onClick={() => onSelect(item)}
              >
                <strong>{item.name}</strong>
                <small>Key Aloha: {formatValue(item.aloha_key)}</small>
                <small>CUIT: {formatValue(item.cuit)}</small>
                <small>Razon social: {formatValue(item.razon_social)}</small>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default LocationQuickSearch;
