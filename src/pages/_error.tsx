/**
 * Pages Router custom error page. Do NOT import Html/Head/Main/NextScript from next/document here.
 * This overrides Next's default _error so /500 prerender does not use Html outside _document.
 */
function Error({
  statusCode,
}: {
  statusCode?: number;
}) {
  return (
    <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1>{statusCode ?? "Error"}</h1>
      <p>
        {statusCode
          ? `An error ${statusCode} occurred on the server.`
          : "An error occurred on the client."}
      </p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: { res?: { statusCode?: number }; err?: { statusCode?: number } }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
