exports.handler = async (event) => {
  const path = event.requestContext.http.path;
  const method = event.requestContext.http.method;

  if (path === "/hello" && method === "GET") {
    const response = {
      statusCode: 200,
      message: "Hello from Lambda",
    };
    return response;
  } else {
    const response = {
      statusCode: 400,
      message: `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`,
    };
    return response;
  }
};
