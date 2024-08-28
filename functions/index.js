const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {Client, Environment, ApiError} = require("square");
const crypto = require("crypto");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const client = new Client({
  environment: Environment.Production,
  accessToken:
  "EAAAlsI8oFntc4E8JSxajN0F57FRKTCdike6dUV5eQkDNhfXz0ZltoRgigDyn01c",
});

const {paymentsApi, ordersApi} = client;

app.post("/chargeForCookie", async (req, res) => {
  const {nonce, name, amount} = req.body;
  try {
    const locationId = "L2JXKV2H2K3GF";
    const createOrderRequest = {
      idempotencyKey: crypto.randomBytes(12).toString("hex"),
      order: {
        locationId: locationId,
        lineItems: [
          {
            name: name,
            quantity: "1",
            basePriceMoney: {
              amount: amount,
              currency: "USD",
            },
          },
        ],
      },
    };

    const createOrderResponse = await ordersApi.createOrder(createOrderRequest);

    const createPaymentRequest = {
      idempotencyKey: crypto.randomBytes(12).toString("hex"),
      sourceId: nonce,
      amountMoney: createOrderResponse.result.order.totalMoney,
      orderId: createOrderResponse.result.order.id,
      autocomplete: true,
      locationId,
    };

    const createPaymentResponse =
    await paymentsApi.createPayment(createPaymentRequest);
    logger.info(createPaymentResponse.result.payment);

    res.status(200).json(createPaymentResponse.result.payment);
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Handles API errors by logging them and sending appropriate responses.
 * @param {ApiError} error - The API error object.
 * @param {Object} res - The response object.
 */
function handleApiError(error, res) {
  if (error instanceof ApiError) {
    logger.error("Square API Error:", JSON.stringify(error.errors, null, 2));
    sendErrorMessage(error.errors, res);
  } else {
    logger.error("Unknown Error:", error);
    res.status(500).send({
      errorMessage: "An unknown error occurred. Please try again later.",
    });
  }
}

/**
 * Sends an error message response based on the error code.
 * @param {Array} errors - The array of error objects.
 * @param {Object} response - The response object.
 */
function sendErrorMessage(errors, response) {
  const errorMessages = {
    UNAUTHORIZED: "Server Not Authorized. Please check your server permission.",
    GENERIC_DECLINE: "Card declined. Please re-enter card information.",
    CVV_FAILURE: "Invalid CVV. Please re-enter card information.",
    ADDRESS_VERIFICATION_FAILURE: "Invalid Postal Code. Re-enter information.",
    EXPIRATION_FAILURE: "Invalid expiration date. Re-enter card information.",
    INSUFFICIENT_FUNDS: "Insufficient funds; Try re-entering card details.",
    CARD_NOT_SUPPORTED: "Card not supported in region; Re-enter card details.",
    PAYMENT_LIMIT_EXCEEDED: "Process limit for merchant; Re-enter card details",
    TEMPORARY_ERROR: "Unknown temporary error; please try again.",
  };

  const errorMessage =
  errorMessages[errors[0].code] || "Payment error. Please contact support.";
  const statusCode = errors[0].code === "TEMPORARY_ERROR" ? 500 : 400;

  response.status(statusCode).send({errorMessage});
}

// Export the Express app as a Firebase Cloud Function
exports.api = onRequest(app);
