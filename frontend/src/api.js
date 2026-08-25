const query = (basket) => (basket ? `?basket=${encodeURIComponent(basket)}` : "");

/** Without a basket the backend answers with the first one. */
export const getBasket = (basket) => fetch(`./api/basket${query(basket)}`).then((r) => r.json());

export const getChecks = (basket) => fetch(`./api/checks${query(basket)}`).then((r) => r.json());
