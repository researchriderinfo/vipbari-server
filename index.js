const cors = require("cors");
const express = require("express");
const multer = require("multer");
const app = express();
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
require("dotenv").config();
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
