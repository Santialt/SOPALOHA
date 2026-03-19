function DataTable({
  columns,
  rows,
  emptyMessage = 'Sin resultados.',
  className = '',
  tableClassName = '',
  wide = false,
  extraWide = false
}) {
  const wrapClassName = [
    'table-wrap',
    wide ? 'table-wrap-wide' : '',
    extraWide ? 'table-wrap-xl' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClassName}>
      <table className={['table', tableClassName].filter(Boolean).join(' ')}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${columns[index].key}`}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
