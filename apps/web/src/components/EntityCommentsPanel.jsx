import { useEffect, useState } from 'react';
import InlineError from './InlineError';
import InlineSuccess from './InlineSuccess';

function EntityCommentsPanel({ entityId, entityLabel, loadComments, createComment }) {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!entityId) {
        setComments([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await loadComments(entityId);
        if (active) {
          setComments(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [entityId, loadComments]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const created = await createComment(entityId, { comment });
      setComments((prev) => [...prev, created]);
      setComment('');
      setSuccess('Comentario agregado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section-card">
      <div className="section-head">
        <h2>Comentarios {entityLabel}</h2>
        {entityId ? <small>{comments.length} cargados</small> : <small>Selecciona un registro</small>}
      </div>

      <InlineError message={error} />
      <InlineSuccess message={success} />

      {!entityId ? (
        <div className="empty-row">Selecciona un registro para ver y crear comentarios.</div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="form-grid">
            <label className="full-row">
              Nuevo comentario
              <textarea
                className="input"
                rows="3"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Agregar comentario'}
            </button>
          </form>

          {loading ? (
            <div className="empty-row">Cargando comentarios...</div>
          ) : comments.length === 0 ? (
            <div className="empty-row">Sin comentarios.</div>
          ) : (
            <div className="comment-list">
              {comments.map((item) => (
                <article key={item.id} className="comment-card">
                  <div className="comment-card-head">
                    <strong>{item.user_name || item.user_email || `Usuario #${item.user_id}`}</strong>
                    <small>{item.created_at}</small>
                  </div>
                  <div>{item.comment}</div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default EntityCommentsPanel;
