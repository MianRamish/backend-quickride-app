const CARD_GATEWAY_READY = false;

const PAYMENT_METHODS = {
  cash: {
    id: "cash",
    label: "Cash",
    enabled: true,
    status: "available",
    description: "Pay the driver directly in cash after the trip.",
  },
  card: {
    id: "card",
    label: "Card",
    enabled: CARD_GATEWAY_READY,
    status: CARD_GATEWAY_READY ? "available" : "coming_soon",
    description: CARD_GATEWAY_READY
      ? "Pay securely with a debit or credit card."
      : "Card payments are prepared in the backend but disabled until a payment gateway is integrated.",
  },
};

module.exports.getPaymentMethods = () => Object.values(PAYMENT_METHODS);

module.exports.assertPaymentMethodAvailable = (method = "cash") => {
  const normalized = String(method || "cash").toLowerCase();
  const config = PAYMENT_METHODS[normalized];

  if (!config) {
    const error = new Error("Unsupported payment method.");
    error.statusCode = 400;
    throw error;
  }

  if (!config.enabled) {
    const error = new Error("Card payments are coming soon. Please choose cash for now.");
    error.statusCode = 409;
    throw error;
  }

  return config;
};

module.exports.getInitialPaymentStatus = (method = "cash") => {
  return method === "cash" ? "cash_due" : "card_pending";
};

module.exports.confirmRidePaymentBeforeCompletion = ({ ride, cashCollected }) => {
  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  if (ride.paymentMethod === "cash" && cashCollected !== true) {
    const error = new Error("Confirm that cash was collected from the passenger before ending the ride.");
    error.statusCode = 400;
    throw error;
  }

  if (ride.paymentMethod === "card" && ride.paymentStatus !== "paid") {
    const error = new Error("Card payment has not been confirmed yet.");
    error.statusCode = 409;
    throw error;
  }
};
