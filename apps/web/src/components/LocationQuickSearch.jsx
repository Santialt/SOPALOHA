import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function formatValue(value) {
  return value?.trim() ? value : '-';
}

function LocationQuickSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const listboxId = useId();
  const statusId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchLocations(query);
        if (!cancelled) {
          const nextResults = Array.isArray(data) ? data : [];
          setResults(nextResults);
          setActiveIndex(nextResults.length ? 0 : -1);
          setOpen(true);
        }
      } catch (_error) {
        if (!cancelled) {
          setResults([]);
          setActiveIndex(-1);
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
    setActiveIndex(-1);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const onSelect = (item) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    navigate(`/locations/${item.id}`);
  };

  const onKeyDown = (event) => {
    if (!showDropdown) {
      if (event.key === 'ArrowDown' && results.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      setActiveIndex((current) => {
        if (!results.length) return -1;
        return current < results.length - 1 ? current + 1 : 0;
      });
      event.preventDefault();
    }

    if (event.key === 'ArrowUp') {
      setActiveIndex((current) => {
        if (!results.length) return -1;
        return current > 0 ? current - 1 : results.length - 1;
      });
      event.preventDefault();
    }

    if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      onSelect(results[activeIndex]);
      event.preventDefault();
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const showDropdown = open && (loading || query.trim().length > 0);
  const hasQuery = query.trim().length > 0;
  const shouldShowHint = query.trim().length > 0 && query.trim().length < 2;

  return (
    <div className="location-quick-search" ref={containerRef}>
      <label className="visually-hidden" htmlFor="location-quick-search-input">
        Buscar local por nombre, key Aloha, CUIT o razon social
      </label>
      <input
        id="location-quick-search-input"
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
        onKeyDown={onKeyDown}
        placeholder="Buscar local por nombre, key Aloha o CUIT"
        aria-label="Buscar local"
        aria-autocomplete="list"
        aria-controls={showDropdown ? listboxId : undefined}
        aria-describedby={statusId}
        aria-expanded={showDropdown}
        aria-activedescendant={
          activeIndex >= 0 && results[activeIndex] ? `${listboxId}-option-${results[activeIndex].id}` : undefined
        }
        role="combobox"
      />

      <div id={statusId} className="location-quick-search-meta" aria-live="polite">
        {!hasQuery && 'Enter para abrir el local directo.'}
        {shouldShowHint && 'Escribi al menos 2 caracteres para reducir ruido.'}
        {!loading && hasQuery && !shouldShowHint && results.length > 0 && `${results.length} resultado(s).`}
        {!loading && hasQuery && !shouldShowHint && results.length === 0 && 'Sin coincidencias.'}
        {loading && 'Buscando locales...'}
      </div>

      {showDropdown && (
        <div className="location-quick-search-dropdown" id={listboxId} role="listbox">
          {shouldShowHint && (
            <div className="location-quick-search-status">Segui escribiendo para acotar la busqueda.</div>
          )}

          {!shouldShowHint && loading && (
            <div className="location-quick-search-status">Buscando...</div>
          )}

          {!shouldShowHint && !loading && results.length === 0 && (
            <div className="location-quick-search-status">Sin resultados</div>
          )}

          {!shouldShowHint &&
            !loading &&
            results.map((item, index) => (
              <button
                key={item.id}
                id={`${listboxId}-option-${item.id}`}
                type="button"
                className={`location-quick-search-item ${activeIndex === index ? 'active' : ''}`}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={activeIndex === index}
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
