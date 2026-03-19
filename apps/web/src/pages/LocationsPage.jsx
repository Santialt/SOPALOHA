import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

const initialForm = {
  name: '',
  company_name: '',
  razon_social: '',
  cuit: '',
  llave_aloha: '',
  version_aloha: '',
  version_modulo_fiscal: '',
  usa_nbo: false,
  city: '',
  country: '',
  address: '',
  phone: '',
  cantidad_licencias_aloha: '',
  tiene_kitchen: false,
  usa_insight_pulse: false,
  cmc: '',
  status: 'abierto',
  fecha_apertura: '',
  fecha_cierre: '',
  notes: ''
};

function mapLocationToForm(location) {
  return {
    ...initialForm,
    name: location.name || '',
    company_name: location.company_name || '',
    razon_social: location.razon_social || '',
    cuit: location.cuit || '',
    llave_aloha: location.llave_aloha || '',
    version_aloha: location.version_aloha || '',
    version_modulo_fiscal: location.version_modulo_fiscal || '',
    country: location.country || '',
    city: location.city || '',
    address: location.address || '',
    phone: location.phone || '',
    cmc: location.cmc || '',
    status: location.status || 'abierto',
    notes: location.notes || '',
    usa_nbo: Boolean(location.usa_nbo),
    tiene_kitchen: Boolean(location.tiene_kitchen),
    usa_insight_pulse: Boolean(location.usa_insight_pulse),
    cantidad_licencias_aloha: location.cantidad_licencias_aloha ?? '',
    fecha_apertura: location.fecha_apertura || '',
    fecha_cierre: location.fecha_cierre || ''
  };
}

function setLocationStatus(setter, status) {
  setter((current) => ({
    ...current,
    status,
    fecha_cierre: status === 'cerrado' ? current.fecha_cierre : ''
  }));
}

function setBooleanSelect(setter, field, value) {
  setter((current) => ({
    ...current,
    [field]: value === 'si'
  }));
}

function isRowActionTarget(target) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, select, textarea'));
}

function LocationsPage() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const rowRefs = useRef(new Map());
  const selectedId = Number(searchParams.get('selected'));
  const validSelectedId = Number.isInteger(selectedId) ? selectedId : null;
  const selectedLocationFromState = routeLocation.state?.selectedLocation || null;

  const { load: loadLocations, loading, error, setError } = useDataLoader(async () => {
    const data = await api.getLocations();
    setLocations(data);
  }, []);

  const filtered = useMemo(() => {
    if (validSelectedId) {
      return locations.filter((location) => location.id === validSelectedId);
    }

    const term = search.trim().toLowerCase();
    if (!term) return locations;

    return locations.filter((location) => {
      return [
        location.name,
        location.company_name,
        location.razon_social,
        location.cuit,
        location.llave_aloha,
        location.version_aloha,
        location.city,
        location.country,
        location.address,
        location.phone,
        location.cmc
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [locations, search, validSelectedId]);
  const hasActiveSearch = search.trim().length > 0;
  const locationCountLabel = filtered.length === 1 ? '1 local' : `${filtered.length} locales`;

  useEffect(() => {
    if (!selectedLocationFromState || validSelectedId) return;

    setSearchParams(
      (currentParams) => {
        const next = new URLSearchParams(currentParams);
        next.set('selected', String(selectedLocationFromState.id));
        return next;
      },
      { replace: true }
    );
  }, [selectedLocationFromState, setSearchParams, validSelectedId]);

  useEffect(() => {
    if (validSelectedId) {
      setSearch('');
    }
  }, [validSelectedId]);

  useEffect(() => {
    if (!validSelectedId || filtered.length === 0) return;

    const frameId = window.requestAnimationFrame(() => {
      rowRefs.current.get(validSelectedId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [filtered, validSelectedId]);

  const onSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        await api.updateLocation(editingId, form);
        setSuccess(`Local #${editingId} actualizado.`);
      } else {
        await api.createLocation(form);
        setSuccess('Local creado.');
      }

      setForm(initialForm);
      setEditingId(null);
      await loadLocations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (location, event) => {
    event.stopPropagation();
    setSuccess('');
    setEditingId(location.id);
    setForm(mapLocationToForm(location));
  };

  const onDelete = async (location, event) => {
    event.stopPropagation();
    const ok = window.confirm(`Eliminar el local "${location.name}"?`);
    if (!ok) return;

    setDeletingId(location.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteLocation(location.id);
      setSuccess(`Local #${location.id} eliminado.`);
      if (editingId === location.id) {
        setEditingId(null);
        setForm(initialForm);
      }
      await loadLocations();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando locales..." />;

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-head wrap">
          <div>
            <h2>{editingId ? `Editar local #${editingId}` : 'Crear local'}</h2>
            <small className="panel-caption">
              Carga primero identificacion y estado. Completa el resto solo si aporta soporte operativo.
            </small>
          </div>
        </div>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Nombre *
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>

          <label>
            Empresa
            <input
              className="input"
              value={form.company_name}
              onChange={(event) => setForm({ ...form, company_name: event.target.value })}
            />
          </label>

          <label>
            CUIT
            <input
              className="input"
              value={form.cuit}
              onChange={(event) => setForm({ ...form, cuit: event.target.value })}
            />
          </label>

          <label>
            Razon social
            <input
              className="input"
              value={form.razon_social}
              onChange={(event) => setForm({ ...form, razon_social: event.target.value })}
            />
          </label>

          <label>
            Ciudad
            <input
              className="input"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </label>

          <label>
            Pais
            <input
              className="input"
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
            />
          </label>

          <label>
            Direccion
            <input
              className="input"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </label>

          <label>
            Telefono de contacto
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>

          <label>
            Key Aloha
            <input
              className="input"
              value={form.llave_aloha}
              onChange={(event) => setForm({ ...form, llave_aloha: event.target.value })}
            />
          </label>

          <label>
            Cantidad de licencias Aloha
            <input
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.cantidad_licencias_aloha}
              onChange={(event) =>
                setForm({ ...form, cantidad_licencias_aloha: event.target.value })
              }
            />
          </label>

          <label>
            Version Aloha
            <input
              className="input"
              value={form.version_aloha}
              onChange={(event) => setForm({ ...form, version_aloha: event.target.value })}
            />
          </label>

          <label>
            Version Fiscal
            <input
              className="input"
              value={form.version_modulo_fiscal}
              onChange={(event) => setForm({ ...form, version_modulo_fiscal: event.target.value })}
            />
          </label>

          <label>
            Kitchen
            <select
              className="input"
              value={form.tiene_kitchen ? 'si' : 'no'}
              onChange={(event) => setBooleanSelect(setForm, 'tiene_kitchen', event.target.value)}
            >
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>

          <label>
            CMC
            <input
              className="input"
              value={form.cmc}
              onChange={(event) => setForm({ ...form, cmc: event.target.value })}
            />
          </label>

          <label>
            PULSE INSIGHT
            <select
              className="input"
              value={form.usa_insight_pulse ? 'si' : 'no'}
              onChange={(event) =>
                setBooleanSelect(setForm, 'usa_insight_pulse', event.target.value)
              }
            >
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>

          <label>
            Estado del local
            <select
              className="input"
              value={form.status}
              onChange={(event) => setLocationStatus(setForm, event.target.value)}
            >
              {enums.locationStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label>
            NBO
            <select
              className="input"
              value={form.usa_nbo ? 'si' : 'no'}
              onChange={(event) => setBooleanSelect(setForm, 'usa_nbo', event.target.value)}
            >
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>

          <label>
            Fecha de apertura
            <input
              type="date"
              className="input"
              value={form.fecha_apertura}
              onChange={(event) => setForm({ ...form, fecha_apertura: event.target.value })}
            />
          </label>

          {form.status === 'cerrado' && (
            <label>
              Fecha de cierre
              <input
                type="date"
                className="input"
                value={form.fecha_cierre}
                onChange={(event) => setForm({ ...form, fecha_cierre: event.target.value })}
              />
            </label>
          )}

          <label className="full-row">
            Notas generales
            <textarea
              className="input"
              rows="3"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>

          <div className="form-actions">
            <button className="btn-primary" disabled={saving} type="submit">
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios del local' : 'Crear local'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(initialForm);
                  setSuccess('');
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="section-head">
          <div>
            <h2>Listado de locales</h2>
            {validSelectedId && (
              <small>
                Local enfocado: {selectedLocationFromState?.name || `#${validSelectedId}`}
              </small>
            )}
            {!validSelectedId && (
              <small>
                {locationCountLabel}
                {hasActiveSearch ? ` para "${search.trim()}"` : ` de ${locations.length} registrados`}
              </small>
            )}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar por nombre, CUIT, key Aloha, ciudad o telefono"
            className="input"
            disabled={Boolean(validSelectedId)}
            aria-label="Filtrar listado de locales"
          />
        </div>

        <InlineError message={error} />
        <InlineSuccess message={success} />
        {validSelectedId && (
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Limpiar foco rapido
            </button>
          </div>
        )}

        <div className="table-wrap table-wrap-wide">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>CUIT</th>
                <th>Aloha</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((location) => (
                <tr
                  key={location.id}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(location.id, node);
                    } else {
                      rowRefs.current.delete(location.id);
                    }
                  }}
                  onClick={() => navigate(`/locations/${location.id}`)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || isRowActionTarget(event.target)) {
                      return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/locations/${location.id}`);
                    }
                  }}
                  className={`row-clickable ${validSelectedId === location.id ? 'row-highlighted row-selected' : ''}`}
                  tabIndex={0}
                  aria-label={`Abrir detalle del local ${location.name}`}
                >
                  <td>{location.id}</td>
                  <td>{location.name}</td>
                  <td>{location.company_name || '-'}</td>
                  <td>{location.cuit || '-'}</td>
                  <td>{location.version_aloha || '-'}</td>
                  <td>{location.city || '-'}</td>
                  <td><span className={`badge ${location.status}`}>{location.status}</span></td>
                  <td>
                    <div className="form-actions">
                      <button className="btn-small" onClick={(event) => onEdit(location, event)}>
                        Editar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={(event) => onDelete(location, event)}
                        disabled={deletingId === location.id}
                      >
                        {deletingId === location.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-row">Sin resultados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default LocationsPage;
