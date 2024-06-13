const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// middleware
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
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
    const requestAssetsCollection = client
      .db("asset_nex")
      .collection("request_assets");

    // jwt related Api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("insite verify token:", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unathoorized  access" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbiden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

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
    // update user affiliate status
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      // console.log(userInfo);
      const email = userInfo.email;
      const query = { email };
      const status = userInfo.affiliate;
      const hr_email = userInfo?.hr_email;
      const company_logo = userInfo?.company_logo;
      const statusUpdate = {
        $set: {
          affiliate: status,
          hr_email: hr_email,
          company_logo: company_logo,
        },
      };
      const result = await userCollection.updateOne(query, statusUpdate);
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

    // ------------------------------------------------------------------------hr manager

    app.get("/assets/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await assetCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/assets", async (req, res) => {
      const item = req.body;
      const result = await assetCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/assets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });

    // decriment product quantity
    app.patch("/asset/dicriment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateData = {
        $inc: {
          product_quantity: -1,
        },
      };
      const result = await assetCollection.updateOne(query, updateData);
      res.send(result);
    });

    // --------------------------------------------------employee_assets
    app.get("/request_assets/:email", async (req, res) => {
      const email = req.params.email;
      const query = { hr_email: email };
      const result = await requestAssetsCollection.find(query).toArray();
      const isPanding = result.filter((item) => item.status === "pending");
      res.send(isPanding);
    });

    //------------------------------------------------------- get my assets ? employee assets

    app.get(
      "/request_assets/myAssets/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;

        const query = {
          employee_email: email,
        };
        const result = await requestAssetsCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.post("/request_assets", async (req, res) => {
      const reqInfo = req.body;
      const result = await requestAssetsCollection.insertOne(reqInfo);
      res.send(result);
    });
    // assets request reject
    app.patch("/request_assets/reject/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      // console.log(id, data);
      const updateDoc = {
        $set: {
          status: data.status,
          note: data.note,
        },
      };
      const result = await requestAssetsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //-------------------------------------- asset return status update
    app.patch("/request_assets/return/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: "returned",
        },
      };
      const result = await requestAssetsCollection.updateOne(query, update);
      res.send(result);
    });

    //  increased product quantity after return
    app.patch("/asset/increase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateData = {
        $inc: {
          product_quantity: +1,
        },
      };
      const result = await assetCollection.updateOne(query, updateData);
      res.send(result);
    });

    // assets request approved
    app.patch("/request_assets/approdev/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      console.log(id, data);
      const updateDoc = {
        $set: {
          status: data.status,
          note: data.note,
          Aproved_date: data.Aproved_date,
        },
      };
      const result = await requestAssetsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

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

    app.get("/my_employee/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        hrEmail: email,
      };
      const result = await myEmployeeCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/my_employee", async (req, res) => {
      const employee = req.body;
      // if add and employee incress the add employee limit
      const query = { email: employee.hrEmail };
      const existingUser = await subscriptionsCollection.findOne(query);
      // console.log(existingUser);
      const options = {
        $inc: { member: -1 },
      };
      if (existingUser) {
        const result = await subscriptionsCollection.updateOne(query, options);
        const result2 = await myEmployeeCollection.insertOne(employee);
        return res.send({ result, result2 });
      }
      res.send({ message: "user not found" });
    });

    app.delete("/my_employee/:email", async (req, res) => {
      const email = req.params.email;
      const hrEmail = req.query.hrEmail;
      const myquery = {
        employee_email: email,
      };
      // if add and employee incress the add employee limit
      const query = { email: hrEmail };
      const existingUser = await subscriptionsCollection.findOne(query);
      const options = {
        $inc: { member: 1 },
      };
      // console.log(hrEmail);
      if (existingUser) {
        const result = await subscriptionsCollection.updateOne(query, options);
        const result2 = await myEmployeeCollection.deleteOne(myquery);
        return res.send({ result, result2 });
      }

      res.send({ message: "users not found" });
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
