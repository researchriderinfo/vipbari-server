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

app.use(cors());
app.use(express.json());
app.use("/uploads/images", express.static(__dirname + "/public/upload/images"));

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

//Required Product Form
const productSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().required(),
  marketPrice: Joi.number().optional(),
  discountPercent: Joi.number(),
  category: Joi.string().required(),
  description: Joi.string().required(),
  image: Joi.string(),
});

async function run() {
  try {
    await client.connect();
    const database = client.db("Vip-Bari");
    const productsCollection = database.collection("products");
    const reviewsCollection = database.collection("Review");
    const ordersCollection = database.collection("Orders");
    const usersCollection = database.collection("users");
    const cartCollection = database.collection("AddCart");

    // POST API for storing user cart items
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

        console.log(cartItem);

        const result = await cartCollection.insertOne(cartItem);
        res.json(result);
      } catch (error) {
        console.error("Error storing cart item:", error);
        res.status(500).json({ error: "Failed to store cart item" });
      }
    });

    //GET API for searching cart items using user email
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

    //ADD USERS
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    //ADD GOOGLE USERS
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

    //Get User
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find({});
      const users = await cursor.toArray();
      res.json(users);
    });

    //Getting all Products categories
    app.get("/categories", async (req, res) => {
      const categories = await productsCollection.distinct("category");
      res.json(categories);
    });

    //Search product via category
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

    //Getting single product
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

    // Get a single product by _id
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

    //Getting all Products
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

    // ADD PRODUCT
    app.post("/product", upload.single("image"), async (req, res) => {
      try {
        const product = {
          name: req.body.name,
          price: req.body.price,
          marketPrice: req.body.marketPrice,
          discountPercent: req.body.discountPercent,
          category: req.body.category,
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

    // DELETE PRODUCT BY ID
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

    // ADD REVIEW
    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.json(result);
    });

    //GET REVIEW
    app.get("/reviews", async (req, res) => {
      const cursor = reviewsCollection.find({});
      const reviews = await cursor.toArray();
      res.json(reviews);
    });

    // GET MY ORDERS
    app.get("/myOrders/:email", async (req, res) => {
      console.log(req.params.email);
      const result = await ordersCollection
        .find({ email: req.params.email })
        .toArray();
      res.send(result);
    });

    //CHECK ADMIN OR NOT
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

    // MAKE ADMIN
    app.put("/users/admin", async (req, res) => {
      const user = req.body;
      console.log("put", user);
      const filter = { email: user.email };
      const updateDoc = { $set: { role: "admin" } };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    //GET API for searching cart items using user email
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
