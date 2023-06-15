const cors = require("cors");
const express = require("express");
const multer = require("multer");
const app = express();
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
require("dotenv").config();
// const axios = require("axios");
const port = process.env.PORT || 5000;
const Joi = require("joi");

//BKASH ROUTER
const bkashRouter = require("./routes/bkashRouter");

app.use(cors());
app.use(express.json());
app.use("/uploads/images", express.static(__dirname + "/public/upload/images"));
app.use("/api/bkash", bkashRouter);

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-bd9xspy-shard-00-00.lzib7iv.mongodb.net:27017,ac-bd9xspy-shard-00-01.lzib7iv.mongodb.net:27017,ac-bd9xspy-shard-00-02.lzib7iv.mongodb.net:27017/?ssl=true&replicaSet=atlas-tb07us-shard-0&authSource=admin&retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/upload/images");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname.replace(/\s+/g, "_"));
  },
});

const upload = multer({ storage: storage });

async function run() {
  try {
    await client.connect();
    const database = client.db("Vip-Bari");
    const productsCollection = database.collection("products");
    const reviewsCollection = database.collection("Review");
    const ordersCollection = database.collection("Orders");
    const usersCollection = database.collection("users");
    const cartCollection = database.collection("AddCart");
    const categoryCollection = database.collection("Category");
    const addressCollection = database.collection("UserAddress");
    const paymentResponse = database.collection("PaymentResponse");
    app.locals.database = database;

    //----------------------------------------User API Start--------------------------------//
    //1. ADD USERS
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    //2. ADD GOOGLE USERS
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    //3. Get User
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find({});
      const users = await cursor.toArray();
      res.json(users);
    });
    //----------------------------------------User API End----------------------------------//

    //----------------------------------------Admin API Start----------------------------------//

    //1. CHECK ADMIN OR NOT
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //2. MAKE ADMIN
    app.put("/users/admin", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const updateDoc = { $set: { role: "admin" } };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.json(result);
    });
    //----------------------------------------Admin API End----------------------------------//

    //----------------------------------------Products API Start-----------------------------//

    //1. Search product via category
    app.get("/products/category/:category", async (req, res) => {
      const category = decodeURIComponent(req.params.category);
      const regex = new RegExp(category, "i"); // create regex pattern with case-insensitive flag
      const cursor = productsCollection.find({ category: { $regex: regex } }); // use regex pattern in query
      const products = await cursor.toArray();

      // const baseUrl = `${req.protocol}://${req.hostname}`;
      const baseUrl = `${req.protocol}://${req.hostname}:${
        process.env.PORT || 5000
      }`;

      const productsWithImageUrl = products.map((product) => ({
        ...product,
        imageUrl: `${baseUrl}/uploads/images/${product.image}`,
      }));

      res.json(productsWithImageUrl);
    });

    //2. Getting single product
    app.get("/products/search/:name", async (req, res) => {
      const name = req.params.name;
      const query = { name: { $regex: new RegExp(name), $options: "i" } };
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();

      // const baseUrl = `${req.protocol}://${req.hostname}`;
      const baseUrl = `${req.protocol}://${req.hostname}:${
        process.env.PORT || 5000
      }`;
      // If you're running the server on a custom domain, replace `req.hostname` with your domain

      const productsWithImageUrl = products.map((product) => ({
        ...product,
        imageUrl: `${baseUrl}/uploads/images/${product.image}`,
      }));

      res.json(productsWithImageUrl);
    });

    //3. Get a single product by _id
    app.get("/products/:id", async (req, res) => {
      const { id } = req.params;
      const product = await productsCollection.findOne({ _id: ObjectId(id) });

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // add the following code block to update the image URL
      const baseUrl = `${req.protocol}://${req.hostname}:${
        process.env.PORT || 5000
      }`;
      product.imageUrl = `${baseUrl}/uploads/images/${product.image}`;

      res.json(product);
    });

    //4. Getting all Products
    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find({});
      const products = await cursor.toArray();

      // const baseUrl = `${req.protocol}://${req.hostname}`;
      const baseUrl = `${req.protocol}://${req.hostname}:${
        process.env.PORT || 5000
      }`;
      // If you're running the server on a custom domain, replace `req.hostname` with your domain

      const productsWithImageUrl = products.map((product) => ({
        ...product,
        imageUrl: `${baseUrl}/uploads/images/${product.image}`,
      }));

      res.json(productsWithImageUrl);
    });

    //5. ADD PRODUCT
    app.post("/product", upload.single("image"), async (req, res) => {
      try {
        const product = {
          name: req.body.name,
          price: req.body.price,
          marketPrice: req.body.marketPrice,
          discountPercent: req.body.discountPercent,
          category: req.body.category,
          subcategories: req.body.subcategories,
          description: req.body.description,
          image: req.file.filename,
        };

        const result = await productsCollection.insertOne(product);

        res.status(201).json({
          message: "Product created successfully",
          productId: result.insertedId,
        });
      } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
      }
    });

    //6. DELETE PRODUCT BY ID
    app.delete("/product/:id", async (req, res) => {
      try {
        const productId = req.params.id;
        const product = await productsCollection.findOne({
          _id: ObjectId(productId),
        });
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        await productsCollection.deleteOne({ _id: ObjectId(productId) });

        res.json({ message: "Product deleted successfully" });
      } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
      }
    });

    //7. SEARCH PRODUCT BY CATEGORY AND SUBCATEGORIES

    app.get("/search", async (req, res) => {
      try {
        let { category, subcategory } = req.query;

        const query = {};

        if (category) {
          query.category = { $regex: category, $options: "i" };
        }

        if (subcategory) {
          query.subcategories = { $regex: subcategory, $options: "i" };
        }

        const products = await productsCollection.find(query).toArray();

        const baseUrl = `${req.protocol}://${req.hostname}:${
          process.env.PORT || 5000
        }`;

        const productsWithImageUrl = products.map((product) => ({
          ...product,
          imageUrl: `${baseUrl}/uploads/images/${product.image}`,
        }));

        res.status(200).json(productsWithImageUrl);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "An error occurred while searching for products." });
      }
    });
    //----------------------------------------Products API End-------------------------------//

    //----------------------------------------Categories API Start-----------------------------//
    //1. POST API for storing category and sub-category
    app.post("/categories", async (req, res) => {
      try {
        const { category, subcategories } = req.body;

        // Validate the request body
        if (!category || !Array.isArray(subcategories)) {
          throw new Error("Invalid category and sub-category data");
        }

        // Store the category and sub-categories in the database
        const result = await categoryCollection.insertOne({
          category,
          subcategories,
        });

        res.json(result);
      } catch (error) {
        console.error("Error storing category and sub-category:", error);
        res
          .status(500)
          .json({ error: "Failed to store category and sub-category" });
      }
    });

    //2. Getting all Products categories
    app.get("/categories", async (req, res) => {
      const cursor = categoryCollection.find({});
      const categories = await cursor.toArray();
      res.json(categories);
    });
    //----------------------------------------Categories API End-------------------------------//

    //----------------------------------------Order API Start-------------------------------//
    //1. GET MY ORDERS
    app.get("/myOrders/:email", async (req, res) => {
      const result = await ordersCollection
        .find({ email: req.params.email })
        .toArray();
      res.send(result);
    });
    //----------------------------------------Order API End-------------------------------//

    //----------------------------------------Review API Start-------------------------------//

    //1. ADD REVIEW
    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.json(result);
    });

    //2. GET REVIEW
    app.get("/reviews", async (req, res) => {
      const cursor = reviewsCollection.find({});
      const reviews = await cursor.toArray();
      res.json(reviews);
    });

    //----------------------------------------Review API End-------------------------------//

    //----------------------------------------Add to Cart API Start-----------------------------//
    // 1. POST API for storing user cart items
    app.post("/cart", async (req, res) => {
      try {
        const cartItem = {
          email: req.body.email,
          price: req.body.price,
          productName: req.body.productName,
          marketPrice: req.body.marketPrice,
          discountPercent: req.body.discountPercent,
          description: req.body.description,
          image: req.body.image,
        };

        const result = await cartCollection.insertOne(cartItem);
        res.json(result);
      } catch (error) {
        console.error("Error storing cart item:", error);
        res.status(500).json({ error: "Failed to store cart item" });
      }
    });

    // 2. GET API for searching cart items using user email
    app.get("/cart/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const cursor = cartCollection.find(query);
        const cartItems = await cursor.toArray();

        //Include image url in cart items
        const baseUrl = `${req.protocol}://${req.hostname}:${
          process.env.PORT || 5000
        }`;
        const cartItemsWithImageUrl = cartItems.map((item) => ({
          ...item,
          imageUrl: `${baseUrl}/uploads/images/${item.image}`,
        }));

        res.json(cartItemsWithImageUrl);
      } catch {
        console.error("Error Searching cart items:", error);
        res.status(500).json({ error: "Failed to search cart items" });
      }
    });

    // DELETE API for removing a single item from cartCollection
    app.delete("/remove/:itemId", async (req, res) => {
      try {
        const itemId = req.params.itemId;
        const query = { _id: ObjectId(itemId) };
        const result = await cartCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.json({ message: "Item deleted successfully" });
        } else {
          res.status(404).json({ error: "Item not found" });
        }
      } catch (error) {
        console.error("Error deleting cart item:", error);
        res.status(500).json({ error: "Failed to delete cart item" });
      }
    });

    // DELETE API for removing all items from cartCollection for a specific user

    app.delete("/allRemove/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const result = await cartCollection.deleteMany(query);

        if (result.deletedCount > 0) {
          res.json({ message: "All items deleted successfully" });
        } else {
          res.status(404).json({ error: "No items found for the user" });
        }
      } catch (error) {
        console.error("Error deleting cart items:", error);
        res.status(500).json({ error: "Failed to delete cart items" });
      }
    });

    //----------------------------------------Add to Cart API End-------------------------------//

    app.post("/address", async (req, res) => {
      const { email, address } = req.body;

      // Check if the address already exists for the given email
      const existingAddress = await addressCollection.findOne({ email });

      if (existingAddress) {
        // Update the existing address with the new data
        const result = await addressCollection.updateOne(
          { email },
          { $set: { address } }
        );
        res.json(result);
      } else {
        // Add a new address if it doesn't already exist
        const result = await addressCollection.insertOne({ email, address });
        res.json(result);
      }
    });

    app.get("/userAddress", async (req, res) => {
      const { email } = req.query; // Assuming the email is passed as a query parameter

      const cursor = addressCollection.find({ email }); // Find addresses matching the email
      const addresses = await cursor.toArray();

      res.json(addresses);
    });

    // POST endpoint for inserting order data into ordersCollection
    app.post("/api/orders", async (req, res) => {
      const orderData = req.body;
      console.log(orderData);

      try {
        const result = await ordersCollection.insertOne(orderData);
        res.json(result);
      } catch (error) {
        console.error("Error inserting order data:", error);
        res
          .status(500)
          .json({ error: "An error occurred while inserting order data." });
      }
    });

    //  POST responseData to PaymentResponse collection
    app.post("/api/payment/response", async (req, res) => {
      const responseData = req.body.responseData;

      console.log({ responseData });

      try {
        const result = await paymentResponse.insertOne({ responseData });
        res.json(result);
      } catch (error) {
        console.error("Error saving responseData:", error);
        res.status(500).json({ error: "Failed to save responseData" });
      }
    });

    // Getting Order Data
    app.get("/product/orders", async (req, res) => {
      try {
        const paymentResponseData = await paymentResponse.find().toArray();
        const ordersData = await ordersCollection.find().toArray();

        // Add the productImg URL to each product in the combined data
        const baseUrl = `${req.protocol}://${req.hostname}:${
          process.env.PORT || 5000
        }`;
        const combinedDataWithImageUrl = {
          BkashOrders: paymentResponseData.map((order) => ({
            ...order,
            productImg: `${baseUrl}/uploads/images/${order.productImg}`,
          })),
          CashOnOrders: ordersData.map((order) => ({
            ...order,
            productImg: `${baseUrl}/uploads/images/${order.productImg}`,
          })),
        };

        res.json(combinedDataWithImageUrl);
      } catch (error) {
        console.error("Error retrieving data:", error);
        res.status(500).json({ error: "Failed to retrieve data" });
      }
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.log(err.stack);
      res.status(500).send("Something Wrong !!!");
    });

    // Not found route
    app.use((req, res, next) => {
      console.log("Sorry, Not Found !!!");
      res.status(404).send("Sorry, Not Found !!!");
    });

    module.exports = {
      paymentResponse,
    };
  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("E-commerce Server process!");
});

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
