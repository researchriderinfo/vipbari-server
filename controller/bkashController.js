const bkashConfig = require("../config/bkashConfig.json");
const createPayment = require("../action/createPayment.js");
const executePayment = require("../action/executePayment.js");
const queryPayment = require("../action/queryPayment.js");
const searchTransaction = require("../action/searchTransaction.js");
const refundTransaction = require("../action/refundTransaction.js");

const checkout = async (req, res) => {
  try {
    console.log("amount", req.body);

    // Extract user and product information from req.body
    const {
      userEmail,
      productId,
      amount,
      quantity,
      address,
      productName,
      productImg,
      price,
    } = req.body;

    // Perform the payment transaction
    const createResult = await createPayment(req.body);
    console.log("Create Successful !!! ");
    res.json(createResult);

    // Save checkout response in the database along with user and product information
    const database = req.app.locals.database;
    const paymentResponse = database.collection("PaymentResponse");

    await paymentResponse.insertOne({
      paymentID: createResult.paymentID,
      paymentCreateTime: createResult.paymentCreateTime,
      transactionStatus: createResult.transactionStatus,
      paymentStatus: "Checkout",
      userEmail: userEmail,
      productId: productId,
      productName: productName,
      productImg: productImg,
      quantity: quantity,
      price: price,
      address: address,
      amount: amount,
      merchantInvoiceNumber: createResult.merchantInvoiceNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
};

const bkashCallback = async (req, res) => {
  try {
    if (req.query.status === "success") {
      const paymentID = req.query.paymentID;
      const database = req.app.locals.database;
      const paymentResponse = database.collection("PaymentResponse");

      // Check if any previous transaction with the same payment ID has a status of "Completed"
      const existingTransaction = await paymentResponse.findOne({
        paymentID: paymentID,
        paymentStatus: "Completed",
      });

      if (existingTransaction) {
        console.log("Duplicate transaction: ", paymentID);
        return res.redirect(
          `${bkashConfig.frontend_success_url}?data=Duplicate Transaction`
        );
      }

      let response = await executePayment(paymentID);

      console.log("bkashCallback", response);

      if (response.message) {
        response = await queryPayment(paymentID);
      }

      if (response.statusCode && response.statusCode === "0000") {
        console.log("Payment Successful !!! ");

        await paymentResponse.updateOne(
          { paymentID: paymentID },
          {
            $set: {
              paymentStatus: "Completed",
              responseData: response,
            },
          }
        );

        return res.redirect(
          `${bkashConfig.frontend_success_url}?data=${response.statusMessage}`
        );
      } else {
        console.log("Payment Failed !!!");

        await paymentResponse.updateOne(
          { paymentID: paymentID },
          {
            $set: {
              paymentStatus: "Failed",
              responseData: response,
            },
          }
        );

        return res.redirect(
          `${bkashConfig.frontend_fail_url}?data=${response.statusMessage}`
        );
      }
    } else {
      console.log("Payment Failed !!!");

      const paymentID = req.query.paymentID;
      const database = req.app.locals.database;
      const paymentResponse = database.collection("PaymentResponse");

      await paymentResponse.updateOne(
        { paymentID: paymentID },
        {
          $set: {
            paymentStatus: "Failed",
          },
        }
      );

      return res.redirect(`${bkashConfig.frontend_fail_url}`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "An error occurred" });
  }
};

const search = async (req, res) => {
  try {
    res.send(await searchTransaction(req.body.trxID));
  } catch (e) {
    console.log(e);
  }
};

const refund = async (req, res) => {
  try {
    res.send(await refundTransaction(req.body));
  } catch (e) {
    console.log(e);
  }
};

const refundStatus = async (req, res) => {
  try {
    res.send(await refundTransaction(req.body));
  } catch (e) {
    console.log(e);
  }
};

module.exports = {
  checkout,
  bkashCallback,
  search,
  refund,
  refundStatus,
};
