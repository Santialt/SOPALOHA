import InlineError from './InlineError';
import LoadingBlock from './LoadingBlock';
import Badge from './Badge';
import Card from './Card';

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short'
});

function formatDateTime(value) {
  if (!value) return '-';
  const normalized = String(value).includes(' ') ? String(value).replace(' ', 'T') : String(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

function CurrentOnCallBlock({ shift, loading = false, error = '', title = 'Guardia actual' }) {
  if (loading) return <LoadingBlock label="Cargando guardia actual..." />;

  return (
    <Card
      className="current-on-call-card"
      title={title}
      subtitle="Cobertura vigente para escalamiento y soporte fuera de horario."
      actions={<Badge tone={shift ? 'primary' : 'neutral'}>{shift ? 'Activa' : 'Sin cobertura'}</Badge>}
    >
      <InlineError message={error} />
      {shift ? (
        <div className="current-on-call-content">
          <div>
            <small>Principal</small>
            <strong>{shift.assigned_to}</strong>
          </div>
          <div>
            <small>Backup</small>
            <strong>{shift.backup_assigned_to || '-'}</strong>
          </div>
          <div>
            <small>Rango</small>
            <strong>
              {formatDateTime(shift.start_at)} - {formatDateTime(shift.end_at)}
            </strong>
          </div>
          <div>
            <small>Titulo</small>
            <strong>{shift.title}</strong>
          </div>
          <div className="full-width">
            <small>Notas</small>
            <strong>{shift.notes || 'Sin notas'}</strong>
          </div>
        </div>
      ) : (
        <div className="kanban-empty">No hay una guardia activa en este momento.</div>
      )}
    </Card>
  );
}

export default CurrentOnCallBlock;
