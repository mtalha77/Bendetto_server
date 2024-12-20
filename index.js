const express = require("express");
const app = express();
const { Client, Environment } = require("square");
const crypto = require("crypto");
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Initialized the Square Api client:
//   Set environment
//   Set access token
// const defaultClient = new Client({
//   environment:
//     process.env.ENVIRONMENT === "PRODUCTION"
//       ? Environment.Production
//       : Environment.Sandbox,
//   accessToken:
//     "EAAAlyV5zPuURZXU73aRdCfV2LsbVKscQpvCi24ryOk8Da21nxG_zQ38V5b6Ke_i",
//   // accessToken: process.env.ACCESS_TOKEN,
// });

const defaultClient = new Client({
  environment: Environment.Sandbox,
  accessToken:
    "EAAAlyV5zPuURZXU73aRdCfV2LsbVKscQpvCi24ryOk8Da21nxG_zQ38V5b6Ke_i",
  // accessToken: process.env.ACCESS_TOKEN,
});

const { paymentsApi, ordersApi, locationsApi, customersApi } = defaultClient;

app.post("/chargeForCookie", async (request, response) => {
  const requestBody = request.body;
  try {
    // const locationId = process.env.LOCATION_ID;
    const locationId = "LA2294W1QCPP8";

    const createOrderRequest = {
      idempotencyKey: crypto.randomBytes(12).toString("hex"),
      order: {
        locationId: locationId,
        lineItems: [
          {
            name: requestBody.name,
            quantity: "1",
            basePriceMoney: {
              amount: requestBody.amount,
              currency: "USD",
            },
          },
        ],
      },
    };
    // const createOrderRequest = getOrderRequest(locationId);
    const createOrderResponse = await ordersApi.createOrder(createOrderRequest);

    const createPaymentRequest = {
      idempotencyKey: crypto.randomBytes(12).toString("hex"),
      sourceId: requestBody.nonce,
      amountMoney: {
        ...createOrderResponse.result.order.totalMoney,
      },
      orderId: createOrderResponse.result.order.id,
      autocomplete: true,
      locationId,
    };
    const createPaymentResponse = await paymentsApi.createPayment(
      createPaymentRequest
    );
    console.log(createPaymentResponse.result.payment);

    response.status(200).json(createPaymentResponse.result.payment);
  } catch (e) {
    console.log(e);
    console.log(
      `[Error] Status:${e.statusCode}, Messages: ${JSON.stringify(
        e.errors,
        null,
        2
      )}`
    );

    sendErrorMessage(e.errors, response);
  }
});

app.post("/chargeCustomerCard", async (request, response) => {
  const requestBody = request.body;

  try {
    const listLocationsResponse = await locationsApi.listLocations();
    const locationId = process.env.LOCATION_ID;
    const createOrderRequest = getOrderRequest(locationId);
    const createOrderResponse = await ordersApi.createOrder(createOrderRequest);
    const createPaymentRequest = {
      idempotencyKey: crypto.randomBytes(12).toString("hex"),
      customerId: requestBody.customer_id,
      sourceId: requestBody.customer_card_id,
      amountMoney: {
        ...createOrderResponse.result.order.totalMoney,
      },
      orderId: createOrderResponse.result.order.id,
    };
    const createPaymentResponse = await paymentsApi.createPayment(
      createPaymentRequest
    );
    console.log(createPaymentResponse.result.payment);

    response.status(200).json(createPaymentResponse.result.payment);
  } catch (e) {
    console.log(
      `[Error] Status:${e.statusCode}, Messages: ${JSON.stringify(
        e.errors,
        null,
        2
      )}`
    );

    sendErrorMessage(e.errors, response);
  }
});

app.post("/createCustomerCard", async (request, response) => {
  const requestBody = request.body;
  console.log(requestBody);
  try {
    const createCustomerCardRequestBody = {
      cardNonce: requestBody.nonce,
    };
    const customerCardResponse = await customersApi.createCustomerCard(
      requestBody.customer_id,
      createCustomerCardRequestBody
    );
    console.log(customerCardResponse.result.card);

    response.status(200).json(customerCardResponse.result.card);
  } catch (e) {
    console.log(
      `[Error] Status:${e.statusCode}, Messages: ${JSON.stringify(
        e.errors,
        null,
        2
      )}`
    );

    sendErrorMessage(e.errors, response);
  }
});

function getOrderRequest(locationId) {
  return {
    idempotencyKey: crypto.randomBytes(12).toString("hex"),
    order: {
      locationId: locationId,
      lineItems: [
        {
          name: "Cookie 🍪",
          quantity: "1",
          basePriceMoney: {
            amount: 100,
            currency: "USD",
          },
        },
      ],
    },
  };
}

function sendErrorMessage(errors, response) {
  switch (errors[0].code) {
    case "UNAUTHORIZED":
      response.status(401).send({
        errorMessage:
          "Server Not Authorized. Please check your server permission.",
      });
      break;
    case "GENERIC_DECLINE":
      response.status(400).send({
        errorMessage: "Card declined. Please re-enter card information.",
      });
      break;
    case "CVV_FAILURE":
      response.status(400).send({
        errorMessage: "Invalid CVV. Please re-enter card information.",
      });
      break;
    case "ADDRESS_VERIFICATION_FAILURE":
      response.status(400).send({
        errorMessage: "Invalid Postal Code. Please re-enter card information.",
      });
      break;
    case "EXPIRATION_FAILURE":
      response.status(400).send({
        errorMessage:
          "Invalid expiration date. Please re-enter card information.",
      });
      break;
    case "INSUFFICIENT_FUNDS":
      response.status(400).send({
        errorMessage:
          "Insufficient funds; Please try re-entering card details.",
      });
      break;
    case "CARD_NOT_SUPPORTED":
      response.status(400).send({
        errorMessage:
          "	The card is not supported either in the geographic region or by the MCC; Please try re-entering card details.",
      });
      break;
    case "PAYMENT_LIMIT_EXCEEDED":
      response.status(400).send({
        errorMessage:
          "Processing limit for this merchant; Please try re-entering card details.",
      });
      break;
    case "TEMPORARY_ERROR":
      response.status(500).send({
        errorMessage: "Unknown temporary error; please try again;",
      });
      break;
    default:
      response.status(400).send({
        errorMessage:
          "Payment error. Please contact support if issue persists.",
      });
      break;
  }
}

// listen for requests :)
const listener = app.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
