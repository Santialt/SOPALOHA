function InlineSuccess({ message }) {
  if (!message) return null;

  return <div className="inline-success">{message}</div>;
}

export default InlineSuccess;
