async function request(path, params = {}, method = "GET") {
  const given = Object.entries(params).filter(([, value]) => value !== undefined);
  const response = await fetch(`./api/${path}?${new URLSearchParams(given)}`, { method });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail);
  return body;
}

export const getBasket = (basket) => request("basket", { basket });
// kind is "checks" or "booking": the functions behind the button, then one of them run
export const getTasks = (kind) => request(kind);
export const runTask = (kind, name, basket) => request(`${kind}/${name}`, { basket }, "POST");
export const sendEmail = (basket) => request("email", { basket }, "POST");
export const getCashFlows = (basket, unwind) => request("cash_flows", { basket, unwind });
