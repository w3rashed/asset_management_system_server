const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
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
    const subscribe_cardCollection = client
      .db("asset_nex")
      .collection("subscribe_card");
    const subscriptionsCollection = client
      .db("asset_nex")
      .collection("subscriptions");
    const paymentCollection = client.db("asset_nex").collection("payments");
    const assetCollection = client.db("asset_nex").collection("assets");
    const myEmployeeCollection = client
      .db("asset_nex")
      .collection("my_employee");

    // jwt related Api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // -----------------------------------------------PAYMENT INTENT

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // ---------------------------------------------------------------------user

    // get all employee only
    app.get("/all_users", async (req, res) => {
      const query = { role: "employee" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };

      const result = await userCollection.findOne(query);
      // console.log({ query, result });
      res.send(result);
    });

    app.patch("/users", async (req, res) => {
      const user = req.body;
      // checking not exist email
      const query = { email: user.email };
      // ------------------------------------------------------update name
      // console.log(user);
      const updateName = {
        $set: {
          name: user.name,
        },
      };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        const UpdateResult = await userCollection.updateOne(query, updateName);
        return res.send(UpdateResult);
      }
      const result = await userCollection.insertOne(user);
      res.send({ result });
    });

    app.delete("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      // console.log(query);
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // -------------------------------------------------------------------------------hr manager
    app.post("/asstes", async (req, res) => {
      const item = req.body;
      const result = await assetCollection.insertOne(item);
      res.send(result);
    });

    // subscribe_card get
    app.get("/subscribe_card", async (req, res) => {
      const result = await subscribe_cardCollection.find().toArray();
      res.send(result);
    });

    app.get("/subscriptions/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await subscriptionsCollection.findOne(query);
      res.send(result);
    });

    app.patch("/subscriptions", async (req, res) => {
      const subsInfo = req.body;
      const newMember = subsInfo.member;
      // console.log(newMember, "fdsadfhkdjsahjk");
      // checking not exist email
      const query = { email: subsInfo.email };
      const existingUser = await subscriptionsCollection.findOne(query);

      // update package
      const options = {
        $set: { member: newMember },
      };
      if (existingUser) {
        const result = await subscriptionsCollection.updateOne(query, options);
        return res.send(result);
      }
      const result = await subscriptionsCollection.insertOne(subsInfo);
      res.send(result);
    });

    // add employe also remove form users data
    app.post("/my_employee", async (req, res) => {
      const employee = req.body;
      const result = await myEmployeeCollection.insertOne(employee);
      res.send(result);
    });

    // add payment history and delete paymented items
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send({ paymentResult });
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
