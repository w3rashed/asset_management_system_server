const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// middleware
app.use(cors({ origin: ["http://localhost:5173"] }));
app.use(express.json());

// -------------------------------------------------

const uri = "mongodb://localhost:27017";
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nrpddgz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("asset_nex").collection("users");
    const subscriptionCollection = client
      .db("asset_nex")
      .collection("subscription");
    const paymentCollection = client.db("asset_nex").collection("payments");

    // -----------------------------------------------PAYMENT INTENT

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // add payment history and delete paymented items
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // carefully delete each item from the cart
      console.log("payment info", payment);

      res.send({ paymentResult });
    });
    // ---------------------------------------------------------------------

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };

      const result = await userCollection.findOne(query);
      console.log({ query, result });
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // checking not exist email
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // subscription get
    app.get("/subscriptions", async (req, res) => {
      const result = await subscriptionCollection.find().toArray();
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
// ------------------------------------------------

app.get("/", (req, res) => {
  res.send("asset nex is running");
});

app.listen(port, () => {
  console.log(`Asset nex is sitting on port ${port}`);
});
