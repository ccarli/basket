// Without a body the request is a GET; with one it is a POST of that body as JSON.
async function request(path, body) {
  const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(`./api/${path}`, body ? post : {});
  const answer = await response.json();
  if (!response.ok) throw new Error(answer.detail);
  return answer;
}

export const getBasket = (basket) => request(basket ? `basket?basket=${encodeURIComponent(basket)}` : "basket");

// kind is "checks" or "booking": the names of the functions behind the button
export const getTasks = (kind) => request(kind);

// edited is the basket as it stands on screen: { basket, positions, unwind }
export const runTask = (kind, name, edited) => request(`${kind}/${name}`, edited);
export const sendEmail = (edited) => request("email", edited);
export const getCashFlows = (edited) => request("cash_flows", edited);
